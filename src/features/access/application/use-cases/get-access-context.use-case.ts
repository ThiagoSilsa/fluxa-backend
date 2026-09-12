// NestJS
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

// Shared
import {
  isValidBrazilianPlate,
  normalizePlate,
} from '../../../../shared/utils/plate.util';

// Constants
import {
  AccessVerdict,
  AccessVerdictReason,
} from '../../domain/constants/access-verdict.constant';
import { AccessRequestStatus } from '../../../access-requests/domain/constants/access-request.constant';

// Utils
import { resolveCapacity, hasFreeSlot } from '../utils/resolve-capacity.util';
import { resolveAccessRequestDeadline } from '../../../access-requests/application/utils/access-request-deadline.util';

// Repositories
import { VEHICLE_ACCESS_REPOSITORY } from '../../domain/repositories/vehicle-access.repository';
import { VEHICLE_REPOSITORY } from '../../../vehicles/domain/repositories/vehicle.repository';
import { VEHICLE_DEPARTMENT_REPOSITORY } from '../../../vehicles/domain/repositories/vehicle-department.repository';
import { USER_VEHICLE_REPOSITORY } from '../../../vehicles/domain/repositories/user-vehicle.repository';
import { VEHICLE_BLOCK_REPOSITORY } from '../../../blocks/domain/repositories/vehicle-block.repository';
import { ACCESS_REQUEST_REPOSITORY } from '../../../access-requests/domain/repositories/access-request.repository';
import { DEPARTMENT_REPOSITORY } from '../../../departments/domain/repositories/department.repository';
import { USER_REPOSITORY } from '../../../users/domain/repositories/user.repository';
import { USER_COMPANY_REPOSITORY } from '../../../auth/domain/repositories/user-company.repository';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { VehicleWithTypeEntity } from '../../../vehicles/domain/entities/vehicle.entity';
import type { VehicleAccessEntity } from '../../domain/entities/vehicle-access.entity';
import type { VehicleDepartmentEntity } from '../../../vehicles/domain/entities/vehicle-department.entity';
import type { DepartmentEntity } from '../../../departments/domain/entities/department.entity';
import type { UserVehicleWithUserEntity } from '../../../vehicles/domain/entities/user-vehicle.entity';
import type { VehicleAccessRepository } from '../../domain/repositories/vehicle-access.repository';
import type { VehicleRepository } from '../../../vehicles/domain/repositories/vehicle.repository';
import type { VehicleDepartmentRepository } from '../../../vehicles/domain/repositories/vehicle-department.repository';
import type { UserVehicleRepository } from '../../../vehicles/domain/repositories/user-vehicle.repository';
import type { VehicleBlockRepository } from '../../../blocks/domain/repositories/vehicle-block.repository';
import type { AccessRequestRepository } from '../../../access-requests/domain/repositories/access-request.repository';
import type { DepartmentRepository } from '../../../departments/domain/repositories/department.repository';
import type { UserRepository } from '../../../users/domain/repositories/user.repository';
import type { UserCompanyRepository } from '../../../auth/domain/repositories/user-company.repository';
import type { GetAccessContextInputDto } from '../dto/get-access-context-input.dto';
import type {
  AccessContextDriverResponse,
  AccessContextDriversResponse,
  AccessContextOpenAccessResponse,
  AccessContextRequestResponse,
  AccessContextResponse,
} from '../dto/access-context-response';

/**
 * Contexto + veredito da entrada (ADR 0014 §2) — a ficha que a portaria
 * apresenta ao porteiro a partir da placa.
 *
 * Promove o agregado que `GET /qr-codes/:code` já devolvia (veículo +
 * departamento padrão + motoristas) a um lookup **por placa**, acrescentando
 * bloqueio ativo, solicitações da placa (com prazo das regras 38/39), acessos
 * abertos, ocupação do setor e um **veredito único** (ADR 0014 §3). O cliente
 * não recalcula regra alguma: exibe `verdict`/`reasons` e usa
 * `requiresRequest`/`requiresOverCapacity`/`isReentry` para montar o payload
 * do `POST /access/entry`.
 */
@Injectable()
export class GetAccessContextUseCase {
  private readonly logger = new Logger(GetAccessContextUseCase.name);

  /** Máximo de motoristas vinculados na ficha. */
  private static readonly LINKED_DRIVERS_LIMIT = 3;
  /** Máximo de sugestões (pessoas sem vínculo com o veículo). */
  private static readonly SUGGESTIONS_LIMIT = 3;
  /** Quantas pessoas buscar antes de descartar as já vinculadas. */
  private static readonly SUGGESTIONS_FETCH_LIMIT = 20;
  /** Últimas solicitações da placa exibidas na ficha (regra 48). */
  private static readonly REQUESTS_LIMIT = 5;

  constructor(
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: VehicleRepository,
    @Inject(VEHICLE_BLOCK_REPOSITORY)
    private readonly vehicleBlockRepository: VehicleBlockRepository,
    @Inject(VEHICLE_ACCESS_REPOSITORY)
    private readonly vehicleAccessRepository: VehicleAccessRepository,
    @Inject(VEHICLE_DEPARTMENT_REPOSITORY)
    private readonly vehicleDepartmentRepository: VehicleDepartmentRepository,
    @Inject(USER_VEHICLE_REPOSITORY)
    private readonly userVehicleRepository: UserVehicleRepository,
    @Inject(USER_COMPANY_REPOSITORY)
    private readonly userCompanyRepository: UserCompanyRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(ACCESS_REQUEST_REPOSITORY)
    private readonly accessRequestRepository: AccessRequestRepository,
    @Inject(DEPARTMENT_REPOSITORY)
    private readonly departmentRepository: DepartmentRepository,
  ) {}

  /**
   * Monta o contexto + veredito da placa na empresa do ator.
   *
   * @param actor Ator autenticado (porteiro — empresa da sessão).
   * @param input Placa, busca de motorista, setor e motorista escolhido.
   * @returns Ficha completa com o veredito da entrada.
   * @throws {BadRequestException} Placa inválida.
   * @throws {NotFoundException} Setor informado não encontrado.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: GetAccessContextInputDto,
  ): Promise<AccessContextResponse> {
    const plate = normalizePlate(input.plate);
    if (!isValidBrazilianPlate(plate)) {
      throw new BadRequestException('Placa inválida.');
    }
    const companyId = actor.companyId;

    const vehicle = await this.vehicleRepository.findByPlateAndCompanyId(
      plate,
      companyId,
    );

    // Bloqueio prevalece sobre tudo (regra 20). Sem veículo cadastrado, a
    // busca é por placa — a mesma chamada do `POST /access/entry`, que
    // aproveita para vincular o bloqueio pela placa (regra 19, idempotente).
    const block = vehicle
      ? await this.vehicleBlockRepository.findActiveByVehicleIdAndCompanyId(
          vehicle.id,
          companyId,
        )
      : await this.vehicleBlockRepository.findActiveByPlateAndCompanyId(
          plate,
          companyId,
        );

    const [departments, openAccesses] = await Promise.all([
      this.resolveDepartments(companyId, vehicle, input.departmentId),
      this.resolveOpenAccesses(companyId, plate, vehicle),
    ]);

    const [drivers, requests, capacity] = await Promise.all([
      this.resolveDrivers(companyId, vehicle, input),
      this.resolveRequests(companyId, plate),
      resolveCapacity(companyId, departments.selected, {
        vehicleAccessRepository: this.vehicleAccessRepository,
        departmentRepository: this.departmentRepository,
      }),
    ]);

    const freeSlot = hasFreeSlot(capacity.capacity, capacity.occupied);
    const activeRequest =
      requests.find(
        (request) =>
          request.status === AccessRequestStatus.PENDING ||
          request.status === AccessRequestStatus.IN_CONTACT,
      ) ?? null;
    const preAuthorizedRequest =
      requests.find((request) => request.entryAuthorized) ?? null;

    const reasons: AccessVerdictReason[] = [];

    if (block) {
      reasons.push(AccessVerdictReason.BLOCKED);
    }
    if (vehicle && !vehicle.isActive) {
      reasons.push(AccessVerdictReason.INACTIVE);
    }
    const overdue = Boolean(activeRequest?.isOverdue) && !preAuthorizedRequest;
    if (overdue) {
      reasons.push(AccessVerdictReason.REQUEST_OVERDUE);
    }
    if (activeRequest) {
      reasons.push(AccessVerdictReason.REQUEST_OPEN);
    }
    if (preAuthorizedRequest) {
      reasons.push(AccessVerdictReason.REQUEST_PRE_AUTHORIZED);
    }

    const requiresRequest = this.resolveExceptionReasons(
      reasons,
      vehicle,
      drivers,
      input.driverUserId ?? null,
      Boolean(activeRequest || preAuthorizedRequest),
    );

    const isReentry = openAccesses.length > 0;
    if (isReentry) {
      reasons.push(AccessVerdictReason.REENTRY);
    }

    const requiresOverCapacity = !freeSlot;
    if (requiresOverCapacity) {
      reasons.push(AccessVerdictReason.CAPACITY_FULL);
    }

    const verdict = this.resolveVerdict({
      blocked: Boolean(block),
      inactive: Boolean(vehicle && !vehicle.isActive),
      overdue,
      requiresRequest,
      requiresOverCapacity,
      isReentry,
    });

    const reusableRequestId = requiresRequest
      ? (activeRequest?.id ?? preAuthorizedRequest?.id ?? null)
      : null;

    return {
      plate,
      verdict,
      reasons: [...new Set(reasons)],
      requiresRequest,
      requiresOverCapacity,
      isReentry,
      reusableRequestId,
      vehicle: vehicle ? this.toVehicleResponse(vehicle) : null,
      block: block
        ? {
            id: block.id,
            reason: block.reason,
            blockType: block.blockType,
            blockedAt: block.blockedAt.toISOString(),
          }
        : null,
      department: {
        id: departments.selected?.id ?? null,
        name: departments.selected?.name ?? null,
        defaultId: departments.defaultDepartment?.id ?? null,
        defaultName: departments.defaultDepartment?.name ?? null,
        capacity: capacity.capacity,
        occupied: capacity.occupied,
        hasFreeSlot: freeSlot,
      },
      drivers,
      requests,
      openAccesses,
    };
  }

  /**
   * Decide se a entrada é uma **exceção** (exige solicitação) e registra os
   * motivos correspondentes.
   *
   * Regra de ouro: passe livre libera sem condutor (regra 3); veículo
   * cadastrado com motorista vinculado e `can_drive` libera (regra 4); o
   * restante exige solicitação — inclusive `can_drive = false`, tratado como
   * "não vinculado" (ADR 0014 §1).
   *
   * @param reasons Acumulador de motivos (mutado).
   * @param vehicle Veículo cadastrado (ou null).
   * @param drivers Motoristas vinculados e sugestões.
   * @param driverUserId Motorista escolhido na ficha (ou null).
   * @param hasExistingRequest Já existe solicitação (aberta/pré-autorizada)?
   * @returns `true` quando a entrada precisa criar/referenciar solicitação.
   */
  private resolveExceptionReasons(
    reasons: AccessVerdictReason[],
    vehicle: VehicleWithTypeEntity | null,
    drivers: AccessContextDriversResponse,
    driverUserId: string | null,
    hasExistingRequest: boolean,
  ): boolean {
    // Placa não cadastrada → sempre exceção (regra 5).
    if (!vehicle) {
      reasons.push(AccessVerdictReason.UNREGISTERED_VEHICLE);
      if (!hasExistingRequest) {
        reasons.push(AccessVerdictReason.UNREGISTERED_DRIVER);
      }
      return true;
    }

    // Passe livre libera direto, sem perguntar quem está dentro (regra 3).
    if (vehicle.freePass) {
      reasons.push(AccessVerdictReason.FREE_PASS);
      return false;
    }

    const selected = driverUserId
      ? (drivers.linked.find((driver) => driver.id === driverUserId) ?? null)
      : null;

    // Motorista escolhido na ficha: o veredito reflete **ele**.
    if (driverUserId) {
      if (selected?.canDrive) {
        reasons.push(AccessVerdictReason.DRIVER_ALLOWED);
        return false;
      }
      if (selected) {
        reasons.push(AccessVerdictReason.DRIVER_NOT_ALLOWED);
      }
      reasons.push(AccessVerdictReason.UNREGISTERED_DRIVER);
      return true;
    }

    // Sem motorista escolhido: melhor cenário com os vinculados.
    if (drivers.linked.some((driver) => driver.canDrive)) {
      reasons.push(AccessVerdictReason.DRIVER_ALLOWED);
      return false;
    }
    reasons.push(
      drivers.linked.length > 0
        ? AccessVerdictReason.DRIVER_NOT_ALLOWED
        : AccessVerdictReason.UNREGISTERED_DRIVER,
    );
    if (drivers.linked.length > 0) {
      reasons.push(AccessVerdictReason.UNREGISTERED_DRIVER);
    }
    return true;
  }

  /**
   * Aplica a precedência do veredito (ADR 0014 §3).
   *
   * @param state Condições avaliadas na ficha.
   * @returns Veredito único.
   */
  private resolveVerdict(state: {
    blocked: boolean;
    inactive: boolean;
    overdue: boolean;
    requiresRequest: boolean;
    requiresOverCapacity: boolean;
    isReentry: boolean;
  }): AccessVerdict {
    if (state.blocked) {
      return AccessVerdict.DENY_BLOCKED;
    }
    if (state.inactive) {
      return AccessVerdict.DENY_INACTIVE;
    }
    if (state.overdue) {
      return AccessVerdict.DENY_OVERDUE;
    }
    if (state.requiresRequest) {
      return AccessVerdict.ALLOW_WITH_REQUEST;
    }
    if (state.requiresOverCapacity) {
      return AccessVerdict.ALLOW_OVER_CAPACITY;
    }
    if (state.isReentry) {
      return AccessVerdict.ALLOW_FORCED_REENTRY;
    }
    return AccessVerdict.ALLOW;
  }

  /**
   * Resolve o setor considerado (informado ou padrão do veículo — regra 27) e
   * o setor padrão (para pré-seleção na ficha).
   *
   * @param companyId Empresa da sessão.
   * @param vehicle Veículo cadastrado (ou null).
   * @param departmentId Setor informado na consulta (opcional).
   * @returns Setor considerado e setor padrão.
   * @throws {NotFoundException} Setor informado não encontrado.
   */
  private async resolveDepartments(
    companyId: string,
    vehicle: VehicleWithTypeEntity | null,
    departmentId?: string,
  ): Promise<{
    selected: DepartmentEntity | null;
    defaultDepartment: DepartmentEntity | null;
  }> {
    let selected: DepartmentEntity | null = null;
    if (departmentId) {
      selected = await this.departmentRepository.findByIdAndCompanyId(
        departmentId,
        companyId,
      );
      if (!selected) {
        throw new NotFoundException('Departamento não encontrado.');
      }
    }

    let defaultDepartment: DepartmentEntity | null = null;
    if (vehicle) {
      const link = await this.resolveDefaultDepartmentLink(
        vehicle.id,
        companyId,
      );
      if (link) {
        defaultDepartment =
          (await this.departmentRepository.findByIdAndCompanyId(
            link.departmentId,
            companyId,
          )) ?? null;
      }
    }

    return { selected: selected ?? defaultDepartment, defaultDepartment };
  }

  /**
   * Resolve o vínculo ativo de departamento padrão do veículo.
   *
   * @param vehicleId Id do veículo.
   * @param companyId Empresa da sessão.
   * @returns Vínculo ativo (ou null).
   */
  private resolveDefaultDepartmentLink(
    vehicleId: string,
    companyId: string,
  ): Promise<VehicleDepartmentEntity | null> {
    return this.vehicleDepartmentRepository.findActiveByVehicleIdAndCompanyId(
      vehicleId,
      companyId,
    );
  }

  /**
   * Resolve os acessos abertos (`INSIDE`) da placa — reentrada (regra 9) e
   * conferência de saída (regra 8).
   *
   * @param companyId Empresa da sessão.
   * @param plate Placa normalizada.
   * @param vehicle Veículo cadastrado (ou null).
   * @returns Acessos abertos com o condutor resolvido.
   */
  private async resolveOpenAccesses(
    companyId: string,
    plate: string,
    vehicle: VehicleWithTypeEntity | null,
  ): Promise<AccessContextOpenAccessResponse[]> {
    const byVehicle = vehicle
      ? await this.vehicleAccessRepository.findOpenByVehicleIdAndCompanyId(
          vehicle.id,
          companyId,
        )
      : [];
    const byPlate =
      await this.vehicleAccessRepository.findOpenByTemporaryPlateAndCompanyId(
        plate,
        companyId,
      );

    const seen = new Set<string>();
    const open = [...byVehicle, ...byPlate].filter((access) => {
      if (seen.has(access.id)) {
        return false;
      }
      seen.add(access.id);
      return true;
    });

    return Promise.all(open.map((access) => this.toOpenAccess(access)));
  }

  /**
   * Mapeia um acesso aberto para a resposta, resolvendo o nome do condutor.
   *
   * @param access Acesso aberto.
   * @returns Acesso aberto no formato da ficha.
   */
  private async toOpenAccess(
    access: VehicleAccessEntity,
  ): Promise<AccessContextOpenAccessResponse> {
    let driverId: string | null = null;
    let driverName: string | null = null;
    if (access.driverUserId) {
      driverId = access.driverUserId;
      const user = await this.userRepository.findById(access.driverUserId);
      driverName = user?.name ?? null;
    } else if (access.temporaryDriverName) {
      driverName = access.temporaryDriverName;
    }

    return {
      id: access.id,
      entryAt: access.entryAt ? access.entryAt.toISOString() : null,
      driver: { id: driverId, name: driverName },
      departmentId: access.departmentId,
      overCapacity: access.overCapacity,
    };
  }

  /**
   * Resolve os motoristas da ficha: vinculados (até 3, primário primeiro) e
   * sugestões (até 3, somente com busca — pessoas sem vínculo com o veículo).
   *
   * @param companyId Empresa da sessão.
   * @param vehicle Veículo cadastrado (ou null).
   * @param input Busca e motorista escolhido.
   * @returns Motoristas vinculados e sugestões.
   */
  private async resolveDrivers(
    companyId: string,
    vehicle: VehicleWithTypeEntity | null,
    input: GetAccessContextInputDto,
  ): Promise<AccessContextDriversResponse> {
    const search = input.search?.trim() ?? '';
    const links = vehicle
      ? await this.userVehicleRepository.findByVehicleIdAndCompanyId(
          vehicle.id,
          companyId,
        )
      : [];
    const base = links
      .map((link) => this.toDriver(link, true))
      .sort(compareDrivers);

    let linked = search
      ? base.filter((driver) => matchesSearch(driver.name, search))
      : base;
    linked = linked.slice(0, GetAccessContextUseCase.LINKED_DRIVERS_LIMIT);

    // O motorista escolhido precisa estar na ficha (mesmo se a busca o
    // filtrou ou ele ficou fora do limite).
    if (
      input.driverUserId &&
      !linked.some((d) => d.id === input.driverUserId)
    ) {
      const selected = base.find((d) => d.id === input.driverUserId);
      if (selected) {
        linked = [selected, ...linked].slice(
          0,
          GetAccessContextUseCase.LINKED_DRIVERS_LIMIT,
        );
      }
    }

    let suggestions: AccessContextDriverResponse[] = [];
    if (search) {
      const { data } = await this.userCompanyRepository.listByCompanyId(
        companyId,
        {
          search,
          isActive: true,
          limit: GetAccessContextUseCase.SUGGESTIONS_FETCH_LIMIT,
          offset: 0,
        },
      );
      const linkedIds = new Set(base.map((driver) => driver.id));
      suggestions = data
        .filter((candidate) => !linkedIds.has(candidate.userId))
        .slice(0, GetAccessContextUseCase.SUGGESTIONS_LIMIT)
        .map((candidate) => ({
          id: candidate.userId,
          name: candidate.name,
          linked: false,
          canDrive: false,
          isPrimary: false,
        }));
    }

    return { linked, suggestions, search: search || null };
  }

  /**
   * Mapeia um vínculo motorista↔veículo para o item da ficha.
   *
   * @param link Vínculo com o motorista agregado.
   * @param linked Sempre `true` (os vínculos vêm da tabela de vínculo).
   * @returns Motorista no formato da ficha.
   */
  private toDriver(
    link: UserVehicleWithUserEntity,
    linked: boolean,
  ): AccessContextDriverResponse {
    return {
      id: link.user.id,
      name: link.user.name,
      linked,
      canDrive: link.canDrive,
      isPrimary: link.isPrimary,
    };
  }

  /**
   * Últimas solicitações da placa (qualquer status — regra 48) com o prazo
   * calculado na leitura (regras 38/39; ADR 0014 §4).
   *
   * @param companyId Empresa da sessão.
   * @param plate Placa normalizada.
   * @returns Solicitações recentes da placa.
   */
  private async resolveRequests(
    companyId: string,
    plate: string,
  ): Promise<AccessContextRequestResponse[]> {
    const { data } = await this.accessRequestRepository.list(companyId, {
      plate,
      limit: GetAccessContextUseCase.REQUESTS_LIMIT,
      offset: 0,
    });

    return data.map((request) => {
      const deadline = resolveAccessRequestDeadline(
        request.requestedAt,
        request.status,
      );
      return {
        id: request.id,
        type: request.type,
        status: request.status,
        requestedAt: request.requestedAt.toISOString(),
        entryAuthorized: request.entryAuthorized,
        driverName: request.payload?.driver?.name?.trim() || null,
        isOverdue: deadline.isOverdue,
        daysSinceRequest: deadline.daysSinceRequest,
        deadline: deadline.deadline ? deadline.deadline.toISOString() : null,
      };
    });
  }

  /**
   * Mapeia o veículo para o bloco da ficha (dados que o porteiro confere).
   *
   * @param vehicle Veículo com o tipo agregado.
   * @returns Veículo no formato da ficha.
   */
  private toVehicleResponse(vehicle: VehicleWithTypeEntity): {
    id: string;
    plate: string;
    model: string | null;
    color: string | null;
    vehicleTypeId: string;
    vehicleType: VehicleWithTypeEntity['vehicleType'];
    freePass: boolean;
    isActive: boolean;
    isBlocked: boolean;
  } {
    return {
      id: vehicle.id,
      plate: vehicle.plate,
      model: vehicle.model,
      color: vehicle.color,
      vehicleTypeId: vehicle.vehicleTypeId,
      vehicleType: vehicle.vehicleType,
      freePass: vehicle.freePass,
      isActive: vehicle.isActive,
      isBlocked: vehicle.isBlocked,
    };
  }
}

/**
 * Ordena motoristas da ficha: primário primeiro, depois nome ASC.
 *
 * @param a Motorista.
 * @param b Motorista.
 * @returns Comparação para o `sort`.
 */
function compareDrivers(
  a: AccessContextDriverResponse,
  b: AccessContextDriverResponse,
): number {
  if (a.isPrimary !== b.isPrimary) {
    return a.isPrimary ? -1 : 1;
  }
  return a.name.localeCompare(b.name);
}

/**
 * Casa um nome com o termo de busca (case-insensitive, sem acento).
 *
 * @param name Nome do motorista.
 * @param search Termo informado.
 * @returns `true` quando o nome contém o termo.
 */
function matchesSearch(name: string, search: string): boolean {
  return normalizeForSearch(name).includes(normalizeForSearch(search));
}

/**
 * Normaliza texto para comparação (lowercase + sem diacríticos).
 *
 * @param value Texto.
 * @returns Texto normalizado.
 */
function normalizeForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

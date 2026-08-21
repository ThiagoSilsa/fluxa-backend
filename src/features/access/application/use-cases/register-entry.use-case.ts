// NestJS
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

// Node
import { randomUUID } from 'crypto';

// Shared
import {
  isValidBrazilianPlate,
  normalizePlate,
} from '../../../../shared/utils/plate.util';

// Repositories (access)
import { VEHICLE_ACCESS_REPOSITORY } from '../../domain/repositories/vehicle-access.repository';

// Repositories (blocks)
import { ENTRY_DENIAL_REPOSITORY } from '../../../blocks/domain/repositories/entry-denial.repository';
import { VEHICLE_BLOCK_REPOSITORY } from '../../../blocks/domain/repositories/vehicle-block.repository';

// Repositories (access-requests)
import { ACCESS_REQUEST_REPOSITORY } from '../../../access-requests/domain/repositories/access-request.repository';

// Repositories (vehicles)
import { USER_VEHICLE_REPOSITORY } from '../../../vehicles/domain/repositories/user-vehicle.repository';
import { VEHICLE_DEPARTMENT_REPOSITORY } from '../../../vehicles/domain/repositories/vehicle-department.repository';
import { VEHICLE_REPOSITORY } from '../../../vehicles/domain/repositories/vehicle.repository';

// Repositories (departments/users)
import { DEPARTMENT_REPOSITORY } from '../../../departments/domain/repositories/department.repository';
import { USER_REPOSITORY } from '../../../users/domain/repositories/user.repository';

// Constants
import {
  MovementSource,
  SyncStatus,
} from '../../domain/constants/access.constant';
import {
  EntryDenialReason,
  SyncStatus as BlockSyncStatus,
} from '../../../blocks/domain/constants/block.constant';

// Mappers
import { toEntryDenialResponse } from '../../../blocks/application/utils/entry-denial-response.mapper';
import {
  toAccessResponse,
  toClosedAccessResponse,
  toMovementResponse,
} from '../utils/access-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { VehicleAccessRepository } from '../../domain/repositories/vehicle-access.repository';
import type { EntryDenialRepository } from '../../../blocks/domain/repositories/entry-denial.repository';
import type { VehicleBlockRepository } from '../../../blocks/domain/repositories/vehicle-block.repository';
import type { AccessRequestRepository } from '../../../access-requests/domain/repositories/access-request.repository';
import type { UserVehicleRepository } from '../../../vehicles/domain/repositories/user-vehicle.repository';
import type { VehicleDepartmentRepository } from '../../../vehicles/domain/repositories/vehicle-department.repository';
import type { VehicleRepository } from '../../../vehicles/domain/repositories/vehicle.repository';
import type { DepartmentRepository } from '../../../departments/domain/repositories/department.repository';
import type { UserRepository } from '../../../users/domain/repositories/user.repository';
import type { RegisterEntryInputDto } from '../dto/register-entry-input.dto';
import type {
  AccessEntryResponse,
  EntryDenialSummary,
} from '../dto/access-response';
import type { DepartmentEntity } from '../../../departments/domain/entities/department.entity';

/**
 * Registra a entrada de um veículo (REGISTER_ENTRY) — ADR 0010 §6.
 *
 * Ramos cobertos (todos implementados, sem TODO): veículo bloqueado → nega +
 * `entry_denial` automático (BLOCKED); veículo inativo → nega (OTHER);
 * veículo não cadastrado → exige `access_request` autorizada (UNREGISTERED
 * caso contrário); `free_pass` → libera sem condutor; condutor `can_drive`
 * ou temporário via solicitação; departamento (pré-seleciona o padrão do
 * veículo; vazio = vagas livres); vaga cheia → **409** exigindo
 * `overCapacity`; reentrada → encerra o acesso anterior com `forced_exit`
 * (nunca 2 INSIDE).
 */
@Injectable()
export class RegisterEntryUseCase {
  private readonly logger = new Logger(RegisterEntryUseCase.name);

  constructor(
    @Inject(VEHICLE_ACCESS_REPOSITORY)
    private readonly vehicleAccessRepository: VehicleAccessRepository,
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: VehicleRepository,
    @Inject(VEHICLE_BLOCK_REPOSITORY)
    private readonly vehicleBlockRepository: VehicleBlockRepository,
    @Inject(ENTRY_DENIAL_REPOSITORY)
    private readonly entryDenialRepository: EntryDenialRepository,
    @Inject(ACCESS_REQUEST_REPOSITORY)
    private readonly accessRequestRepository: AccessRequestRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(USER_VEHICLE_REPOSITORY)
    private readonly userVehicleRepository: UserVehicleRepository,
    @Inject(VEHICLE_DEPARTMENT_REPOSITORY)
    private readonly vehicleDepartmentRepository: VehicleDepartmentRepository,
    @Inject(DEPARTMENT_REPOSITORY)
    private readonly departmentRepository: DepartmentRepository,
  ) {}

  /**
   * Registra a entrada na empresa do ator.
   *
   * @param actor Ator autenticado (porteiro — empresa da sessão).
   * @param input Placa e dados da entrada.
   * @returns Entrada liberada (granted) ou impedimento registrado (denial).
   * @throws {BadRequestException} Placa inválida / condutor ausente.
   * @throws {NotFoundException} Departamento/condutor não encontrados.
   * @throws {ConflictException} Vaga cheia sem `overCapacity`.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: RegisterEntryInputDto,
  ): Promise<AccessEntryResponse> {
    const plate = normalizePlate(input.plate);
    if (!isValidBrazilianPlate(plate)) {
      throw new BadRequestException('Placa inválida.');
    }
    const companyId = actor.companyId;

    const vehicle = await this.vehicleRepository.findByPlateAndCompanyId(
      plate,
      companyId,
    );

    // 1. Bloqueio prevalece (regra 20) — nega + impedimento automático.
    const block = vehicle
      ? await this.vehicleBlockRepository.findActiveByVehicleIdAndCompanyId(
          vehicle.id,
          companyId,
        )
      : await this.vehicleBlockRepository.findActiveByPlateAndCompanyId(
          plate,
          companyId,
        );
    if (block) {
      const denial = await this.registerDenial(
        actor,
        plate,
        vehicle?.id ?? null,
        block.id,
        EntryDenialReason.BLOCKED,
        `Veículo bloqueado: ${block.reason}`,
      );
      return {
        granted: false,
        message: 'VEÍCULO PROIBIDO DE ENTRAR',
        denial,
      };
    }

    // 2. Veículo inativo → nega.
    if (vehicle && !vehicle.isActive) {
      const denial = await this.registerDenial(
        actor,
        plate,
        vehicle.id,
        null,
        EntryDenialReason.OTHER,
        'Veículo inativo.',
      );
      return { granted: false, message: 'Veículo inativo.', denial };
    }

    // 3. Condutor / autorização temporária (ADR 0010 §4).
    const driver = await this.resolveDriver(actor, plate, vehicle, input);
    if (driver.denial) {
      return {
        granted: false,
        message: driver.denialMessage ?? 'Entrada negada.',
        denial: driver.denial,
      };
    }

    // 4. Departamento (pré-seleciona o padrão do veículo; vazio = vagas livres).
    const department = await this.resolveDepartment(actor, vehicle, input);

    // 5. Capacidade — vaga cheia exige confirmação (overCapacity). Só há
    // restrição quando há capacidade configurada (regra 23: obrigatória).
    const capacity = await this.resolveCapacity(companyId, department);
    if (
      capacity.capacity > 0 &&
      capacity.occupied >= capacity.capacity &&
      !input.overCapacity
    ) {
      throw new ConflictException(
        'Vaga cheia. Confirme para liberar excedendo a capacidade (overCapacity).',
      );
    }

    // 6. Registra a entrada (transação — fecha reentrada, nunca 2 INSIDE).
    const result = await this.vehicleAccessRepository.createEntry({
      companyId,
      vehicleId: vehicle?.id ?? null,
      temporaryPlate: vehicle ? null : plate,
      plateSnapshot: plate,
      driverUserId: driver.driverUserId,
      temporaryDriverName: driver.temporaryDriverName,
      departmentId: department?.id ?? null,
      accessRequestId: driver.accessRequestId,
      overCapacity: input.overCapacity,
      source: MovementSource.PLATE,
      entranceId: null,
      doormanId: actor.id,
      syncStatus: SyncStatus.SYNCED,
      idempotencyKey: input.idempotencyKey ?? randomUUID(),
      occurredAt: new Date(),
    });

    return {
      granted: true,
      message: 'Entrada registrada.',
      access: toAccessResponse(result.access),
      movement: toMovementResponse(result.movement),
      previousClosed: result.previousClosed
        ? toClosedAccessResponse(
            result.previousClosed.access,
            result.previousClosed.movement,
          )
        : null,
    };
  }

  /**
   * Resolve o condutor (ou autorização temporária) conforme o cenário.
   *
   * Quando o acesso deve ser **negado** (condutor não autorizado, veículo não
   * cadastrado sem autorização), registra o `entry_denial` automaticamente e
   * devolve `denial` para o `execute` responder.
   *
   * @param actor Ator autenticado.
   * @param plate Placa normalizada.
   * @param vehicle Veículo (ou null se não cadastrado).
   * @param input Entrada do use case.
   * @returns Condutor/autorização resolvidos (ou denial registrado).
   */
  private async resolveDriver(
    actor: AuthenticatedUserEntity,
    plate: string,
    vehicle: Awaited<ReturnType<VehicleRepository['findByPlateAndCompanyId']>>,
    input: RegisterEntryInputDto,
  ): Promise<{
    driverUserId: string | null;
    temporaryDriverName: string | null;
    accessRequestId: string | null;
    denial?: EntryDenialSummary;
    denialMessage?: string;
  }> {
    if (vehicle) {
      // free_pass libera sem condutor (regra 3).
      if (vehicle.freePass) {
        return {
          driverUserId: null,
          temporaryDriverName: null,
          accessRequestId: null,
        };
      }

      // Solicitação autorizada → condutor temporário (ADR 0010 §4).
      if (input.accessRequestId) {
        const request = await this.accessRequestRepository.findByIdAndCompanyId(
          input.accessRequestId,
          actor.companyId,
        );
        if (!request || !request.entryAuthorized) {
          throw new BadRequestException(
            'Solicitação de acesso não autorizada para esta entrada.',
          );
        }
        const temporaryDriverName =
          input.temporaryDriverName?.trim() ||
          request.payload?.driver?.name?.trim() ||
          null;
        if (!temporaryDriverName) {
          throw new BadRequestException('Informe o condutor temporário.');
        }
        return {
          driverUserId: null,
          temporaryDriverName,
          accessRequestId: request.id,
        };
      }

      // Condutor identificado com can_drive (regra 4).
      if (input.driverUserId) {
        const user = await this.userRepository.findById(input.driverUserId);
        if (!user) {
          throw new NotFoundException('Condutor não encontrado.');
        }
        const link =
          await this.userVehicleRepository.findByUserIdAndVehicleIdAndCompanyId(
            user.id,
            vehicle.id,
            actor.companyId,
          );
        if (!link || !link.canDrive) {
          return {
            driverUserId: null,
            temporaryDriverName: null,
            accessRequestId: null,
            denial: await this.registerDenial(
              actor,
              plate,
              vehicle.id,
              null,
              EntryDenialReason.UNAUTHORIZED_DRIVER,
              'Condutor não autorizado a dirigir este veículo.',
            ),
            denialMessage: 'Condutor não autorizado.',
          };
        }
        return {
          driverUserId: user.id,
          temporaryDriverName: null,
          accessRequestId: null,
        };
      }

      throw new BadRequestException(
        'Selecione o condutor ou informe a solicitação autorizada.',
      );
    }

    // Veículo não cadastrado → exige solicitação autorizada (regra 5 / ADR §4).
    if (!input.accessRequestId) {
      return {
        driverUserId: null,
        temporaryDriverName: null,
        accessRequestId: null,
        denial: await this.registerDenial(
          actor,
          plate,
          null,
          null,
          EntryDenialReason.UNREGISTERED,
          'Veículo não cadastrado.',
        ),
        denialMessage: 'Veículo não cadastrado.',
      };
    }
    const request = await this.accessRequestRepository.findByIdAndCompanyId(
      input.accessRequestId,
      actor.companyId,
    );
    if (!request || !request.entryAuthorized) {
      return {
        driverUserId: null,
        temporaryDriverName: null,
        accessRequestId: null,
        denial: await this.registerDenial(
          actor,
          plate,
          null,
          null,
          EntryDenialReason.UNREGISTERED,
          'Veículo não cadastrado e sem autorização.',
        ),
        denialMessage: 'Veículo não cadastrado.',
      };
    }
    const temporaryDriverName =
      input.temporaryDriverName?.trim() ||
      request.payload?.driver?.name?.trim() ||
      null;
    if (!temporaryDriverName) {
      throw new BadRequestException('Informe o condutor temporário.');
    }
    return {
      driverUserId: null,
      temporaryDriverName,
      accessRequestId: request.id,
    };
  }

  /**
   * Resolve o departamento da entrada: o informado (validado) ou o padrão do
   * veículo (regra 27); vazio = vagas livres.
   *
   * @param actor Ator autenticado.
   * @param vehicle Veículo (ou null).
   * @param input Entrada do use case.
   * @returns Departamento (ou null).
   */
  private async resolveDepartment(
    actor: AuthenticatedUserEntity,
    vehicle: Awaited<ReturnType<VehicleRepository['findByPlateAndCompanyId']>>,
    input: RegisterEntryInputDto,
  ): Promise<DepartmentEntity | null> {
    if (input.departmentId) {
      const department = await this.departmentRepository.findByIdAndCompanyId(
        input.departmentId,
        actor.companyId,
      );
      if (!department) {
        throw new NotFoundException('Departamento não encontrado.');
      }
      return department;
    }
    if (vehicle) {
      const link =
        await this.vehicleDepartmentRepository.findActiveByVehicleIdAndCompanyId(
          vehicle.id,
          actor.companyId,
        );
      if (link) {
        return (
          (await this.departmentRepository.findByIdAndCompanyId(
            link.departmentId,
            actor.companyId,
          )) ?? null
        );
      }
    }
    return null;
  }

  /**
   * Resolve a capacidade/ocupação (regra 21/24): por departamento ou vagas
   * livres (soma dos departamentos ativos).
   *
   * @param companyId Empresa da sessão.
   * @param department Departamento da entrada (ou null).
   * @returns Ocupação e capacidade atuais.
   */
  private async resolveCapacity(
    companyId: string,
    department: DepartmentEntity | null,
  ): Promise<{ occupied: number; capacity: number }> {
    if (department) {
      const occupied =
        await this.vehicleAccessRepository.countInsideByDepartmentIdAndCompanyId(
          department.id,
          companyId,
        );
      return { occupied, capacity: department.parkingSpace };
    }
    const occupied =
      await this.vehicleAccessRepository.countInsideByCompanyId(companyId);
    const { data: departments } = await this.departmentRepository.list(
      companyId,
      { isActive: true, limit: 100, offset: 0 },
    );
    const capacity = departments.reduce((sum, d) => sum + d.parkingSpace, 0);
    return { occupied, capacity };
  }

  /**
   * Registra o impedimento (ledger `entry_denial` — ADR 0010 §3) e devolve o
   * resumo para o client exibir.
   *
   * @param actor Ator autenticado.
   * @param plate Placa normalizada.
   * @param vehicleId Veículo (ou null).
   * @param blockId Bloqueio que motivou (ou null).
   * @param reason Motivo do impedimento.
   * @param observation Observação.
   * @returns Resumo do impedimento.
   */
  private async registerDenial(
    actor: AuthenticatedUserEntity,
    plate: string,
    vehicleId: string | null,
    blockId: string | null,
    reason: EntryDenialReason,
    observation: string,
  ): Promise<EntryDenialSummary> {
    const denial = await this.entryDenialRepository.create({
      companyId: actor.companyId,
      vehicleId,
      plateSnapshot: plate,
      blockId,
      reason,
      observation,
      entranceId: null,
      doormanId: actor.id,
      occurredAt: new Date(),
      syncStatus: BlockSyncStatus.SYNCED,
      idempotencyKey: randomUUID(),
    });
    return toEntryDenialResponse(denial);
  }
}

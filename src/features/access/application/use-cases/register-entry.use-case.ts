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

// Constants
import { AccessRequestStatus } from '../../../access-requests/domain/constants/access-request.constant';

// Use cases (access-requests — a exceção documentada cria a solicitação na
// mesma operação: ADR 0014 §5)
import { CreateAccessRequestUseCase } from '../../../access-requests/application/use-cases/create-access-request.use-case';

// DTOs (access-requests)
import { CreateAccessRequestInputDto } from '../../../access-requests/application/dto/create-access-request-input.dto';

// Repositories (vehicles)
import { USER_VEHICLE_REPOSITORY } from '../../../vehicles/domain/repositories/user-vehicle.repository';
import { VEHICLE_DEPARTMENT_REPOSITORY } from '../../../vehicles/domain/repositories/vehicle-department.repository';
import { VEHICLE_REPOSITORY } from '../../../vehicles/domain/repositories/vehicle.repository';

// Repositories (departments/users)
import { DEPARTMENT_REPOSITORY } from '../../../departments/domain/repositories/department.repository';
import { USER_REPOSITORY } from '../../../users/domain/repositories/user.repository';

// Repositories (entrances — M4)
import { ENTRANCE_REPOSITORY } from '../../../entrances/domain/repositories/entrance.repository';

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
import { resolveCapacity } from '../utils/resolve-capacity.util';
import { resolveAccessRequestDeadline } from '../../../access-requests/application/utils/access-request-deadline.util';
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
import type { AccessRequestEntity } from '../../../access-requests/domain/entities/access-request.entity';
import type { UserVehicleRepository } from '../../../vehicles/domain/repositories/user-vehicle.repository';
import type { VehicleDepartmentRepository } from '../../../vehicles/domain/repositories/vehicle-department.repository';
import type { VehicleRepository } from '../../../vehicles/domain/repositories/vehicle.repository';
import type { DepartmentRepository } from '../../../departments/domain/repositories/department.repository';
import type { UserRepository } from '../../../users/domain/repositories/user.repository';
import type { EntranceRepository } from '../../../entrances/domain/repositories/entrance.repository';
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

  /**
   * Origens aceitas do client (M4) — `WEB`/`INITIAL` são internos do servidor
   * e rejeitados aqui (400).
   */
  private static readonly CLIENT_SOURCES = [
    MovementSource.PLATE,
    MovementSource.QRCODE,
    MovementSource.APP,
    MovementSource.MANUAL,
  ];

  constructor(
    @Inject(VEHICLE_ACCESS_REPOSITORY)
    private readonly vehicleAccessRepository: VehicleAccessRepository,
    @Inject(ENTRANCE_REPOSITORY)
    private readonly entranceRepository: EntranceRepository,
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
    private readonly createAccessRequestUseCase: CreateAccessRequestUseCase,
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

    // Referenciar uma solicitação existente e criar outra são caminhos
    // mutuamente exclusivos (ADR 0014 §5).
    if (input.request && input.accessRequestId) {
      throw new BadRequestException(
        'Informe a solicitação existente ou os dados da nova, não ambos.',
      );
    }

    const companyId = actor.companyId;

    // M4 — dedup de retry/sync: mesma chave de idempotência → devolve o
    // resultado já persistido (não duplica visita/movimento no offline).
    if (input.idempotencyKey) {
      const existing =
        await this.vehicleAccessRepository.findMovementByIdempotencyKeyAndCompanyId(
          input.idempotencyKey,
          companyId,
        );
      if (existing?.accessId) {
        const access = await this.vehicleAccessRepository.findByIdAndCompanyId(
          existing.accessId,
          companyId,
        );
        if (access) {
          return {
            granted: true,
            message: 'Entrada já registrada.',
            access: toAccessResponse(access),
            movement: toMovementResponse(existing),
          };
        }
      }
    }

    // M4 — origem aceita do client (QRCODE/APP/MANUAL; default PLATE).
    const source = input.source ?? MovementSource.PLATE;
    if (!RegisterEntryUseCase.CLIENT_SOURCES.includes(source)) {
      throw new BadRequestException('Origem do registro inválida.');
    }

    // M4 — portaria do device: deve existir e estar ativa na empresa.
    let entranceId: string | null = null;
    if (input.entranceId) {
      const entrance = await this.entranceRepository.findByIdAndCompanyId(
        input.entranceId,
        companyId,
      );
      if (!entrance) {
        throw new NotFoundException('Portaria não encontrada.');
      }
      if (!entrance.isActive) {
        throw new BadRequestException('Portaria inativa.');
      }
      entranceId = entrance.id;
    }

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
        entranceId,
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
        entranceId,
      );
      return { granted: false, message: 'Veículo inativo.', denial };
    }

    // 3. Condutor / solicitação da entrada (Modelo B — ADR 0014 §1).
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
    const capacity = await resolveCapacity(companyId, department, {
      vehicleAccessRepository: this.vehicleAccessRepository,
      departmentRepository: this.departmentRepository,
    });
    if (
      capacity.capacity > 0 &&
      capacity.occupied >= capacity.capacity &&
      !input.overCapacity
    ) {
      throw new ConflictException(
        'Vaga cheia. Confirme para liberar excedendo a capacidade (overCapacity).',
      );
    }

    // 6. Exceção documentada: a solicitação é criada **antes** do registro, na
    // mesma operação (ADR 0014 §5). Se a entrada falhar (ex.: vaga cheia), ela
    // é revertida para não deixar cadastro aberto órfão travando a placa.
    let createdRequestId: string | null = null;
    try {
      if (input.request) {
        const created = await this.createAccessRequestUseCase.execute(
          actor,
          new CreateAccessRequestInputDto(
            plate,
            input.request.type,
            vehicle?.id,
            driver.driverUserId ?? undefined,
            undefined,
            input.request.contactPhone,
            input.request.departmentId,
            input.request.payload,
            input.request.userType,
          ),
        );
        createdRequestId = created.id;
      }

      // 7. Registra a entrada (transação — fecha reentrada, nunca 2 INSIDE).
      const result = await this.vehicleAccessRepository.createEntry({
        companyId,
        vehicleId: vehicle?.id ?? null,
        temporaryPlate: vehicle ? null : plate,
        plateSnapshot: plate,
        driverUserId: driver.driverUserId,
        temporaryDriverName: driver.temporaryDriverName,
        departmentId: department?.id ?? null,
        accessRequestId: createdRequestId ?? driver.accessRequestId,
        overCapacity: input.overCapacity,
        source,
        entranceId,
        doormanId: actor.id,
        syncStatus: SyncStatus.SYNCED,
        idempotencyKey: input.idempotencyKey ?? randomUUID(),
        occurredAt: new Date(),
      });

      return {
        granted: true,
        message: input.request
          ? 'Entrada registrada com solicitação.'
          : 'Entrada registrada.',
        access: toAccessResponse(result.access),
        movement: toMovementResponse(result.movement),
        previousClosed: result.previousClosed
          ? toClosedAccessResponse(
              result.previousClosed.access,
              result.previousClosed.movement,
            )
          : null,
      };
    } catch (error) {
      if (createdRequestId) {
        await this.revertCreatedRequest(actor, createdRequestId);
      }
      throw error;
    }
  }

  /**
   * Reverte a solicitação criada junto com a entrada quando o registro falha
   * (ex.: vaga cheia). Marca `CANCELLED` em vez de apagar — a solicitação tem
   * `status_history` — e libera o unique parcial da placa (`PENDING` /
   * `IN_CONTACT`), permitindo nova tentativa. Best-effort: nunca mascara o
   * erro original.
   *
   * @param actor Ator autenticado.
   * @param requestId Id da solicitação criada na operação.
   */
  private async revertCreatedRequest(
    actor: AuthenticatedUserEntity,
    requestId: string,
  ): Promise<void> {
    try {
      await this.accessRequestRepository.updateStatusByIdAndCompanyId(
        requestId,
        actor.companyId,
        {
          status: AccessRequestStatus.CANCELLED,
          observation:
            'Entrada não registrada — solicitação revertida automaticamente.',
        },
      );
    } catch (error) {
      this.logger.error(
        `Falha ao reverter a solicitação ${requestId}: ${String(error)}`,
      );
    }
  }

  /**
   * Resolve o condutor e a solicitação da entrada (Modelo B — ADR 0014 §1).
   *
   * A `access_request` **documenta a exceção**, não autoriza a entrada: o
   * porteiro pode liberar com uma solicitação aberta (`PENDING`/`IN_CONTACT`)
   * ou registrada (`REGISTERED`), ou criar uma nova junto com a entrada
   * (bloco `request`). Quando o acesso é negado (bloqueio, veículo não
   * cadastrado sem solicitação, prazo vencido), o `entry_denial` é registrado
   * automaticamente com a portaria do device.
   *
   * @param actor Ator autenticado.
   * @param plate Placa normalizada.
   * @param vehicle Veículo (ou null se não cadastrado).
   * @param input Entrada do use case.
   * @returns Condutor/solicitação resolvidos (ou denial registrado).
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
      // free_pass libera sem condutor (regra 3) e não pergunta nada.
      if (vehicle.freePass) {
        return {
          driverUserId: null,
          temporaryDriverName: null,
          accessRequestId: null,
        };
      }

      if (input.accessRequestId) {
        return this.resolveExistingRequest(actor, plate, vehicle.id, input);
      }

      // Exceção documentada por uma solicitação nova (bloco `request`).
      if (input.request) {
        return this.resolveExceptionDriver(input);
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
              input.entranceId ?? null,
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
        'Selecione o condutor ou informe a solicitação da entrada.',
      );
    }

    // Veículo não cadastrado → exige solicitação (existente ou nova — regra 5).
    if (input.accessRequestId) {
      return this.resolveExistingRequest(actor, plate, null, input);
    }
    if (input.request) {
      return this.resolveExceptionDriver(input);
    }
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
        input.entranceId ?? null,
      ),
      denialMessage: 'Veículo não cadastrado.',
    };
  }

  /**
   * Resolve a entrada a partir de uma solicitação **existente** (Modelo B).
   *
   * - `REGISTERED` → usa os cadastros resolvidos no aceite (`resolvedUserId`);
   * - `PENDING`/`IN_CONTACT` → entrada com o condutor conhecido (registrado ou
   *   temporário); vencida (regras 38/39) e sem pré-autorização → **nega** com
   *   `OVERDUE`;
   * - demais status → 409 (a solicitação não serve para liberar entrada).
   *
   * @param actor Ator autenticado.
   * @param plate Placa normalizada da entrada.
   * @param vehicleId Veículo da entrada (null se a placa não é cadastrada).
   * @param input Entrada do use case.
   * @returns Condutor/solicitação resolvidos (ou denial registrado).
   * @throws {NotFoundException} Solicitação inexistente/não pertencente.
   * @throws {BadRequestException} Solicitação de outra placa.
   * @throws {ConflictException} Status que não libera entrada.
   */
  private async resolveExistingRequest(
    actor: AuthenticatedUserEntity,
    plate: string,
    vehicleId: string | null,
    input: RegisterEntryInputDto,
  ): Promise<{
    driverUserId: string | null;
    temporaryDriverName: string | null;
    accessRequestId: string | null;
    denial?: EntryDenialSummary;
    denialMessage?: string;
  }> {
    const request = await this.accessRequestRepository.findByIdAndCompanyId(
      input.accessRequestId as string,
      actor.companyId,
    );
    if (!request) {
      throw new NotFoundException('Solicitação de acesso não encontrada.');
    }
    if (request.plate !== plate) {
      throw new BadRequestException(
        'A solicitação informada não é desta placa.',
      );
    }

    if (request.status === AccessRequestStatus.REGISTERED) {
      return this.resolveRegisteredRequest(request, input);
    }

    if (
      request.status !== AccessRequestStatus.PENDING &&
      request.status !== AccessRequestStatus.IN_CONTACT
    ) {
      throw new ConflictException(
        'A solicitação informada não está aberta nem registrada.',
      );
    }

    // Prazo (regras 38/39): a pré-autorização da administração sobrepõe a
    // negativa (ADR 0014 §1).
    const { isOverdue } = resolveAccessRequestDeadline(
      request.requestedAt,
      request.status,
    );
    if (isOverdue && !request.entryAuthorized) {
      return {
        driverUserId: null,
        temporaryDriverName: null,
        accessRequestId: null,
        denial: await this.registerDenial(
          actor,
          plate,
          vehicleId,
          null,
          EntryDenialReason.OVERDUE,
          'Solicitação de acesso vencida.',
          input.entranceId ?? null,
        ),
        denialMessage: 'Solicitação de acesso vencida.',
      };
    }

    const driver = await this.resolveKnownDriver(input, request);
    return { ...driver, accessRequestId: request.id };
  }

  /**
   * Resolve o condutor de uma solicitação **registrada** (aceite já criou os
   * cadastros e o vínculo — regras 41/42/44).
   *
   * @param request Solicitação registrada.
   * @param input Entrada do use case.
   * @returns Condutor resolvido.
   * @throws {NotFoundException} Condutor resolvido não encontrado.
   * @throws {BadRequestException} Sem condutor identificável.
   */
  private async resolveRegisteredRequest(
    request: AccessRequestEntity,
    input: RegisterEntryInputDto,
  ): Promise<{
    driverUserId: string | null;
    temporaryDriverName: string | null;
    accessRequestId: string | null;
  }> {
    const resolvedUserId = request.resolvedUserId ?? input.driverUserId ?? null;
    if (resolvedUserId) {
      const user = await this.userRepository.findById(resolvedUserId);
      if (!user) {
        throw new NotFoundException('Condutor não encontrado.');
      }
      return {
        driverUserId: user.id,
        temporaryDriverName: null,
        accessRequestId: request.id,
      };
    }
    const temporaryDriverName =
      input.temporaryDriverName?.trim() ||
      request.payload?.driver?.name?.trim() ||
      null;
    if (!temporaryDriverName) {
      throw new BadRequestException('Informe o condutor da entrada.');
    }
    return {
      driverUserId: null,
      temporaryDriverName,
      accessRequestId: request.id,
    };
  }

  /**
   * Resolve o condutor de uma **exceção documentada** (bloco `request` —
   * ADR 0014 §1/§5): o porteiro é a autoridade da entrada, então o condutor
   * pode ser alguém ainda **sem vínculo** com o veículo — o aceite formaliza
   * depois (regra 41). O nome temporário cobre o motorista que será criado
   * (`NEW_USER`/`BOTH`).
   *
   * @param input Entrada do use case.
   * @returns Condutor resolvido.
   * @throws {NotFoundException} Condutor informado não encontrado.
   * @throws {BadRequestException} Sem condutor identificável.
   */
  private async resolveExceptionDriver(input: RegisterEntryInputDto): Promise<{
    driverUserId: string | null;
    temporaryDriverName: string | null;
    accessRequestId: string | null;
  }> {
    if (input.driverUserId) {
      const user = await this.userRepository.findById(input.driverUserId);
      if (!user) {
        throw new NotFoundException('Condutor não encontrado.');
      }
      return {
        driverUserId: user.id,
        temporaryDriverName: null,
        accessRequestId: null,
      };
    }
    const temporaryDriverName =
      input.temporaryDriverName?.trim() ||
      input.request?.payload?.driver?.name?.trim() ||
      null;
    if (!temporaryDriverName) {
      throw new BadRequestException(
        'Informe o condutor da entrada com solicitação.',
      );
    }
    return {
      driverUserId: null,
      temporaryDriverName,
      accessRequestId: null,
    };
  }

  /**
   * Resolve o condutor conhecido de uma solicitação aberta: a pessoa
   * informada (registrada) ou o nome temporário do `payload`.
   *
   * @param input Entrada do use case.
   * @param request Solicitação aberta.
   * @returns Condutor resolvido (sem o vínculo da solicitação).
   * @throws {NotFoundException} Condutor informado não encontrado.
   * @throws {BadRequestException} Sem condutor identificável.
   */
  private async resolveKnownDriver(
    input: RegisterEntryInputDto,
    request: AccessRequestEntity,
  ): Promise<{
    driverUserId: string | null;
    temporaryDriverName: string | null;
    accessRequestId: string | null;
  }> {
    if (input.driverUserId) {
      const user = await this.userRepository.findById(input.driverUserId);
      if (!user) {
        throw new NotFoundException('Condutor não encontrado.');
      }
      return {
        driverUserId: user.id,
        temporaryDriverName: null,
        accessRequestId: request.id,
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
   * Registra o impedimento (ledger `entry_denial` — ADR 0010 §3) e devolve o
   * resumo para o client exibir.
   *
   * @param actor Ator autenticado.
   * @param plate Placa normalizada.
   * @param vehicleId Veículo (ou null).
   * @param blockId Bloqueio que motivou (ou null).
   * @param reason Motivo do impedimento.
   * @param observation Observação.
   * @param entranceId Portaria do device que registrou (null na web).
   * @returns Resumo do impedimento.
   */
  private async registerDenial(
    actor: AuthenticatedUserEntity,
    plate: string,
    vehicleId: string | null,
    blockId: string | null,
    reason: EntryDenialReason,
    observation: string,
    entranceId: string | null,
  ): Promise<EntryDenialSummary> {
    const denial = await this.entryDenialRepository.create({
      companyId: actor.companyId,
      vehicleId,
      plateSnapshot: plate,
      blockId,
      reason,
      observation,
      entranceId,
      doormanId: actor.id,
      occurredAt: new Date(),
      syncStatus: BlockSyncStatus.SYNCED,
      idempotencyKey: randomUUID(),
    });
    return toEntryDenialResponse(denial);
  }
}

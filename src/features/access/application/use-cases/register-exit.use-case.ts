// NestJS
import {
  BadRequestException,
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

// Repositories (vehicles/users)
import { VEHICLE_REPOSITORY } from '../../../vehicles/domain/repositories/vehicle.repository';
import { USER_REPOSITORY } from '../../../users/domain/repositories/user.repository';

// Repositories (entrances — M4)
import { ENTRANCE_REPOSITORY } from '../../../entrances/domain/repositories/entrance.repository';

// Constants
import {
  AccessStatus,
  MovementSource,
  SyncStatus,
} from '../../domain/constants/access.constant';

// Mappers
import { toClosedAccessResponse } from '../utils/access-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { VehicleAccessRepository } from '../../domain/repositories/vehicle-access.repository';
import type { VehicleRepository } from '../../../vehicles/domain/repositories/vehicle.repository';
import type { UserRepository } from '../../../users/domain/repositories/user.repository';
import type { EntranceRepository } from '../../../entrances/domain/repositories/entrance.repository';
import type { RegisterExitInputDto } from '../dto/register-exit-input.dto';
import type { AccessExitResponse } from '../dto/access-response';

/**
 * Registra a saída de um veículo (REGISTER_EXIT) — ADR 0010 §6.
 *
 * Encerra **todos** os acessos `INSIDE` abertos do veículo (por `vehicle_id`
 * ou placa temporária — regra 10) gerando os movimentos EXIT. Sem entrada
 * registrada → **NO_EXIT** (regra 11): cria `vehicle_access` NO_EXIT + EXIT
 * com o passageiro (ou sem, se `free_pass`).
 */
@Injectable()
export class RegisterExitUseCase {
  private readonly logger = new Logger(RegisterExitUseCase.name);

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
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

  /**
   * Registra a saída na empresa do ator.
   *
   * @param actor Ator autenticado (porteiro — empresa da sessão).
   * @param input Placa e dados do passageiro (NO_EXIT).
   * @returns Acessos encerrados (e NO_EXIT quando não havia entrada).
   * @throws {BadRequestException} Placa inválida / NO_EXIT sem passageiro.
   * @throws {NotFoundException} Passageiro não encontrado.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: RegisterExitInputDto,
  ): Promise<AccessExitResponse> {
    const plate = normalizePlate(input.plate);
    if (!isValidBrazilianPlate(plate)) {
      throw new BadRequestException('Placa inválida.');
    }
    const companyId = actor.companyId;

    // M4 — dedup de retry/sync: mesma chave de idempotência → devolve o
    // resultado já persistido (não duplica encerramento/movimento).
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
          if (access.status === AccessStatus.NO_EXIT) {
            return {
              closedAccesses: [],
              noExit: toClosedAccessResponse(access, existing),
            };
          }
          return {
            closedAccesses: [toClosedAccessResponse(access, existing)],
            noExit: null,
          };
        }
      }
    }

    // M4 — origem aceita do client (QRCODE/APP/MANUAL; default PLATE).
    const source = input.source ?? MovementSource.PLATE;
    if (!RegisterExitUseCase.CLIENT_SOURCES.includes(source)) {
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

    // Encerra todos os INSIDE abertos (veículo cadastrado + placa temporária).
    const open = await this.findOpen(companyId, vehicle, plate);
    if (open.length > 0) {
      const closed =
        await this.vehicleAccessRepository.closeOpenAndCreateExitMovements({
          companyId,
          accessIds: open.map((access) => access.id),
          plateSnapshot: plate,
          source,
          entranceId,
          doormanId: actor.id,
          syncStatus: SyncStatus.SYNCED,
          idempotencyKey: input.idempotencyKey,
          occurredAt: new Date(),
        });
      return {
        closedAccesses: closed.map(({ access, movement }) =>
          toClosedAccessResponse(access, movement),
        ),
        noExit: null,
      };
    }

    // NO_EXIT (regra 11) — exige passageiro exceto em free_pass.
    const hasPassenger =
      Boolean(input.driverUserId) || Boolean(input.temporaryDriverName?.trim());
    if (!vehicle?.freePass && !hasPassenger) {
      throw new BadRequestException(
        'Informe o passageiro para registrar a saída sem entrada (NO_EXIT).',
      );
    }
    if (input.driverUserId) {
      const user = await this.userRepository.findById(input.driverUserId);
      if (!user) {
        throw new NotFoundException('Passageiro não encontrado.');
      }
    }

    const noExit = await this.vehicleAccessRepository.createNoExit({
      companyId,
      vehicleId: vehicle?.id ?? null,
      temporaryPlate: vehicle ? null : plate,
      driverUserId: input.driverUserId ?? null,
      temporaryDriverName: input.temporaryDriverName?.trim() || null,
      source,
      entranceId,
      doormanId: actor.id,
      syncStatus: SyncStatus.SYNCED,
      idempotencyKey: input.idempotencyKey ?? randomUUID(),
      occurredAt: new Date(),
    });

    return {
      closedAccesses: [],
      noExit: toClosedAccessResponse(noExit.access, noExit.movement),
    };
  }

  /**
   * Lista os acessos abertos do veículo (cadastrado) e da placa temporária,
   * sem duplicar.
   *
   * @param companyId Empresa da sessão.
   * @param vehicle Veículo (ou null).
   * @param plate Placa normalizada.
   * @returns Acessos INSIDE abertos.
   */
  private async findOpen(
    companyId: string,
    vehicle: Awaited<ReturnType<VehicleRepository['findByPlateAndCompanyId']>>,
    plate: string,
  ) {
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
    const merged = [...byVehicle, ...byPlate].filter((access) => {
      if (seen.has(access.id)) {
        return false;
      }
      seen.add(access.id);
      return true;
    });
    return merged;
  }
}

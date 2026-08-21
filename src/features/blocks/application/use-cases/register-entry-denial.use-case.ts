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
import { normalizePlate } from '../../../../shared/utils/plate.util';

// Repositories
import { ENTRY_DENIAL_REPOSITORY } from '../../domain/repositories/entry-denial.repository';
import { VEHICLE_BLOCK_REPOSITORY } from '../../domain/repositories/vehicle-block.repository';
import { VEHICLE_REPOSITORY } from '../../../vehicles/domain/repositories/vehicle.repository';

// Constants
import { SyncStatus } from '../../domain/constants/block.constant';

// Mapper
import { toEntryDenialResponse } from '../utils/entry-denial-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { EntryDenialRepository } from '../../domain/repositories/entry-denial.repository';
import type { VehicleBlockRepository } from '../../domain/repositories/vehicle-block.repository';
import type { VehicleRepository } from '../../../vehicles/domain/repositories/vehicle.repository';
import type { RegisterEntryDenialInputDto } from '../dto/register-entry-denial-input.dto';
import type { EntryDenialResponse } from '../dto/entry-denial-response';

/**
 * Registra um impedimento de entrada (ledger `entry_denial`, append-only).
 *
 * No access core (M3) este use case é chamado **automaticamente** pelo
 * endpoint de entrada ao negar (ADR 0010 §3); aqui também é exposto como
 * endpoint manual (`REGISTER_DENIAL`). `doorman_id` = ator, `occurred_at` =
 * agora, `sync_status = SYNCED` (web), `idempotency_key` gerada no servidor.
 */
@Injectable()
export class RegisterEntryDenialUseCase {
  private readonly logger = new Logger(RegisterEntryDenialUseCase.name);

  constructor(
    @Inject(ENTRY_DENIAL_REPOSITORY)
    private readonly entryDenialRepository: EntryDenialRepository,
    @Inject(VEHICLE_BLOCK_REPOSITORY)
    private readonly vehicleBlockRepository: VehicleBlockRepository,
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: VehicleRepository,
  ) {}

  /**
   * Registra o impedimento na empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Placa, motivo e dados opcionais.
   * @returns Impedimento registrado.
   * @throws {BadRequestException} Placa vazia.
   * @throws {NotFoundException} Bloqueio informado não existe na empresa.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: RegisterEntryDenialInputDto,
  ): Promise<EntryDenialResponse> {
    const plate = normalizePlate(input.plate);
    if (!plate || plate.length > 10) {
      throw new BadRequestException('Placa inválida.');
    }

    // Valida o bloqueio que motivou (se informado) — mesmo tenant.
    if (input.blockId) {
      const block = await this.vehicleBlockRepository.findByIdAndCompanyId(
        input.blockId,
        actor.companyId,
      );
      if (!block) {
        throw new NotFoundException('Bloqueio não encontrado.');
      }
    }

    // Resolve o veículo (cadastrado) para preencher vehicle_id.
    const vehicle = await this.vehicleRepository.findByPlateAndCompanyId(
      plate,
      actor.companyId,
    );

    const denial = await this.entryDenialRepository.create({
      companyId: actor.companyId,
      vehicleId: input.vehicleId ?? vehicle?.id ?? null,
      plateSnapshot: plate,
      blockId: input.blockId ?? null,
      reason: input.reason,
      observation: input.observation?.trim() || null,
      // Sem vínculo de portaria aqui: no access core (M3) o impedimento
      // automático carrega o entrance_id do endpoint de entrada.
      entranceId: null,
      doormanId: actor.id,
      occurredAt: new Date(),
      syncStatus: SyncStatus.SYNCED,
      idempotencyKey: randomUUID(),
    });

    return toEntryDenialResponse(denial);
  }
}

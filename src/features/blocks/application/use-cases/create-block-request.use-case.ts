// NestJS
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';

// Node
import { randomUUID } from 'crypto';

// Shared
import { normalizePlate } from '../../../../shared/utils/plate.util';

// Repositories
import { BLOCK_REQUEST_REPOSITORY } from '../../domain/repositories/block-request.repository';
import { VEHICLE_REPOSITORY } from '../../../vehicles/domain/repositories/vehicle.repository';

// Constants
import { SyncStatus } from '../../domain/constants/block.constant';

// Mapper
import { toBlockRequestResponse } from '../utils/block-request-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { BlockRequestRepository } from '../../domain/repositories/block-request.repository';
import type { VehicleRepository } from '../../../vehicles/domain/repositories/vehicle.repository';
import type { CreateBlockRequestInputDto } from '../dto/create-block-request-input.dto';
import type { BlockRequestResponse } from '../dto/block-request-response';

/**
 * Cria uma solicitação de bloqueio pelo porteiro (`block_request`, PENDING).
 *
 * Solicitação **pendente** duplicada da mesma placa → **409** (unique
 * parcial). Aprovação/rejeição são exclusivas da administração.
 */
@Injectable()
export class CreateBlockRequestUseCase {
  private readonly logger = new Logger(CreateBlockRequestUseCase.name);

  constructor(
    @Inject(BLOCK_REQUEST_REPOSITORY)
    private readonly blockRequestRepository: BlockRequestRepository,
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: VehicleRepository,
  ) {}

  /**
   * Cria a solicitação de bloqueio na empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Placa e motivo.
   * @returns Solicitação criada (PENDING).
   * @throws {BadRequestException} Placa ou motivo vazios.
   * @throws {ConflictException} Já existe solicitação pendente da placa.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: CreateBlockRequestInputDto,
  ): Promise<BlockRequestResponse> {
    const plate = normalizePlate(input.plate);
    if (!plate || plate.length > 10) {
      throw new BadRequestException('Placa inválida.');
    }
    const reason = input.reason.trim();
    if (!reason) {
      throw new BadRequestException('O motivo é obrigatório.');
    }

    const pending =
      await this.blockRequestRepository.findPendingByPlateAndCompanyId(
        plate,
        actor.companyId,
      );
    if (pending) {
      throw new ConflictException(
        'Já existe uma solicitação de bloqueio pendente para esta placa.',
      );
    }

    const vehicle = await this.vehicleRepository.findByPlateAndCompanyId(
      plate,
      actor.companyId,
    );

    const request = await this.blockRequestRepository.create({
      companyId: actor.companyId,
      vehicleId: vehicle?.id ?? null,
      plate,
      reason,
      requestedBy: actor.id,
      syncStatus: SyncStatus.SYNCED,
      idempotencyKey: randomUUID(),
    });

    return toBlockRequestResponse(
      request,
      { id: actor.id, name: actor.name },
      null,
    );
  }
}

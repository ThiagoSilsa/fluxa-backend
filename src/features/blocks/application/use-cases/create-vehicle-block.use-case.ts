// NestJS
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';

// Shared
import { normalizePlate } from '../../../../shared/utils/plate.util';

// Repositories
import { VEHICLE_BLOCK_REPOSITORY } from '../../domain/repositories/vehicle-block.repository';
import { VEHICLE_REPOSITORY } from '../../../vehicles/domain/repositories/vehicle.repository';

// Constants
import { VehicleBlockType } from '../../domain/constants/block.constant';

// Mapper
import { toBlockResponse } from '../utils/block-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { VehicleBlockRepository } from '../../domain/repositories/vehicle-block.repository';
import type { VehicleRepository } from '../../../vehicles/domain/repositories/vehicle.repository';
import type { CreateBlockInputDto } from '../dto/create-block-input.dto';
import type { BlockResponse } from '../dto/block-response';

/**
 * Cria um bloqueio de veículo na empresa da sessão (`MANUAL`).
 *
 * O `is_blocked` do veículo é setado `true` na mesma transação (ADR 0010 §2 —
 * este repositório é o dono da manutenção). Bloqueio por placa funciona para
 * veículo **cadastrado ou não**; já bloqueado → **409** (1 bloqueio ativo por
 * veículo/placa — unique parcial).
 */
@Injectable()
export class CreateVehicleBlockUseCase {
  private readonly logger = new Logger(CreateVehicleBlockUseCase.name);

  constructor(
    @Inject(VEHICLE_BLOCK_REPOSITORY)
    private readonly vehicleBlockRepository: VehicleBlockRepository,
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: VehicleRepository,
  ) {}

  /**
   * Bloqueia o veículo/placa da empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Placa e motivo.
   * @returns Bloqueio criado.
   * @throws {BadRequestException} Placa vazia ou motivo vazio.
   * @throws {ConflictException} Veículo/placa já bloqueado ativamente.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: CreateBlockInputDto,
  ): Promise<BlockResponse> {
    const plate = normalizePlate(input.plate);
    if (!plate || plate.length > 10) {
      throw new BadRequestException('Placa inválida.');
    }
    const reason = input.reason.trim();
    if (!reason) {
      throw new BadRequestException('O motivo do bloqueio é obrigatório.');
    }

    const vehicle = await this.vehicleRepository.findByPlateAndCompanyId(
      plate,
      actor.companyId,
    );

    const existing = vehicle
      ? await this.vehicleBlockRepository.findActiveByVehicleIdAndCompanyId(
          vehicle.id,
          actor.companyId,
        )
      : await this.vehicleBlockRepository.findActiveByPlateAndCompanyId(
          plate,
          actor.companyId,
        );
    if (existing) {
      throw new ConflictException('Este veículo/placa já está bloqueado.');
    }

    const block = await this.vehicleBlockRepository.create({
      companyId: actor.companyId,
      vehicleId: vehicle?.id ?? null,
      plate,
      blockType: VehicleBlockType.MANUAL,
      reason,
      blockedBy: actor.id,
    });

    return toBlockResponse(block, { id: actor.id, name: actor.name }, null);
  }
}

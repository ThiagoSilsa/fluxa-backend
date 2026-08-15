// NestJS
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

// Repository
import { VEHICLE_REPOSITORY } from '../../domain/repositories/vehicle.repository';

// Mapper
import { toVehicleResponse } from '../utils/vehicle-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { GetVehicleInputDto } from '../dto/get-vehicle-input.dto';
import type { VehicleResponse } from '../dto/vehicle-response';
import type { VehicleRepository } from '../../domain/repositories/vehicle.repository';

/**
 * Desativa um veículo da empresa da sessão (soft: `is_active = false`).
 *
 * A desativação **não** fecha acessos `INSIDE` em andamento (a saída continua
 * sendo registrada), não revoga QR ativo nem bloqueios (ADR 0006 §10) — o
 * veículo apenas deixa de operar na portaria.
 */
@Injectable()
export class DeactivateVehicleUseCase {
  private readonly logger = new Logger(DeactivateVehicleUseCase.name);

  constructor(
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: VehicleRepository,
  ) {}

  /**
   * Desativa o veículo da empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Id do veículo.
   * @returns Veículo desativado com o tipo.
   * @throws {NotFoundException} Quando o veículo não existe na empresa.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: GetVehicleInputDto,
  ): Promise<VehicleResponse> {
    const existing = await this.vehicleRepository.findByIdAndCompanyId(
      input.id,
      actor.companyId,
    );
    if (!existing) {
      throw new NotFoundException('Veículo não encontrado.');
    }

    const updated = await this.vehicleRepository.deactivateByIdAndCompanyId(
      input.id,
      actor.companyId,
    );
    if (!updated) {
      throw new NotFoundException('Veículo não encontrado.');
    }
    return toVehicleResponse({ ...updated, vehicleType: existing.vehicleType });
  }
}

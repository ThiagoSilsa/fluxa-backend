// NestJS
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

// Repository
import { VEHICLE_TYPE_REPOSITORY } from '../../domain/repositories/vehicle-type.repository';

// Mapper
import { toVehicleTypeResponse } from '../utils/vehicle-type-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { GetVehicleTypeInputDto } from '../dto/get-vehicle-type-input.dto';
import type { VehicleTypeResponse } from '../dto/vehicle-type-response';
import type { VehicleTypeRepository } from '../../domain/repositories/vehicle-type.repository';

/**
 * Desativa um tipo de veículo da empresa da sessão (soft: `is_active =
 * false`).
 *
 * A desativação **não** remove nem bloqueia os veículos que o usam (ADR 0006
 * §6) — o tipo deixa apenas de ser selecionável para novos cadastros.
 */
@Injectable()
export class DeactivateVehicleTypeUseCase {
  private readonly logger = new Logger(DeactivateVehicleTypeUseCase.name);

  constructor(
    @Inject(VEHICLE_TYPE_REPOSITORY)
    private readonly vehicleTypeRepository: VehicleTypeRepository,
  ) {}

  /**
   * Desativa o tipo da empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Id do tipo.
   * @returns Tipo desativado.
   * @throws {NotFoundException} Quando o tipo não existe na empresa.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: GetVehicleTypeInputDto,
  ): Promise<VehicleTypeResponse> {
    const existing = await this.vehicleTypeRepository.findByIdAndCompanyId(
      input.id,
      actor.companyId,
    );
    if (!existing) {
      throw new NotFoundException('Tipo de veículo não encontrado.');
    }

    const updated = await this.vehicleTypeRepository.deactivateByIdAndCompanyId(
      input.id,
      actor.companyId,
    );
    if (!updated) {
      throw new NotFoundException('Tipo de veículo não encontrado.');
    }
    return toVehicleTypeResponse(updated);
  }
}

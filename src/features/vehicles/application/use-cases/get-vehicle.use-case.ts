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
 * Busca um veículo por id na empresa da sessão (com o tipo agregado).
 */
@Injectable()
export class GetVehicleUseCase {
  private readonly logger = new Logger(GetVehicleUseCase.name);

  constructor(
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: VehicleRepository,
  ) {}

  /**
   * Detalha um veículo da empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Id do veículo.
   * @returns Veículo da empresa com o tipo.
   * @throws {NotFoundException} Quando o veículo não existe na empresa
   * (cross-tenant não é revelado — mesma resposta, ADR 0006 §1).
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: GetVehicleInputDto,
  ): Promise<VehicleResponse> {
    const vehicle = await this.vehicleRepository.findByIdAndCompanyId(
      input.id,
      actor.companyId,
    );
    if (!vehicle) {
      throw new NotFoundException('Veículo não encontrado.');
    }
    return toVehicleResponse(vehicle);
  }
}

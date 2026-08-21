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
 * Busca um tipo de veículo por id na empresa da sessão.
 */
@Injectable()
export class GetVehicleTypeUseCase {
  private readonly logger = new Logger(GetVehicleTypeUseCase.name);

  constructor(
    @Inject(VEHICLE_TYPE_REPOSITORY)
    private readonly vehicleTypeRepository: VehicleTypeRepository,
  ) {}

  /**
   * Detalha um tipo da empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Id do tipo.
   * @returns Tipo da empresa.
   * @throws {NotFoundException} Quando o tipo não existe na empresa
   * (cross-tenant não é revelado — mesma resposta, ADR 0006 §1).
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: GetVehicleTypeInputDto,
  ): Promise<VehicleTypeResponse> {
    const vehicleType = await this.vehicleTypeRepository.findByIdAndCompanyId(
      input.id,
      actor.companyId,
    );
    if (!vehicleType) {
      throw new NotFoundException('Tipo de veículo não encontrado.');
    }
    return toVehicleTypeResponse(vehicleType);
  }
}

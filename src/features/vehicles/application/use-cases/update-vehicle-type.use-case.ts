// NestJS
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

// Shared
import { normalizeCode } from '../../../../shared/utils/code.util';

// Repository
import { VEHICLE_TYPE_REPOSITORY } from '../../domain/repositories/vehicle-type.repository';

// Mapper
import { toVehicleTypeResponse } from '../utils/vehicle-type-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { UpdateVehicleTypeInputDto } from '../dto/update-vehicle-type-input.dto';
import type { VehicleTypeResponse } from '../dto/vehicle-type-response';
import type { VehicleTypeRepository } from '../../domain/repositories/vehicle-type.repository';

/**
 * Atualiza código/nome/descrição/classificação de um tipo de veículo da
 * empresa da sessão (PATCH parcial).
 *
 * O `code` é normalizado antes de persistir e o unique `(company_id, code)` é
 * traduzido em **409** (ADR 0006 §6) — nunca 500 cru.
 */
@Injectable()
export class UpdateVehicleTypeUseCase {
  private readonly logger = new Logger(UpdateVehicleTypeUseCase.name);

  constructor(
    @Inject(VEHICLE_TYPE_REPOSITORY)
    private readonly vehicleTypeRepository: VehicleTypeRepository,
  ) {}

  /**
   * Atualiza o tipo da empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Id e campos a atualizar.
   * @returns Tipo atualizado.
   * @throws {NotFoundException} Quando o tipo não existe na empresa.
   * @throws {ConflictException} Código já usado por outro tipo da empresa.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: UpdateVehicleTypeInputDto,
  ): Promise<VehicleTypeResponse> {
    const existing = await this.vehicleTypeRepository.findByIdAndCompanyId(
      input.id,
      actor.companyId,
    );
    if (!existing) {
      throw new NotFoundException('Tipo de veículo não encontrado.');
    }

    try {
      const updated = await this.vehicleTypeRepository.updateByIdAndCompanyId(
        input.id,
        actor.companyId,
        {
          code:
            input.code !== undefined ? normalizeCode(input.code) : undefined,
          name: input.name,
          description: input.description,
          isFleet: input.isFleet,
          isActive: input.isActive,
        },
      );
      if (!updated) {
        throw new NotFoundException('Tipo de veículo não encontrado.');
      }
      return toVehicleTypeResponse(updated);
    } catch (error) {
      if (error instanceof QueryFailedError) {
        throw new ConflictException('Código de tipo de veículo já cadastrado.');
      }
      throw error;
    }
  }
}

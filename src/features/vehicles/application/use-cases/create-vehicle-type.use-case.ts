// NestJS
import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

// Shared
import { normalizeCode } from '../../../../shared/utils/code.util';

// Repository
import { VEHICLE_TYPE_REPOSITORY } from '../../domain/repositories/vehicle-type.repository';

// Mapper
import { toVehicleTypeResponse } from '../utils/vehicle-type-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { CreateVehicleTypeInputDto } from '../dto/create-vehicle-type-input.dto';
import type { VehicleTypeResponse } from '../dto/vehicle-type-response';
import type { VehicleTypeRepository } from '../../domain/repositories/vehicle-type.repository';

/**
 * Cria um tipo de veículo na empresa da sessão.
 *
 * O `code` é normalizado (`trim` + `uppercase`) antes de persistir; o unique
 * `(company_id, code)` é traduzido em **409** (ADR 0006 §6) — nunca 500 cru.
 */
@Injectable()
export class CreateVehicleTypeUseCase {
  private readonly logger = new Logger(CreateVehicleTypeUseCase.name);

  constructor(
    @Inject(VEHICLE_TYPE_REPOSITORY)
    private readonly vehicleTypeRepository: VehicleTypeRepository,
  ) {}

  /**
   * Cria o tipo com `companyId` da sessão e `code` normalizado.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Dados de criação (código, nome, classificação, descrição).
   * @returns Tipo criado.
   * @throws {ConflictException} Código já usado por outro tipo da empresa.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: CreateVehicleTypeInputDto,
  ): Promise<VehicleTypeResponse> {
    const code = normalizeCode(input.code);

    try {
      const vehicleType = await this.vehicleTypeRepository.create({
        companyId: actor.companyId,
        code,
        name: input.name,
        description: input.description ?? null,
        isFleet: input.isFleet,
      });
      return toVehicleTypeResponse(vehicleType);
    } catch (error) {
      if (error instanceof QueryFailedError) {
        throw new ConflictException('Código de tipo de veículo já cadastrado.');
      }
      throw error;
    }
  }
}

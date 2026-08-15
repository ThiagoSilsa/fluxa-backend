// NestJS
import { Inject, Injectable, Logger } from '@nestjs/common';

// Repository
import { VEHICLE_TYPE_REPOSITORY } from '../../domain/repositories/vehicle-type.repository';

// Mapper
import { toVehicleTypeResponse } from '../utils/vehicle-type-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { ListVehicleTypesInputDto } from '../dto/list-vehicle-types-input.dto';
import type { ListVehicleTypesResponse } from '../dto/vehicle-type-response';
import type { VehicleTypeRepository } from '../../domain/repositories/vehicle-type.repository';

/**
 * Lista tipos de veículo da empresa da sessão com paginação, busca
 * (código/nome) e filtros.
 *
 * Devolve no formato padrão do AGENTS.md §3 (`{ limit, offset, data, count,
 * parameters? }`) — sem objeto `meta` aninhado.
 */
@Injectable()
export class ListVehicleTypesUseCase {
  private readonly logger = new Logger(ListVehicleTypesUseCase.name);

  constructor(
    @Inject(VEHICLE_TYPE_REPOSITORY)
    private readonly vehicleTypeRepository: VehicleTypeRepository,
  ) {}

  /**
   * Lista os tipos escopados pela empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Busca, filtros e paginação.
   * @returns Página de tipos com o total sem paginação.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: ListVehicleTypesInputDto,
  ): Promise<ListVehicleTypesResponse> {
    const { data, count } = await this.vehicleTypeRepository.list(
      actor.companyId,
      {
        search: input.search,
        isFleet: input.isFleet,
        isActive: input.isActive,
        limit: input.limit,
        offset: input.offset,
      },
    );

    return {
      limit: input.limit,
      offset: input.offset,
      data: data.map(toVehicleTypeResponse),
      count,
    };
  }
}

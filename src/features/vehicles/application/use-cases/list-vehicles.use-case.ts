// NestJS
import { Inject, Injectable, Logger } from '@nestjs/common';

// Shared
import type { ParameterDto } from '../../../../shared/dto/parameter.dto';

// Repositories
import { VEHICLE_TYPE_REPOSITORY } from '../../domain/repositories/vehicle-type.repository';
import { VEHICLE_REPOSITORY } from '../../domain/repositories/vehicle.repository';

// Mapper
import { toVehicleResponse } from '../utils/vehicle-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { VehicleTypeRepository } from '../../domain/repositories/vehicle-type.repository';
import type { VehicleRepository } from '../../domain/repositories/vehicle.repository';
import type { ListVehiclesInputDto } from '../dto/list-vehicles-input.dto';
import type { ListVehiclesResponse } from '../dto/vehicle-response';

/**
 * Lista veículos da empresa da sessão com paginação, busca (placa normalizada
 * ou modelo) e filtros.
 *
 * Devolve no formato padrão do AGENTS.md §3 (`{ limit, offset, data, count,
 * parameters? }`) — `parameters` traz os `allowed_values` dos **tipos ativos**
 * para o filtro `vehicle_type_id` (ADR 0006 §11).
 */
@Injectable()
export class ListVehiclesUseCase {
  private readonly logger = new Logger(ListVehiclesUseCase.name);

  constructor(
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: VehicleRepository,
    @Inject(VEHICLE_TYPE_REPOSITORY)
    private readonly vehicleTypeRepository: VehicleTypeRepository,
  ) {}

  /**
   * Lista os veículos escopados pela empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Busca, filtros e paginação.
   * @returns Página de veículos com o total sem paginação.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: ListVehiclesInputDto,
  ): Promise<ListVehiclesResponse> {
    const { data, count } = await this.vehicleRepository.list(actor.companyId, {
      search: input.search,
      vehicleTypeId: input.vehicleTypeId,
      freePass: input.freePass,
      isActive: input.isActive,
      limit: input.limit,
      offset: input.offset,
    });

    return {
      limit: input.limit,
      offset: input.offset,
      data: data.map(toVehicleResponse),
      count,
      parameters: await this.buildParameters(actor.companyId),
    };
  }

  /**
   * Monta os metadados de filtros da listagem — `allowed_values` dos tipos de
   * veículo ativos para o filtro `vehicle_type_id`.
   *
   * @param companyId Empresa da sessão.
   * @returns Lista de parâmetros (vazia se não houver tipos ativos).
   */
  private async buildParameters(companyId: string): Promise<ParameterDto[]> {
    const { data: types } = await this.vehicleTypeRepository.list(companyId, {
      isActive: true,
      limit: 100,
      offset: 0,
    });

    return [
      {
        key: 'vehicle_type_id',
        label: 'Tipo de veículo',
        allowed_values: types.map((type) => ({
          id: type.id,
          name: type.name,
        })),
      },
    ];
  }
}

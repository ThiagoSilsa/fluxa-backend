// NestJS
import { Inject, Injectable, Logger } from '@nestjs/common';

// Repositories
import { VEHICLE_REPOSITORY } from '../../domain/repositories/vehicle.repository';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { VehicleRepository } from '../../domain/repositories/vehicle.repository';
import type { ListVehicleOptionsInputDto } from '../dto/list-vehicle-options-input.dto';
import type { ListVehicleOptionsResponse } from '../dto/vehicle-option-response';

/**
 * Lista opções de veículo da empresa da sessão (seleção enxuta).
 *
 * Endpoint de baixo privilégio para solicitantes (ADR 0011): busca por placa
 * ou modelo (normalizada no repositório), escopo pela empresa do ator e
 * resposta mínima `{ id, plate, model }` — sem `parameters` nem campos
 * administrativos.
 */
@Injectable()
export class ListVehicleOptionsUseCase {
  private readonly logger = new Logger(ListVehicleOptionsUseCase.name);

  constructor(
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: VehicleRepository,
  ) {}

  /**
   * Lista as opções escopadas pela empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Busca e paginação.
   * @returns Página de opções com o total sem paginação.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: ListVehicleOptionsInputDto,
  ): Promise<ListVehicleOptionsResponse> {
    const { data, count } = await this.vehicleRepository.list(actor.companyId, {
      search: input.search,
      limit: input.limit,
      offset: input.offset,
    });

    return {
      limit: input.limit,
      offset: input.offset,
      data: data.map((vehicle) => ({
        id: vehicle.id,
        plate: vehicle.plate,
        model: vehicle.model,
      })),
      count,
    };
  }
}

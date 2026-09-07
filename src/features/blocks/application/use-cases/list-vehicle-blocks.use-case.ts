// NestJS
import { Inject, Injectable, Logger } from '@nestjs/common';

// Repositories
import { VEHICLE_BLOCK_REPOSITORY } from '../../domain/repositories/vehicle-block.repository';
import { USER_REPOSITORY } from '../../../users/domain/repositories/user.repository';

// Mapper
import { toBlockResponse } from '../utils/block-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { VehicleBlockEntity } from '../../domain/entities/vehicle-block.entity';
import type { VehicleBlockRepository } from '../../domain/repositories/vehicle-block.repository';
import type { UserRepository } from '../../../users/domain/repositories/user.repository';
import type { ListBlocksInputDto } from '../dto/list-blocks-input.dto';
import type {
  BlockActorSummary,
  ListBlocksResponse,
} from '../dto/block-response';

/**
 * Lista bloqueios da empresa da sessão com paginação, busca por placa e
 * filtro de status (formato padrão do AGENTS.md §3).
 */
@Injectable()
export class ListVehicleBlocksUseCase {
  private readonly logger = new Logger(ListVehicleBlocksUseCase.name);

  constructor(
    @Inject(VEHICLE_BLOCK_REPOSITORY)
    private readonly vehicleBlockRepository: VehicleBlockRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

  /**
   * Lista os bloqueios escopados pela empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Busca, filtro de status e paginação.
   * @returns Página de bloqueios com o total sem paginação.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: ListBlocksInputDto,
  ): Promise<ListBlocksResponse> {
    const { data, count } = await this.vehicleBlockRepository.list(
      actor.companyId,
      {
        search: input.search,
        status: input.status,
        limit: input.limit,
        offset: input.offset,
      },
    );

    const actors = await this.resolveActors(data);

    return {
      limit: input.limit,
      offset: input.offset,
      data: data.map((block) =>
        toBlockResponse(
          block,
          actors.get(block.blockedBy ?? '') ?? null,
          actors.get(block.revokedBy ?? '') ?? null,
        ),
      ),
      count,
    };
  }

  /**
   * Resolve em lote os nomes dos atores (blocked_by/revoked_by) dos bloqueios.
   *
   * @param blocks Bloqueios da página.
   * @returns Mapa `userId → { id, name }` com os atores encontrados.
   */
  private async resolveActors(
    blocks: VehicleBlockEntity[],
  ): Promise<Map<string, BlockActorSummary>> {
    const ids = new Set<string>();
    for (const block of blocks) {
      if (block.blockedBy) {
        ids.add(block.blockedBy);
      }
      if (block.revokedBy) {
        ids.add(block.revokedBy);
      }
    }

    const users = await Promise.all(
      [...ids].map((id) => this.userRepository.findById(id)),
    );

    const map = new Map<string, BlockActorSummary>();
    for (const user of users) {
      if (user) {
        map.set(user.id, { id: user.id, name: user.name });
      }
    }
    return map;
  }
}

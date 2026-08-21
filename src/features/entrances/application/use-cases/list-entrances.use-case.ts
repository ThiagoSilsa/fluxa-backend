// NestJS
import { Inject, Injectable, Logger } from '@nestjs/common';

// Repository
import { ENTRANCE_REPOSITORY } from '../../domain/repositories/entrance.repository';

// Mapper
import { toEntranceResponse } from '../utils/entrance-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { ListEntrancesInputDto } from '../dto/list-entrances-input.dto';
import type { ListEntrancesResponse } from '../dto/entrance-response';
import type { EntranceRepository } from '../../domain/repositories/entrance.repository';

/**
 * Lista portarias da empresa da sessão com paginação, busca por nome e filtro
 * de estado.
 *
 * Devolve no formato padrão do AGENTS.md §3 (`{ limit, offset, data, count,
 * parameters? }`) — sem objeto `meta` aninhado.
 */
@Injectable()
export class ListEntrancesUseCase {
  private readonly logger = new Logger(ListEntrancesUseCase.name);

  constructor(
    @Inject(ENTRANCE_REPOSITORY)
    private readonly entranceRepository: EntranceRepository,
  ) {}

  /**
   * Lista as portarias escopadas pela empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Busca, filtro de estado e paginação.
   * @returns Página de portarias com o total sem paginação.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: ListEntrancesInputDto,
  ): Promise<ListEntrancesResponse> {
    const { data, count } = await this.entranceRepository.list(
      actor.companyId,
      {
        search: input.search,
        isActive: input.isActive,
        limit: input.limit,
        offset: input.offset,
      },
    );

    return {
      limit: input.limit,
      offset: input.offset,
      data: data.map(toEntranceResponse),
      count,
    };
  }
}

// NestJS
import { Inject, Injectable, Logger } from '@nestjs/common';

// Repositories
import { BLOCK_REQUEST_REPOSITORY } from '../../domain/repositories/block-request.repository';
import { USER_REPOSITORY } from '../../../users/domain/repositories/user.repository';

// Mapper
import { toBlockRequestResponse } from '../utils/block-request-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { BlockRequestEntity } from '../../domain/entities/block-request.entity';
import type { BlockRequestRepository } from '../../domain/repositories/block-request.repository';
import type { UserRepository } from '../../../users/domain/repositories/user.repository';
import type { ListBlockRequestsInputDto } from '../dto/list-block-requests-input.dto';
import type {
  BlockRequestActorSummary,
  ListBlockRequestsResponse,
} from '../dto/block-request-response';

/**
 * Lista solicitações de bloqueio da empresa da sessão (admin/segurança) com
 * paginação e filtro de status (formato padrão do AGENTS.md §3).
 */
@Injectable()
export class ListBlockRequestsUseCase {
  private readonly logger = new Logger(ListBlockRequestsUseCase.name);

  constructor(
    @Inject(BLOCK_REQUEST_REPOSITORY)
    private readonly blockRequestRepository: BlockRequestRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

  /**
   * Lista as solicitações escopadas pela empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Filtro de status e paginação.
   * @returns Página de solicitações com o total sem paginação.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: ListBlockRequestsInputDto,
  ): Promise<ListBlockRequestsResponse> {
    const { data, count } = await this.blockRequestRepository.list(
      actor.companyId,
      {
        status: input.status,
        limit: input.limit,
        offset: input.offset,
      },
    );

    const actors = await this.resolveActors(data);

    return {
      limit: input.limit,
      offset: input.offset,
      data: data.map((request) => {
        const requestedBy = actors.get(request.requestedBy);
        const handledBy = request.handledBy
          ? (actors.get(request.handledBy) ?? null)
          : null;
        return toBlockRequestResponse(
          request,
          requestedBy ?? { id: request.requestedBy, name: '—' },
          handledBy,
        );
      }),
      count,
    };
  }

  /**
   * Resolve em lote os nomes dos atores (requested_by/handled_by).
   *
   * @param requests Solicitações da página.
   * @returns Mapa `userId → { id, name }` com os atores encontrados.
   */
  private async resolveActors(
    requests: BlockRequestEntity[],
  ): Promise<Map<string, BlockRequestActorSummary>> {
    const ids = new Set<string>();
    for (const request of requests) {
      ids.add(request.requestedBy);
      if (request.handledBy) {
        ids.add(request.handledBy);
      }
    }

    const users = await Promise.all(
      [...ids].map((id) => this.userRepository.findById(id)),
    );

    const map = new Map<string, BlockRequestActorSummary>();
    for (const user of users) {
      if (user) {
        map.set(user.id, { id: user.id, name: user.name });
      }
    }
    return map;
  }
}

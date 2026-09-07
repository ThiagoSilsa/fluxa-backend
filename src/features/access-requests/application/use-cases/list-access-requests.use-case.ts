// NestJS
import { Inject, Injectable, Logger } from '@nestjs/common';

// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';

// Repositories
import { ACCESS_REQUEST_REPOSITORY } from '../../domain/repositories/access-request.repository';
import { USER_REPOSITORY } from '../../../users/domain/repositories/user.repository';

// Mapper
import { toAccessRequestResponse } from '../utils/access-request-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { AccessRequestEntity } from '../../domain/entities/access-request.entity';
import type { AccessRequestRepository } from '../../domain/repositories/access-request.repository';
import type { UserRepository } from '../../../users/domain/repositories/user.repository';
import type { ListAccessRequestsInputDto } from '../dto/list-access-requests-input.dto';
import type {
  AccessRequestActorSummary,
  ListAccessRequestsResponse,
} from '../dto/access-request-response';

/**
 * Lista solicitações de acesso da empresa da sessão (administração) com
 * paginação, filtro de status e busca por placa (formato padrão do AGENTS.md
 * §3).
 */
@Injectable()
export class ListAccessRequestsUseCase {
  private readonly logger = new Logger(ListAccessRequestsUseCase.name);

  constructor(
    @Inject(ACCESS_REQUEST_REPOSITORY)
    private readonly accessRequestRepository: AccessRequestRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

  /**
   * Lista as solicitações escopadas pela empresa do ator — escalonada por
   * papel (ADR 0012 §1): o gestor vê todas; o solicitante vê apenas as
   * próprias.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Filtro de status, busca por placa e paginação.
   * @returns Página de solicitações com o total sem paginação.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: ListAccessRequestsInputDto,
  ): Promise<ListAccessRequestsResponse> {
    const { data, count } = await this.accessRequestRepository.list(
      actor.companyId,
      {
        status: input.status,
        plate: input.plate,
        ...(this.canManageAll(actor) ? {} : { requestedBy: actor.id }),
        limit: input.limit,
        offset: input.offset,
      },
    );

    const actors = await this.resolveActors(data);

    return {
      limit: input.limit,
      offset: input.offset,
      data: data.map((request) =>
        toAccessRequestResponse(
          request,
          actors.get(request.requestedBy) ?? {
            id: request.requestedBy,
            name: '—',
          },
          request.handledBy ? (actors.get(request.handledBy) ?? null) : null,
          request.authorizedBy
            ? (actors.get(request.authorizedBy) ?? null)
            : null,
        ),
      ),
      count,
    };
  }

  /**
   * Resolve em lote os nomes dos atores (requested_by/handled_by/authorized_by).
   *
   * @param requests Solicitações da página.
   * @returns Mapa `userId → { id, name }` com os atores encontrados.
   */
  private async resolveActors(
    requests: AccessRequestEntity[],
  ): Promise<Map<string, AccessRequestActorSummary>> {
    const ids = new Set<string>();
    for (const request of requests) {
      ids.add(request.requestedBy);
      if (request.handledBy) {
        ids.add(request.handledBy);
      }
      if (request.authorizedBy) {
        ids.add(request.authorizedBy);
      }
    }

    const users = await Promise.all(
      [...ids].map((id) => this.userRepository.findById(id)),
    );

    const map = new Map<string, AccessRequestActorSummary>();
    for (const user of users) {
      if (user) {
        map.set(user.id, { id: user.id, name: user.name });
      }
    }
    return map;
  }

  /**
   * Indica se o ator gerencia todas as solicitações da empresa (`is_admin` ou
   * com `MANAGE_ACCESS_REQUESTS`). Solicitantes (`CREATE_ACCESS_REQUEST`) sem
   * gestão veem apenas as próprias (ADR 0012 §1).
   *
   * @param actor Ator autenticado.
   * @returns `true` quando o ator pode listar todas as solicitações.
   */
  private canManageAll(actor: AuthenticatedUserEntity): boolean {
    return (
      actor.isAdmin ||
      actor.permissions.includes(PermissionCode.MANAGE_ACCESS_REQUESTS)
    );
  }
}

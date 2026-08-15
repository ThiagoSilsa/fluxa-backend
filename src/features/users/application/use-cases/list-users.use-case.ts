// NestJS
import { Inject, Injectable, Logger } from '@nestjs/common';

// Repository
import { USER_COMPANY_REPOSITORY } from '../../../auth/domain/repositories/user-company.repository';
import { USER_ROLE_REPOSITORY } from '../../domain/repositories/user-role.repository';

// Mapper
import { toUserResponse } from '../utils/user-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { UserCompanyRepository } from '../../../auth/domain/repositories/user-company.repository';
import type { UserRoleRepository } from '../../domain/repositories/user-role.repository';
import type { ListUsersInputDto } from '../dto/list-users-input.dto';
import type { ListUsersResponse } from '../dto/user-response';

/**
 * Lista os usuários com vínculo na empresa da sessão, paginado.
 *
 * Devolve no formato padrão do AGENTS.md §3 (`{ limit, offset, data, count,
 * parameters? }`) — sem objeto `meta` aninhado.
 */
@Injectable()
export class ListUsersUseCase {
  private readonly logger = new Logger(ListUsersUseCase.name);

  constructor(
    @Inject(USER_COMPANY_REPOSITORY)
    private readonly userCompanyRepository: UserCompanyRepository,
    @Inject(USER_ROLE_REPOSITORY)
    private readonly userRoleRepository: UserRoleRepository,
  ) {}

  /**
   * Lista os usuários escopados pela empresa do ator (via `user_company`).
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Busca, filtros e paginação.
   * @returns Página de usuários com o total sem paginação.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: ListUsersInputDto,
  ): Promise<ListUsersResponse> {
    const { data, count } = await this.userCompanyRepository.listByCompanyId(
      actor.companyId,
      {
        search: input.search,
        type: input.type,
        isActive: input.isActive,
        limit: input.limit,
        offset: input.offset,
      },
    );

    // Resumo do cargo enriquecido em lote (1 cargo por empresa) — evita N+1.
    const roles = await this.userRoleRepository.listByUserIdsAndCompanyId(
      data.map((item) => item.userId),
      actor.companyId,
    );
    const roleByUserId = new Map(roles.map((role) => [role.userId, role]));

    return {
      limit: input.limit,
      offset: input.offset,
      data: data.map((item) =>
        toUserResponse(item, roleByUserId.get(item.userId) ?? null),
      ),
      count,
    };
  }
}

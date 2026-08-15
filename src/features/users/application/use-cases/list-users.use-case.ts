// NestJS
import { Inject, Injectable, Logger } from '@nestjs/common';

// Repository
import { USER_COMPANY_REPOSITORY } from '../../../auth/domain/repositories/user-company.repository';

// Mapper
import { toUserResponse } from '../utils/user-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { UserCompanyRepository } from '../../../auth/domain/repositories/user-company.repository';
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

    return {
      limit: input.limit,
      offset: input.offset,
      data: data.map(toUserResponse),
      count,
    };
  }
}

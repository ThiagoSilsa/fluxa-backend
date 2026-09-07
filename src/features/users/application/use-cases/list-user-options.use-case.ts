// NestJS
import { Inject, Injectable, Logger } from '@nestjs/common';

// Repositories
import { USER_COMPANY_REPOSITORY } from '../../../auth/domain/repositories/user-company.repository';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { UserCompanyRepository } from '../../../auth/domain/repositories/user-company.repository';
import type { ListUserOptionsInputDto } from '../dto/list-user-options-input.dto';
import type { ListUserOptionsResponse } from '../dto/user-option-response';

/**
 * Lista opções de usuário da empresa da sessão (seleção enxuta).
 *
 * Endpoint de baixo privilégio para solicitantes (ADR 0011): usuários
 * **ativos** da empresa (vínculo `user_company`), busca por nome ou e-mail,
 * escopo pela empresa do ator e resposta mínima `{ id, name, email }`.
 */
@Injectable()
export class ListUserOptionsUseCase {
  private readonly logger = new Logger(ListUserOptionsUseCase.name);

  constructor(
    @Inject(USER_COMPANY_REPOSITORY)
    private readonly userCompanyRepository: UserCompanyRepository,
  ) {}

  /**
   * Lista as opções escopadas pela empresa do ator (apenas vínculos ativos).
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Busca e paginação.
   * @returns Página de opções com o total sem paginação.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: ListUserOptionsInputDto,
  ): Promise<ListUserOptionsResponse> {
    const { data, count } = await this.userCompanyRepository.listByCompanyId(
      actor.companyId,
      {
        search: input.search,
        isActive: true,
        limit: input.limit,
        offset: input.offset,
      },
    );

    return {
      limit: input.limit,
      offset: input.offset,
      data: data.map((item) => ({
        id: item.userId,
        name: item.name,
        email: item.email,
      })),
      count,
    };
  }
}

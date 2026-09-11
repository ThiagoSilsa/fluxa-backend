// NestJS
import { Inject, Injectable, Logger } from '@nestjs/common';

// Repository
import { ROLE_REPOSITORY } from '../../domain/repositories/role.repository';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { ListRoleOptionsInputDto } from '../dto/list-role-options-input.dto';
import type { ListRoleOptionsResponse } from '../dto/role-option-response';
import type { RoleRepository } from '../../domain/repositories/role.repository';

/**
 * Lista opções de cargo da empresa da sessão (seleção enxuta).
 *
 * Endpoint de baixo privilégio (ADR 0011): quem aceita solicitação de acesso
 * (`MANAGE_ACCESS_REQUESTS`) ou gerencia usuários (`MANAGE_USERS`) precisa
 * escolher um cargo sem ter `MANAGE_ROLES`. Resposta mínima `{ id, name }`
 * apenas com os cargos **ativos** e escopada pela empresa do ator.
 */
@Injectable()
export class ListRoleOptionsUseCase {
  private readonly logger = new Logger(ListRoleOptionsUseCase.name);

  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: RoleRepository,
  ) {}

  /**
   * Lista as opções de cargo escopadas pela empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Paginação.
   * @returns Página de opções com o total sem paginação.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: ListRoleOptionsInputDto,
  ): Promise<ListRoleOptionsResponse> {
    const { data, count } = await this.roleRepository.list(actor.companyId, {
      isActive: true,
      limit: input.limit,
      offset: input.offset,
    });

    return {
      limit: input.limit,
      offset: input.offset,
      data: data.map((role) => ({
        id: role.id,
        name: role.name,
      })),
      count,
    };
  }
}

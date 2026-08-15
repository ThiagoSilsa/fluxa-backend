// NestJS
import { Inject, Injectable, Logger } from '@nestjs/common';

// Repository
import { ROLE_REPOSITORY } from '../../domain/repositories/role.repository';

// Mapper
import { toRoleResponse } from '../utils/role-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { ListRolesInputDto } from '../dto/list-roles-input.dto';
import type { ListRolesResponse } from '../dto/role-response';
import type { RoleRepository } from '../../domain/repositories/role.repository';

/**
 * Lista cargos da empresa da sessão com paginação e busca por nome.
 *
 * Devolve no formato padrão do AGENTS.md §3 (`{ limit, offset, data, count,
 * parameters? }`) — sem objeto `meta` aninhado.
 */
@Injectable()
export class ListRolesUseCase {
  private readonly logger = new Logger(ListRolesUseCase.name);

  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: RoleRepository,
  ) {}

  /**
   * Lista os cargos escopados pela empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Busca e paginação.
   * @returns Página de cargos com o total sem paginação.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: ListRolesInputDto,
  ): Promise<ListRolesResponse> {
    const { data, count } = await this.roleRepository.list(actor.companyId, {
      search: input.search,
      limit: input.limit,
      offset: input.offset,
    });

    return {
      limit: input.limit,
      offset: input.offset,
      data: data.map(toRoleResponse),
      count,
    };
  }
}

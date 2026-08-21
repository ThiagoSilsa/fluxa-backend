// NestJS
import { Inject, Injectable, Logger } from '@nestjs/common';

// Repository
import { DEPARTMENT_REPOSITORY } from '../../domain/repositories/department.repository';

// Mapper
import { toDepartmentResponse } from '../utils/department-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { ListDepartmentsInputDto } from '../dto/list-departments-input.dto';
import type { ListDepartmentsResponse } from '../dto/department-response';
import type { DepartmentRepository } from '../../domain/repositories/department.repository';

/**
 * Lista departamentos da empresa da sessão com paginação, busca por nome e
 * filtro de estado.
 *
 * Devolve no formato padrão do AGENTS.md §3 (`{ limit, offset, data, count,
 * parameters? }`) — sem objeto `meta` aninhado.
 */
@Injectable()
export class ListDepartmentsUseCase {
  private readonly logger = new Logger(ListDepartmentsUseCase.name);

  constructor(
    @Inject(DEPARTMENT_REPOSITORY)
    private readonly departmentRepository: DepartmentRepository,
  ) {}

  /**
   * Lista os departamentos escopados pela empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Busca, filtro de estado e paginação.
   * @returns Página de departamentos com o total sem paginação.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: ListDepartmentsInputDto,
  ): Promise<ListDepartmentsResponse> {
    const { data, count } = await this.departmentRepository.list(
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
      data: data.map(toDepartmentResponse),
      count,
    };
  }
}

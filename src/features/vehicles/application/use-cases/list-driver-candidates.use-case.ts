// NestJS
import { Inject, Injectable, Logger } from '@nestjs/common';

// Repositories
import { USER_COMPANY_REPOSITORY } from '../../../auth/domain/repositories/user-company.repository';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { UserCompanyRepository } from '../../../auth/domain/repositories/user-company.repository';
import type { ListDriverCandidatesInputDto } from '../dto/list-driver-candidates-input.dto';
import type { ListDriverCandidatesResponse } from '../dto/driver-candidate-response';

/**
 * Lista candidatos a motorista da empresa da sessão.
 *
 * Candidatos são as pessoas com **vínculo `user_company` ativo** na empresa —
 * exatamente o pré-requisito do `AssignDriverToVehicleUseCase` (ADR 0006 §9).
 * O shape é enxuto (`{id, name}`) para alimentar o seletor de motoristas da
 * tela de veículos.
 */
@Injectable()
export class ListDriverCandidatesUseCase {
  private readonly logger = new Logger(ListDriverCandidatesUseCase.name);

  constructor(
    @Inject(USER_COMPANY_REPOSITORY)
    private readonly userCompanyRepository: UserCompanyRepository,
  ) {}

  /**
   * Lista os candidatos escopados pela empresa do ator (apenas vínculos
   * ativos).
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Busca e paginação.
   * @returns Página de candidatos com o total sem paginação.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: ListDriverCandidatesInputDto,
  ): Promise<ListDriverCandidatesResponse> {
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
      data: data.map((candidate) => ({
        id: candidate.userId,
        name: candidate.name,
      })),
      count,
    };
  }
}

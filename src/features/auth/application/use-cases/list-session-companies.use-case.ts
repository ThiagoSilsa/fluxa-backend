import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuthCompanyEntity } from '../../domain/entities/auth-company.entity';
import type { AuthenticatedUserEntity } from '../../domain/entities/authenticated-user.entity';
import { USER_COMPANY_REPOSITORY } from '../../domain/repositories/user-company.repository';
import type { UserCompanyRepository } from '../../domain/repositories/user-company.repository';

/**
 * Lista as empresas que a pessoa pode abrir na sessão (ADR 0002).
 *
 * Devolve apenas vínculos **ativos** (com empresa ativa), ordenados pelo nome
 * — é a lista que alimenta o seletor do frontend. Só lista: o que autoriza é
 * o servidor, na emissão do token.
 */
@Injectable()
export class ListSessionCompaniesUseCase {
  private readonly logger = new Logger(ListSessionCompaniesUseCase.name);

  constructor(
    @Inject(USER_COMPANY_REPOSITORY)
    private readonly userCompanyRepository: UserCompanyRepository,
  ) {}

  /**
   * Lista os vínculos ativos da pessoa autenticada.
   *
   * @param actor Ator autenticado (primeiro parâmetro — AGENTS.md).
   * @returns Empresas ativas da pessoa (para o seletor).
   */
  public async execute(
    actor: AuthenticatedUserEntity,
  ): Promise<AuthCompanyEntity[]> {
    const links = await this.userCompanyRepository.findActiveByUserId(actor.id);
    return links.map((link) => ({
      id: link.companyId,
      name: link.companyName,
    }));
  }
}

import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuthenticatedUserEntity } from '../../domain/entities/authenticated-user.entity';
import { AUTH_REPOSITORY } from '../../domain/repositories/auth.repository';
import type { AuthRepository } from '../../domain/repositories/auth.repository';

/**
 * Resolve o usuário autenticado de uma requisição a partir do `sub` e do
 * `companyId` do JWT (ADR 0002).
 *
 * Revalida o vínculo pessoa+empresa **a cada requisição** (`user_company`
 * ativo + empresa ativa) e busca papéis/permissões escopados por
 * `(user_id, company_id)`. Retorna `null` quando o token não é mais válido.
 */
@Injectable()
export class ResolveAuthenticatedUserUseCase {
  private readonly logger = new Logger(ResolveAuthenticatedUserUseCase.name);

  constructor(
    @Inject(AUTH_REPOSITORY)
    private readonly authRepository: AuthRepository,
  ) {}

  /**
   * Resolve o ator autenticado (ou `null` se o vínculo caiu).
   *
   * @param sub Id da pessoa (claim `sub` do JWT).
   * @param companyId Empresa da sessão (claim `companyId` do JWT).
   * @returns Entidade autenticada com papéis/permissões da empresa; `null` se
   * o vínculo não existe, está inativo ou a empresa está inativa.
   */
  public async execute(
    sub: string,
    companyId: string,
  ): Promise<AuthenticatedUserEntity | null> {
    const candidate = await this.authRepository.findUserInCompany(
      sub,
      companyId,
    );

    if (!candidate || !candidate.isActive || !candidate.companyIsActive) {
      return null;
    }

    const [roleCodes, permissions] = await Promise.all([
      this.authRepository.findRoleCodesByUserIdAndCompanyId(sub, companyId),
      this.authRepository.findPermissionsByUserIdAndCompanyId(sub, companyId),
    ]);

    return {
      id: candidate.id,
      companyId: candidate.companyId,
      email: candidate.email,
      name: candidate.name,
      type: candidate.type,
      roleCodes,
      permissions,
    };
  }
}

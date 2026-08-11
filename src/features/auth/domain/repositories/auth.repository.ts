import { PermissionCode } from '../../../../shared/constants/access-control.constant';
import { AuthUserEntity } from '../entities/auth-user.entity';

/**
 * Symbol token de injeção do `AuthRepository`.
 */
export const AUTH_REPOSITORY = Symbol('AUTH_REPOSITORY');

/**
 * Contrato do repositório de autenticação.
 *
 * Todas as resoluções de usuário/papéis/permissões são escopadas por
 * `(user_id, company_id)` — o `companyId` vem da sessão (ADR 0002) e garante
 * que nada "vaza" entre empresas.
 */
export interface AuthRepository {
  /**
   * Busca os candidatos de autenticação de um e-mail — uma entrada por
   * vínculo pessoa ↔ empresa (não por pessoa).
   *
   * @param email E-mail da pessoa (identidade global).
   * @returns Candidatos (1 por vínculo), incluindo empresa e vínculo.
   */
  findUsersByEmail(email: string): Promise<AuthUserEntity[]>;

  /**
   * Revalida o vínculo pessoa+empresa (usado pelo guard a cada requisição).
   *
   * @param userId Id da pessoa.
   * @param companyId Id da empresa da sessão.
   * @returns Candidato se o vínculo existir; `null` caso contrário.
   */
  findUserInCompany(
    userId: string,
    companyId: string,
  ): Promise<AuthUserEntity | null>;

  /**
   * Códigos dos cargos ativos da pessoa na empresa.
   *
   * @param userId Id da pessoa.
   * @param companyId Id da empresa.
   * @returns Códigos de cargos (ex.: `Administração`, `Porteiro`).
   */
  findRoleCodesByUserIdAndCompanyId(
    userId: string,
    companyId: string,
  ): Promise<string[]>;

  /**
   * Permissões efetivas da pessoa na empresa (via cargos → role_permission).
   *
   * @param userId Id da pessoa.
   * @param companyId Id da empresa.
   * @returns Códigos de permissão (ex.: `REGISTER_ENTRY`).
   */
  findPermissionsByUserIdAndCompanyId(
    userId: string,
    companyId: string,
  ): Promise<PermissionCode[]>;
}

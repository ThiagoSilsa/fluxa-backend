// Types
import type { UserRoleWithRoleEntity } from '../entities/user-role.entity';

/**
 * Symbol token de injeção do `UserRoleRepository`.
 */
export const USER_ROLE_REPOSITORY = Symbol('USER_ROLE_REPOSITORY');

/**
 * Contrato do repositório de cargos de usuário (`user_role`).
 *
 * Tudo é escopado por `company_id` (o `companyId` da sessão) — cargos de uma
 * empresa nunca vazam para outra (ADR 0002/0004).
 */
export interface UserRoleRepository {
  /**
   * Verifica se o usuário tem o cargo na empresa.
   *
   * @param userId Id da pessoa.
   * @param roleId Id do cargo.
   * @param companyId Empresa da sessão.
   * @returns `true` se o vínculo existir.
   */
  exists(userId: string, roleId: string, companyId: string): Promise<boolean>;

  /**
   * Lista os cargos do usuário na empresa (com dados do cargo).
   *
   * @param userId Id da pessoa.
   * @param companyId Empresa da sessão.
   * @returns Vínculos `user_role` com dados do cargo.
   */
  listByUserIdAndCompanyId(
    userId: string,
    companyId: string,
  ): Promise<UserRoleWithRoleEntity[]>;

  /**
   * Atribui um cargo ao usuário na empresa.
   *
   * @param userId Id da pessoa.
   * @param roleId Id do cargo.
   * @param companyId Empresa da sessão.
   * @returns Promise resolvida quando o vínculo é criado.
   */
  create(userId: string, roleId: string, companyId: string): Promise<void>;

  /**
   * Remove o cargo do usuário na empresa.
   *
   * @param userId Id da pessoa.
   * @param roleId Id do cargo.
   * @param companyId Empresa da sessão.
   * @returns `true` se o vínculo existia e foi removido.
   */
  remove(userId: string, roleId: string, companyId: string): Promise<boolean>;
}

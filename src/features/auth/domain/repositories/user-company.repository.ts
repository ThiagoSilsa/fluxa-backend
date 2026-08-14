// Types
import type { UserCompanyEntity } from '../entities/user-company.entity';

/**
 * Symbol token de injeção do `UserCompanyRepository`.
 */
export const USER_COMPANY_REPOSITORY = Symbol('USER_COMPANY_REPOSITORY');

/**
 * Contrato do repositório de vínculos pessoa ↔ empresa (`user_company`).
 *
 * A participação numa empresa é o vínculo (ADR 0002); "entrar" exige vínculo
 * ativo + empresa ativa.
 */
export interface UserCompanyRepository {
  /**
   * Vínculos ativos da pessoa (com empresa ativa), para o seletor de empresa.
   *
   * @param userId Id da pessoa.
   * @returns Vínculos ativos ordenados pelo nome da empresa.
   */
  findActiveByUserId(userId: string): Promise<UserCompanyEntity[]>;

  /**
   * Verifica se a pessoa tem vínculo ativo com a empresa.
   *
   * @param userId Id da pessoa.
   * @param companyId Id da empresa.
   * @returns `true` se o vínculo ativo existir.
   */
  existsActive(userId: string, companyId: string): Promise<boolean>;

  /**
   * Quantidade de vínculos ativos da pessoa.
   *
   * @param userId Id da pessoa.
   * @returns Número de vínculos ativos (0 = não entra em lugar nenhum).
   */
  countActiveByUserId(userId: string): Promise<number>;
}

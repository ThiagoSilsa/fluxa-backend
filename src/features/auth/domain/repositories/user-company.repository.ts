// Constants
import { UserType } from '../constants/user-type.constant';

// Types
import type { UserCompanyEntity } from '../entities/user-company.entity';

/**
 * Symbol token de injeção do `UserCompanyRepository`.
 */
export const USER_COMPANY_REPOSITORY = Symbol('USER_COMPANY_REPOSITORY');

/**
 * Pessoa + vínculo na empresa (listagem/detalhe da feature `users`).
 *
 * Junta os dados da pessoa (identidade global) com os do vínculo
 * (`type`, `is_active`) — o que a tela de usuários precisa.
 */
export interface UserCompanyWithUserEntity {
  /** Id do vínculo (`user_company`). */
  linkId: string;
  /** Id da pessoa (`user`). */
  userId: string;
  /** Nome da pessoa. */
  name: string;
  /** E-mail (identidade global). */
  email: string;
  /** Telefone (opcional). */
  phone: string | null;
  /** Documento (opcional, único global). */
  document: string | null;
  /** Observação (opcional). */
  observation: string | null;
  /** URL da foto (opcional). */
  photoUrl: string | null;
  /** Tipo no vínculo (EMPLOYEE/VISITOR). */
  type: UserType;
  /** Se o vínculo está ativo. */
  isActive: boolean;
}

/**
 * Filtros de listagem de usuários da empresa (feature `users`).
 */
export interface ListUsersRepositoryFilters {
  /** Busca por nome ou e-mail (parcial, case-insensitive). */
  search?: string;
  /** Filtro por tipo no vínculo. */
  type?: UserType;
  /** Filtro por vínculo ativo/inativo. */
  isActive?: boolean;
  /** Quantidade de registros por página. */
  limit: number;
  /** Offset da página. */
  offset: number;
}

/**
 * Dados para criar um vínculo pessoa ↔ empresa.
 */
export interface CreateUserCompanyRepositoryData {
  userId: string;
  companyId: string;
  type: UserType;
  isActive: boolean;
}

/**
 * Dados para atualizar o vínculo (campos opcionais).
 */
export interface UpdateUserCompanyRepositoryData {
  type?: UserType;
  isActive?: boolean;
}

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

  /**
   * Busca o vínculo da pessoa com a empresa (com dados da pessoa) — usado
   * pela feature `users` (detalhe, validação de vínculo nas operações).
   *
   * @param userId Id da pessoa.
   * @param companyId Id da empresa da sessão.
   * @returns Pessoa + vínculo, ou `null` se o vínculo não existir.
   */
  findByUserIdAndCompanyId(
    userId: string,
    companyId: string,
  ): Promise<UserCompanyWithUserEntity | null>;

  /**
   * Verifica se a pessoa já tem vínculo com a empresa (ativo ou inativo) —
   * usado no create para devolver 409 quando o vínculo já existe.
   *
   * @param userId Id da pessoa.
   * @param companyId Id da empresa da sessão.
   * @returns `true` se o vínculo existir (independente de `is_active`).
   */
  existsByUserIdAndCompanyId(
    userId: string,
    companyId: string,
  ): Promise<boolean>;

  /**
   * Lista os usuários com vínculo na empresa (paginado, com busca e filtros)
   * — listagem da feature `users`.
   *
   * @param companyId Id da empresa da sessão.
   * @param filters Filtros e paginação.
   * @returns Página de usuários e total sem paginação.
   */
  listByCompanyId(
    companyId: string,
    filters: ListUsersRepositoryFilters,
  ): Promise<{ data: UserCompanyWithUserEntity[]; count: number }>;

  /**
   * Cria um vínculo pessoa ↔ empresa (usado ao vincular pessoa já existente).
   *
   * @param data Dados do vínculo (inclui `companyId` da sessão).
   * @returns Vínculo criado.
   */
  create(data: CreateUserCompanyRepositoryData): Promise<UserCompanyEntity>;

  /**
   * Atualiza o vínculo (`type`/`is_active`) — edição/desativação da feature
   * `users`. Desativar é ato da empresa sobre a participação (ADR 0002 §3).
   *
   * @param id Id do vínculo.
   * @param data Campos a atualizar.
   * @returns Vínculo atualizado ou `null` se não existir.
   */
  updateById(
    id: string,
    data: UpdateUserCompanyRepositoryData,
  ): Promise<UserCompanyEntity | null>;
}

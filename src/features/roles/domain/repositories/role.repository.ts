// Types
import type { RoleEntity } from '../entities/role.entity';

/**
 * Symbol token de injeção do `RoleRepository`.
 */
export const ROLE_REPOSITORY = Symbol('ROLE_REPOSITORY');

/**
 * Filtros de listagem de cargos.
 */
export interface ListRolesRepositoryFilters {
  /** Busca por nome (parcial, case-insensitive). */
  search?: string;
  /** Quantidade de registros por página. */
  limit: number;
  /** Offset da página. */
  offset: number;
}

/**
 * Dados para criação de cargo.
 */
export interface CreateRoleRepositoryData {
  companyId: string;
  name: string;
  description: string | null;
  isAdmin: boolean;
}

/**
 * Dados para atualização de cargo (campos opcionais).
 */
export interface UpdateRoleRepositoryData {
  name?: string;
  description?: string | null;
}

/**
 * Contrato do repositório de cargos.
 *
 * Todas as operações são escopadas por `company_id` (sufixo `AndCompanyId`) —
 * o `companyId` vem da sessão e garante que cargos nunca vazem entre empresas.
 */
export interface RoleRepository {
  /**
   * Busca um cargo por id dentro da empresa.
   *
   * @param id Id do cargo.
   * @param companyId Empresa da sessão.
   * @returns Cargo da empresa ou `null` se não existir/não pertencer.
   */
  findByIdAndCompanyId(
    id: string,
    companyId: string,
  ): Promise<RoleEntity | null>;

  /**
   * Lista cargos da empresa com paginação e busca por nome.
   *
   * @param companyId Empresa da sessão.
   * @param filters Filtros e paginação.
   * @returns Dados da página e total sem paginação.
   */
  list(
    companyId: string,
    filters: ListRolesRepositoryFilters,
  ): Promise<{ data: RoleEntity[]; count: number }>;

  /**
   * Cria um cargo na empresa.
   *
   * @param data Dados de criação (inclui `companyId`).
   * @returns Cargo criado.
   */
  create(data: CreateRoleRepositoryData): Promise<RoleEntity>;

  /**
   * Atualiza um cargo da empresa (nome/descrição — `isAdmin` não é alterável).
   *
   * @param id Id do cargo.
   * @param companyId Empresa da sessão.
   * @param data Campos a atualizar.
   * @returns Cargo atualizado ou `null` se não existir/não pertencer.
   */
  updateByIdAndCompanyId(
    id: string,
    companyId: string,
    data: UpdateRoleRepositoryData,
  ): Promise<RoleEntity | null>;

  /**
   * Desativa um cargo da empresa (soft: `is_active = false`) — não remove
   * vínculos em `role_permission`/`user_role`.
   *
   * @param id Id do cargo.
   * @param companyId Empresa da sessão.
   * @returns Cargo desativado ou `null` se não existir/não pertencer.
   */
  deactivateByIdAndCompanyId(
    id: string,
    companyId: string,
  ): Promise<RoleEntity | null>;
}

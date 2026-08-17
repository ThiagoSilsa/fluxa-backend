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
  /** Filtro por status ativo/inativo (opcional). */
  isActive?: boolean;
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
  /** Novo status ativo/inativo (opcional — desativa/reativa o cargo). */
  isActive?: boolean;
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
   * Lista cargos da empresa com paginação, busca por nome e filtro por status.
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
   * Atualiza um cargo da empresa (nome/descrição/isActive — `isAdmin` não é
   * alterável).
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
   * Exclui fisicamente um cargo da empresa, em **cascata**: remove os vínculos
   * em `role_permission` e desvincula os usuários (`user_role`) — ver ADR 0004
   * §5. A exclusão é irreversível.
   *
   * @param id Id do cargo.
   * @param companyId Empresa da sessão.
   * @returns Snapshot do cargo excluído ou `null` se não existir/não pertencer.
   */
  deleteByIdAndCompanyId(
    id: string,
    companyId: string,
  ): Promise<RoleEntity | null>;
}

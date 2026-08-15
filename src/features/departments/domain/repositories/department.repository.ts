// Types
import type { DepartmentEntity } from '../entities/department.entity';

/**
 * Symbol token de injeção do `DepartmentRepository`.
 */
export const DEPARTMENT_REPOSITORY = Symbol('DEPARTMENT_REPOSITORY');

/**
 * Filtros de listagem de departamentos.
 */
export interface ListDepartmentsRepositoryFilters {
  /** Busca por nome (parcial, case-insensitive). */
  search?: string;
  /** Filtra por estado ativo/inativo. */
  isActive?: boolean;
  /** Quantidade de registros por página. */
  limit: number;
  /** Offset da página. */
  offset: number;
}

/**
 * Dados para criação de departamento.
 */
export interface CreateDepartmentRepositoryData {
  companyId: string;
  name: string;
  description: string | null;
  parkingSpace: number;
}

/**
 * Dados para atualização de departamento (campos opcionais).
 */
export interface UpdateDepartmentRepositoryData {
  name?: string;
  description?: string | null;
  parkingSpace?: number;
  isActive?: boolean;
}

/**
 * Contrato do repositório de departamentos.
 *
 * Todas as operações são escopadas por `company_id` (sufixo `AndCompanyId`) —
 * o `companyId` vem da sessão e garante que departamentos nunca vazem entre
 * empresas.
 */
export interface DepartmentRepository {
  /**
   * Busca um departamento por id dentro da empresa.
   *
   * @param id Id do departamento.
   * @param companyId Empresa da sessão.
   * @returns Departamento da empresa ou `null` se não existir/não pertencer.
   */
  findByIdAndCompanyId(
    id: string,
    companyId: string,
  ): Promise<DepartmentEntity | null>;

  /**
   * Lista departamentos da empresa com paginação, busca por nome e filtro de
   * estado.
   *
   * @param companyId Empresa da sessão.
   * @param filters Filtros e paginação.
   * @returns Dados da página e total sem paginação.
   */
  list(
    companyId: string,
    filters: ListDepartmentsRepositoryFilters,
  ): Promise<{ data: DepartmentEntity[]; count: number }>;

  /**
   * Cria um departamento na empresa.
   *
   * @param data Dados de criação (inclui `companyId`).
   * @returns Departamento criado.
   */
  create(data: CreateDepartmentRepositoryData): Promise<DepartmentEntity>;

  /**
   * Atualiza um departamento da empresa (nome/descrição/vagas).
   *
   * @param id Id do departamento.
   * @param companyId Empresa da sessão.
   * @param data Campos a atualizar.
   * @returns Departamento atualizado ou `null` se não existir/não pertencer.
   */
  updateByIdAndCompanyId(
    id: string,
    companyId: string,
    data: UpdateDepartmentRepositoryData,
  ): Promise<DepartmentEntity | null>;

  /**
   * Desativa um departamento da empresa (soft: `is_active = false`) — não
   * remove vínculos em `vehicle_department` nem acessos históricos (ADR 0006
   * §10).
   *
   * @param id Id do departamento.
   * @param companyId Empresa da sessão.
   * @returns Departamento desativado ou `null` se não existir/não pertencer.
   */
  deactivateByIdAndCompanyId(
    id: string,
    companyId: string,
  ): Promise<DepartmentEntity | null>;
}

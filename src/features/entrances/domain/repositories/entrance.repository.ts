// Types
import type { EntranceEntity } from '../entities/entrance.entity';

/**
 * Symbol token de injeção do `EntranceRepository`.
 */
export const ENTRANCE_REPOSITORY = Symbol('ENTRANCE_REPOSITORY');

/**
 * Filtros de listagem de portarias.
 */
export interface ListEntrancesRepositoryFilters {
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
 * Dados para criação de portaria.
 */
export interface CreateEntranceRepositoryData {
  companyId: string;
  name: string;
}

/**
 * Dados para atualização de portaria (campos opcionais).
 */
export interface UpdateEntranceRepositoryData {
  name?: string;
  isActive?: boolean;
}

/**
 * Contrato do repositório de portarias.
 *
 * Todas as operações são escopadas por `company_id` (sufixo `AndCompanyId`) —
 * o `companyId` vem da sessão e garante que portarias nunca vazem entre
 * empresas.
 */
export interface EntranceRepository {
  /**
   * Busca uma portaria por id dentro da empresa.
   *
   * @param id Id da portaria.
   * @param companyId Empresa da sessão.
   * @returns Portaria da empresa ou `null` se não existir/não pertencer.
   */
  findByIdAndCompanyId(
    id: string,
    companyId: string,
  ): Promise<EntranceEntity | null>;

  /**
   * Lista portarias da empresa com paginação, busca por nome e filtro de
   * estado.
   *
   * @param companyId Empresa da sessão.
   * @param filters Filtros e paginação.
   * @returns Dados da página e total sem paginação.
   */
  list(
    companyId: string,
    filters: ListEntrancesRepositoryFilters,
  ): Promise<{ data: EntranceEntity[]; count: number }>;

  /**
   * Cria uma portaria na empresa.
   *
   * @param data Dados de criação (inclui `companyId`).
   * @returns Portaria criada.
   */
  create(data: CreateEntranceRepositoryData): Promise<EntranceEntity>;

  /**
   * Atualiza uma portaria da empresa (nome).
   *
   * @param id Id da portaria.
   * @param companyId Empresa da sessão.
   * @param data Campos a atualizar.
   * @returns Portaria atualizada ou `null` se não existir/não pertencer.
   */
  updateByIdAndCompanyId(
    id: string,
    companyId: string,
    data: UpdateEntranceRepositoryData,
  ): Promise<EntranceEntity | null>;

  /**
   * Desativa uma portaria da empresa (soft: `is_active = false`) — não apaga
   * o histórico (movimentos, `entry_denial`, devices; ADR 0006 §10).
   *
   * @param id Id da portaria.
   * @param companyId Empresa da sessão.
   * @returns Portaria desativada ou `null` se não existir/não pertencer.
   */
  deactivateByIdAndCompanyId(
    id: string,
    companyId: string,
  ): Promise<EntranceEntity | null>;
}

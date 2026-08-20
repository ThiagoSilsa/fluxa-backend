// Types
import type { VehicleTypeEntity } from '../entities/vehicle-type.entity';

/**
 * Symbol token de injeção do `VehicleTypeRepository`.
 */
export const VEHICLE_TYPE_REPOSITORY = Symbol('VEHICLE_TYPE_REPOSITORY');

/**
 * Filtros de listagem de tipos de veículo.
 */
export interface ListVehicleTypesRepositoryFilters {
  /** Busca por código ou nome (parcial, case-insensitive). */
  search?: string;
  /** Filtra pela classificação de frota. */
  isFleet?: boolean;
  /** Filtra por estado ativo/inativo. */
  isActive?: boolean;
  /** Quantidade de registros por página. */
  limit: number;
  /** Offset da página. */
  offset: number;
}

/**
 * Dados para criação de tipo de veículo.
 */
export interface CreateVehicleTypeRepositoryData {
  companyId: string;
  code: string;
  name: string;
  description: string | null;
  isFleet: boolean;
}

/**
 * Dados para atualização de tipo de veículo (campos opcionais).
 */
export interface UpdateVehicleTypeRepositoryData {
  code?: string;
  name?: string;
  description?: string | null;
  isFleet?: boolean;
  isActive?: boolean;
}

/**
 * Contrato do repositório de tipos de veículo.
 *
 * Todas as operações são escopadas por `company_id` (sufixo `AndCompanyId`) —
 * o `companyId` vem da sessão e garante que tipos nunca vazem entre empresas.
 */
export interface VehicleTypeRepository {
  /**
   * Busca um tipo por id dentro da empresa.
   *
   * @param id Id do tipo.
   * @param companyId Empresa da sessão.
   * @returns Tipo da empresa ou `null` se não existir/não pertencer.
   */
  findByIdAndCompanyId(
    id: string,
    companyId: string,
  ): Promise<VehicleTypeEntity | null>;

  /**
   * Lista tipos da empresa com paginação, busca e filtros.
   *
   * @param companyId Empresa da sessão.
   * @param filters Filtros e paginação.
   * @returns Dados da página e total sem paginação.
   */
  list(
    companyId: string,
    filters: ListVehicleTypesRepositoryFilters,
  ): Promise<{ data: VehicleTypeEntity[]; count: number }>;

  /**
   * Cria um tipo na empresa.
   *
   * @param data Dados de criação (inclui `companyId`).
   * @returns Tipo criado.
   */
  create(data: CreateVehicleTypeRepositoryData): Promise<VehicleTypeEntity>;

  /**
   * Busca tipos da empresa cujos códigos estão na lista (exatos) — usado
   * pelo importador de veículos para resolver o tipo por código (ADR 0007 §8).
   *
   * @param codes Códigos a buscar.
   * @param companyId Empresa da sessão.
   * @returns Tipos encontrados com um dos códigos.
   */
  findByCodesAndCompanyId(
    codes: string[],
    companyId: string,
  ): Promise<VehicleTypeEntity[]>;

  /**
   * Atualiza um tipo da empresa (código/nome/descrição/classificação).
   *
   * @param id Id do tipo.
   * @param companyId Empresa da sessão.
   * @param data Campos a atualizar.
   * @returns Tipo atualizado ou `null` se não existir/não pertencer.
   */
  updateByIdAndCompanyId(
    id: string,
    companyId: string,
    data: UpdateVehicleTypeRepositoryData,
  ): Promise<VehicleTypeEntity | null>;

  /**
   * Conta veículos da empresa que usam um tipo (para bloquear a exclusão
   * física — FK `vehicle.vehicle_type_id`).
   *
   * @param vehicleTypeId Id do tipo.
   * @param companyId Empresa da sessão.
   * @returns Quantidade de veículos que referenciam o tipo.
   */
  countVehiclesByTypeIdAndCompanyId(
    vehicleTypeId: string,
    companyId: string,
  ): Promise<number>;

  /**
   * Exclui fisicamente um tipo da empresa (sem veículos a referenciar).
   *
   * @param id Id do tipo.
   * @param companyId Empresa da sessão.
   * @returns Tipo excluído ou `null` se não existir/não pertencer.
   */
  deleteByIdAndCompanyId(
    id: string,
    companyId: string,
  ): Promise<VehicleTypeEntity | null>;
}

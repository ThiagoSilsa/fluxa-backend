// Types
import type {
  VehicleEntity,
  VehicleWithTypeEntity,
} from '../entities/vehicle.entity';

/**
 * Symbol token de injeção do `VehicleRepository`.
 */
export const VEHICLE_REPOSITORY = Symbol('VEHICLE_REPOSITORY');

/**
 * Filtros de listagem de veículos.
 */
export interface ListVehiclesRepositoryFilters {
  /** Busca por placa (normalizada) ou trecho de modelo. */
  search?: string;
  /** Filtra por tipo de veículo. */
  vehicleTypeId?: string;
  /** Filtra por departamento padrão (via `vehicle_department` ativo). */
  departmentId?: string;
  /** Filtra por livre acesso. */
  freePass?: boolean;
  /** Filtra por estado ativo/inativo. */
  isActive?: boolean;
  /** Quantidade de registros por página. */
  limit: number;
  /** Offset da página. */
  offset: number;
}

/**
 * Dados para criação de veículo.
 */
export interface CreateVehicleRepositoryData {
  plate: string;
  companyId: string;
  model: string | null;
  color: string | null;
  observation: string | null;
  freePass: boolean;
  vehicleTypeId: string;
}

/**
 * Dados para atualização de veículo (campos opcionais).
 */
export interface UpdateVehicleRepositoryData {
  plate?: string;
  model?: string | null;
  color?: string | null;
  observation?: string | null;
  freePass?: boolean;
  vehicleTypeId?: string;
  isActive?: boolean;
}

/**
 * Contrato do repositório de veículos.
 *
 * Todas as operações são escopadas por `company_id` (sufixo `AndCompanyId`) —
 * o `companyId` vem da sessão e garante que veículos nunca vazem entre
 * empresas. Busca por placa normaliza o termo antes de consultar.
 */
export interface VehicleRepository {
  /**
   * Busca um veículo por id dentro da empresa (com o tipo agregado).
   *
   * @param id Id do veículo.
   * @param companyId Empresa da sessão.
   * @returns Veículo da empresa ou `null` se não existir/não pertencer.
   */
  findByIdAndCompanyId(
    id: string,
    companyId: string,
  ): Promise<VehicleWithTypeEntity | null>;

  /**
   * Lista veículos da empresa com paginação, busca e filtros (com o tipo
   * agregado).
   *
   * @param companyId Empresa da sessão.
   * @param filters Filtros e paginação.
   * @returns Dados da página e total sem paginação.
   */
  list(
    companyId: string,
    filters: ListVehiclesRepositoryFilters,
  ): Promise<{ data: VehicleWithTypeEntity[]; count: number }>;

  /**
   * Cria um veículo na empresa.
   *
   * @param data Dados de criação (inclui `companyId`).
   * @returns Veículo criado.
   */
  create(data: CreateVehicleRepositoryData): Promise<VehicleEntity>;

  /**
   * Atualiza um veículo da empresa.
   *
   * @param id Id do veículo.
   * @param companyId Empresa da sessão.
   * @param data Campos a atualizar.
   * @returns Veículo atualizado ou `null` se não existir/não pertencer.
   */
  updateByIdAndCompanyId(
    id: string,
    companyId: string,
    data: UpdateVehicleRepositoryData,
  ): Promise<VehicleEntity | null>;

  /**
   * Desativa um veículo da empresa (soft: `is_active = false`) — não fecha
   * acessos `INSIDE`, não revoga QR/bloqueios (ADR 0006 §10).
   *
   * @param id Id do veículo.
   * @param companyId Empresa da sessão.
   * @returns Veículo desativado ou `null` se não existir/não pertencer.
   */
  deactivateByIdAndCompanyId(
    id: string,
    companyId: string,
  ): Promise<VehicleEntity | null>;
}

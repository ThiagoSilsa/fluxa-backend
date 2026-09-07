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
  /** Coluna de ordenação (whitelist: `plate`, `isActive`, `createdAt`). */
  sortBy?: 'plate' | 'isActive' | 'createdAt';
  /** Direção da ordenação (default `ASC`). */
  sortOrder?: 'ASC' | 'DESC';
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
   * Busca um veículo por **placa normalizada** dentro da empresa (com o tipo
   * agregado) — usado pelo fluxo de acesso/bloqueio (M1/M3).
   *
   * @param plate Placa normalizada (trim + uppercase + sem hífen/espaço).
   * @param companyId Empresa da sessão.
   * @returns Veículo da empresa ou `null` se não existir/não pertencer.
   */
  findByPlateAndCompanyId(
    plate: string,
    companyId: string,
  ): Promise<VehicleWithTypeEntity | null>;

  /**
   * Atualiza o `is_blocked` de um veículo da empresa (derivado — ADR 0010 §2: a
   * feature de bloqueio é a única que escreve essa coluna).
   *
   * @param id Id do veículo.
   * @param companyId Empresa da sessão.
   * @param isBlocked Novo valor derivado.
   * @returns Veículo atualizado ou `null` se não existir/não pertencer.
   */
  updateIsBlockedByIdAndCompanyId(
    id: string,
    companyId: string,
    isBlocked: boolean,
  ): Promise<VehicleEntity | null>;

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
   * Busca veículos da empresa cujas placas estão na lista (exatas, já
   * normalizadas) — usado pelo importador para detectar duplicados e resolver
   * placas (ADR 0007 §8).
   *
   * @param plates Placas a buscar.
   * @param companyId Empresa da sessão.
   * @returns Veículos encontrados com uma das placas.
   */
  findByPlatesAndCompanyId(
    plates: string[],
    companyId: string,
  ): Promise<VehicleEntity[]>;

  /**
   * Insere vários veículos em lote (chunks de 500 — ADR 0007 §8).
   *
   * @param data Lista de dados de criação (inclui `companyId`).
   * @returns Veículos criados.
   */
  createBatch(data: CreateVehicleRepositoryData[]): Promise<VehicleEntity[]>;

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
   * Conta vínculos da empresa que referenciam um veículo — `vehicle_department`
   * (departamento padrão) + `user_vehicle` (motoristas) — ADR 0006 §9/§10.
   *
   * @param vehicleId Id do veículo.
   * @param companyId Empresa da sessão.
   * @returns Quantidade de vínculos que referenciam o veículo.
   */
  countVehicleLinksByVehicleIdAndCompanyId(
    vehicleId: string,
    companyId: string,
  ): Promise<number>;

  /**
   * Exclui fisicamente um veículo da empresa.
   *
   * @param id Id do veículo.
   * @param companyId Empresa da sessão.
   * @returns Veículo excluído ou `null` se não existir/não pertencer.
   */
  deleteByIdAndCompanyId(
    id: string,
    companyId: string,
  ): Promise<VehicleEntity | null>;
}

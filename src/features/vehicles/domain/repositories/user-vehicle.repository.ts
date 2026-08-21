// Types
import type {
  UserVehicleEntity,
  UserVehicleWithUserEntity,
} from '../entities/user-vehicle.entity';

/**
 * Symbol token de injeção do `UserVehicleRepository`.
 */
export const USER_VEHICLE_REPOSITORY = Symbol('USER_VEHICLE_REPOSITORY');

/**
 * Dados para criar o vínculo motorista ↔ veículo.
 */
export interface AssignDriverRepositoryData {
  companyId: string;
  userId: string;
  vehicleId: string;
  isPrimary: boolean;
  canDrive: boolean;
}

/**
 * Dados para atualizar o vínculo (campos opcionais).
 */
export interface UpdateDriverRepositoryData {
  isPrimary?: boolean;
  canDrive?: boolean;
}

/**
 * Contrato do repositório de vínculos motorista ↔ veículo.
 *
 * Escopado por `company_id`. A tabela não tem `is_active` — a remoção é
 * física. `is_primary = true` **desmarca o primário anterior** do mesmo
 * veículo na mesma transação (invariante de 1 primário — ADR 0006 §9); o
 * unique parcial é a salvaguarda de concorrência (409).
 */
export interface UserVehicleRepository {
  /**
   * Cria o vínculo — se `isPrimary`, desmarca o primário anterior do veículo
   * na mesma transação.
   *
   * @param data Dados do vínculo (inclui `companyId`).
   * @returns Vínculo criado.
   */
  create(data: AssignDriverRepositoryData): Promise<UserVehicleEntity>;

  /**
   * Insere vários vínculos em lote (chunks de 500 — ADR 0007 §8). Se algum
   * vínculo do lote marca `isPrimary`, os primários anteriores dos veículos
   * envolvidos são desmarcados na mesma transação (invariante de 1 primário —
   * ADR 0006 §9).
   *
   * @param data Lista de dados do vínculo (inclui `companyId`).
   * @returns Vínculos criados.
   */
  createBatch(data: AssignDriverRepositoryData[]): Promise<UserVehicleEntity[]>;

  /**
   * Lista os vínculos do veículo na empresa, com o nome do motorista
   * (primários primeiro).
   *
   * @param vehicleId Id do veículo.
   * @param companyId Empresa da sessão.
   * @returns Vínculos do veículo.
   */
  findByVehicleIdAndCompanyId(
    vehicleId: string,
    companyId: string,
  ): Promise<UserVehicleWithUserEntity[]>;

  /**
   * Lista os vínculos de vários veículos na empresa (sem o motorista) — usado
   * pelo importador para detectar vínculos duplicados em lote (ADR 0007 §8).
   *
   * @param vehicleIds Ids dos veículos.
   * @param companyId Empresa da sessão.
   * @returns Vínculos encontrados para os veículos informados.
   */
  findByVehicleIdsAndCompanyId(
    vehicleIds: string[],
    companyId: string,
  ): Promise<UserVehicleEntity[]>;

  /**
   * Busca o vínculo de um motorista com um veículo na empresa.
   *
   * @param userId Id do motorista.
   * @param vehicleId Id do veículo.
   * @param companyId Empresa da sessão.
   * @returns Vínculo (com o motorista) ou `null` se não existir.
   */
  findByUserIdAndVehicleIdAndCompanyId(
    userId: string,
    vehicleId: string,
    companyId: string,
  ): Promise<UserVehicleWithUserEntity | null>;

  /**
   * Atualiza o vínculo — se `isPrimary = true`, desmarca o primário anterior
   * do veículo na mesma transação.
   *
   * @param id Id do vínculo.
   * @param companyId Empresa da sessão.
   * @param data Campos a atualizar.
   * @returns Vínculo atualizado ou `null` se não existir/não pertencer.
   */
  updateByIdAndCompanyId(
    id: string,
    companyId: string,
    data: UpdateDriverRepositoryData,
  ): Promise<UserVehicleEntity | null>;

  /**
   * Remove o vínculo **fisicamente** (a tabela não tem `is_active`).
   *
   * @param id Id do vínculo.
   * @param companyId Empresa da sessão.
   */
  removeByIdAndCompanyId(id: string, companyId: string): Promise<void>;
}

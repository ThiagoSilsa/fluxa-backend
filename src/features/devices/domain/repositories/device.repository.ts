// Constants
import type { DevicePlatform } from '../constants/device-platform.constant';

// Types
import type {
  DeviceEntity,
  DeviceWithEntranceEntity,
} from '../entities/device.entity';

/**
 * Symbol token de injeção do `DeviceRepository`.
 */
export const DEVICE_REPOSITORY = Symbol('DEVICE_REPOSITORY');

/**
 * Colunas de ordenação permitidas na listagem (whitelist — ADR 0008 §5).
 */
export type DeviceSortBy = 'name' | 'createdAt' | 'lastSyncAt';

/**
 * Filtros de listagem de dispositivos.
 */
export interface ListDevicesRepositoryFilters {
  /** Busca por nome (parcial, case-insensitive). */
  search?: string;
  /** Filtra por estado ativo/inativo. */
  isActive?: boolean;
  /** Coluna de ordenação (whitelist). */
  sortBy?: DeviceSortBy;
  /** Direção da ordenação. */
  sortOrder?: 'ASC' | 'DESC';
  /** Quantidade de registros por página. */
  limit: number;
  /** Offset da página. */
  offset: number;
}

/**
 * Dados para criação de dispositivo.
 */
export interface CreateDeviceRepositoryData {
  companyId: string;
  name: string;
  token: string;
  platform: DevicePlatform;
  entranceId?: string;
}

/**
 * Dados para atualização de dispositivo (campos opcionais).
 *
 * `entranceId?: string | null` — `undefined` não altera o vínculo; `null`
 * desvincula a portaria.
 */
export interface UpdateDeviceRepositoryData {
  name?: string;
  entranceId?: string | null;
  isActive?: boolean;
}

/**
 * Contrato do repositório de dispositivos.
 *
 * Todas as operações são escopadas por `company_id` (sufixo `AndCompanyId`) —
 * o `companyId` vem da sessão e garante que dispositivos nunca vazem entre
 * empresas (ADR 0008 §1).
 */
export interface DeviceRepository {
  /**
   * Busca um dispositivo por id dentro da empresa (com a portaria agregada).
   *
   * @param id Id do dispositivo.
   * @param companyId Empresa da sessão.
   * @returns Dispositivo da empresa ou `null` se não existir/não pertencer.
   */
  findByIdAndCompanyId(
    id: string,
    companyId: string,
  ): Promise<DeviceWithEntranceEntity | null>;

  /**
   * Lista dispositivos da empresa com paginação, busca, filtro de estado e
   * ordenação (com a portaria agregada).
   *
   * @param companyId Empresa da sessão.
   * @param filters Filtros, ordenação e paginação.
   * @returns Dados da página e total sem paginação.
   */
  list(
    companyId: string,
    filters: ListDevicesRepositoryFilters,
  ): Promise<{ data: DeviceWithEntranceEntity[]; count: number }>;

  /**
   * Cria um dispositivo na empresa.
   *
   * @param data Dados de criação (inclui `companyId` e `token` gerado).
   * @returns Dispositivo criado.
   */
  create(data: CreateDeviceRepositoryData): Promise<DeviceEntity>;

  /**
   * Atualiza um dispositivo da empresa (nome, vínculo com portaria, status).
   *
   * @param id Id do dispositivo.
   * @param companyId Empresa da sessão.
   * @param data Campos a atualizar.
   * @returns Dispositivo atualizado ou `null` se não existir/não pertencer.
   */
  updateByIdAndCompanyId(
    id: string,
    companyId: string,
    data: UpdateDeviceRepositoryData,
  ): Promise<DeviceEntity | null>;

  /**
   * Rotaciona o token de um dispositivo da empresa (novo token — ADR 0008 §3).
   *
   * @param id Id do dispositivo.
   * @param companyId Empresa da sessão.
   * @param token Novo token.
   * @returns Dispositivo atualizado ou `null` se não existir/não pertencer.
   */
  rotateTokenByIdAndCompanyId(
    id: string,
    companyId: string,
    token: string,
  ): Promise<DeviceEntity | null>;

  /**
   * Exclui fisicamente um dispositivo da empresa.
   *
   * @param id Id do dispositivo.
   * @param companyId Empresa da sessão.
   * @returns Dispositivo excluído ou `null` se não existir/não pertencer.
   */
  deleteByIdAndCompanyId(
    id: string,
    companyId: string,
  ): Promise<DeviceEntity | null>;
}

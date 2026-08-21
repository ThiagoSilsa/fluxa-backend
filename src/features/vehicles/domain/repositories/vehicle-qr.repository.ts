// Types
import type { VehicleQrEntity } from '../entities/vehicle-qr.entity';

/**
 * Symbol token de injeção do `VehicleQrRepository`.
 */
export const VEHICLE_QR_REPOSITORY = Symbol('VEHICLE_QR_REPOSITORY');

/**
 * Dados para criação de QR code de veículo.
 */
export interface CreateVehicleQrRepositoryData {
  companyId: string;
  vehicleId: string;
  /** Token permanente (uuid v4). */
  code: string;
  /** Ator autenticado que emitiu (auditoria — ADR 0009 §2). */
  issuedBy: string;
}

/**
 * Contrato do repositório de QR codes de veículos.
 *
 * Todas as operações são escopadas por `company_id` (sufixo `AndCompanyId`) —
 * QR codes nunca vazam entre empresas (ADR 0009 §2).
 */
export interface VehicleQrRepository {
  /**
   * Busca o QR **ativo** de um veículo da empresa (único por veículo).
   *
   * @param vehicleId Id do veículo.
   * @param companyId Empresa da sessão.
   * @returns QR ativo ou `null` (nunca emitido, revogado ou reemitido).
   */
  findActiveByVehicleIdAndCompanyId(
    vehicleId: string,
    companyId: string,
  ): Promise<VehicleQrEntity | null>;

  /**
   * Busca um QR pelo `code` dentro da empresa (para a resolução — ADR 0009
   * §4). O chamador distingue ativo/revogado pelo `isActive`.
   *
   * @param code Token do QR (lido pelo scanner).
   * @param companyId Empresa da sessão.
   * @returns QR encontrado ou `null` (desconhecido/outro tenant).
   */
  findByCodeAndCompanyId(
    code: string,
    companyId: string,
  ): Promise<VehicleQrEntity | null>;

  /**
   * Cria um QR ativo para o veículo da empresa.
   *
   * @param data Dados de criação (inclui `companyId`, `vehicleId` e `code`).
   * @returns QR criado.
   */
  create(data: CreateVehicleQrRepositoryData): Promise<VehicleQrEntity>;

  /**
   * Desativa um QR da empresa (`is_active = false` — revogar sem reemitir).
   *
   * @param id Id do QR.
   * @param companyId Empresa da sessão.
   * @returns `true` se um QR foi desativado, `false` se não existia.
   */
  deactivateByIdAndCompanyId(id: string, companyId: string): Promise<boolean>;

  /**
   * Reemite o QR do veículo em **transação**: desativa o QR ativo atual e
   * cria um novo com `code` novo (adesivo novo — ADR 0009 §2).
   *
   * @param vehicleId Id do veículo.
   * @param companyId Empresa da sessão.
   * @param data Novo código + emissor.
   * @returns Novo QR criado.
   */
  reissue(
    vehicleId: string,
    companyId: string,
    data: { code: string; issuedBy: string },
  ): Promise<VehicleQrEntity>;
}

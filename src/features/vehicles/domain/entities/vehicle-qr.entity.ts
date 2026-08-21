/**
 * QR code emitido por veículo — entidade de domínio.
 *
 * Espelha a tabela `vehicle_qr_code` (migration `0002`; ADR 0009). O `code` é
 * o **token permanente** do veículo (uuid): único por empresa, não muda ao
 * editar os dados do veículo, revogável (`isActive = false` → "QR expirado").
 * Apenas **1 QR ativo por veículo** (unique parcial).
 */
export interface VehicleQrEntity {
  /** Id do QR. */
  id: string;
  /** Empresa dona do QR. */
  companyId: string;
  /** Veículo vinculado (obrigatório). */
  vehicleId: string;
  /** Token permanente (uuid) — o que o QR code representa. */
  code: string;
  /** Ativo (revogado/reemitido = "expirado" — não resolve). */
  isActive: boolean;
  /** Quem emitiu (auditoria) ou `null`. */
  issuedBy: string | null;
  /** Última impressão (preenchido futuramente — impressão é local). */
  printedAt: Date | null;
  /** Data de criação (emissão). */
  createdAt: Date;
  /** Data da última atualização. */
  updatedAt: Date;
}

/**
 * QR code de veículo no formato de resposta (nunca a entidade crua do banco —
 * AGENTS.md §3). O `code` é o token permanente — o client gera a imagem a
 * partir dele (ADR 0009 §5).
 */
export interface VehicleQrResponse {
  /** Id do QR. */
  id: string;
  /** Veículo vinculado. */
  vehicleId: string;
  /** Token permanente (uuid) — o que o QR code representa. */
  code: string;
  /** Ativo (revogado/reemitido = "expirado" — não resolve). */
  isActive: boolean;
  /** Quem emitiu (auditoria) ou `null`. */
  issuedBy: string | null;
  /** Data de emissão (ISO). */
  createdAt: string;
}

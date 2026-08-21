// Node
import { randomUUID } from 'crypto';

/**
 * Gera o token permanente do QR code de veículo — uuid v4 (36 caracteres,
 * cabe no `varchar(64)` da tabela `vehicle_qr_code`). ADR 0009 §3.
 *
 * O `code` é único por empresa e **não muda** ao editar os dados do veículo;
 * revogar/reemitir gera um novo.
 *
 * @returns Código uuid v4.
 */
export function generateQrCode(): string {
  return randomUUID();
}

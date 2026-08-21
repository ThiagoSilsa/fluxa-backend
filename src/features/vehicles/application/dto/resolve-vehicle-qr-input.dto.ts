/**
 * Entrada do use case de resolução de QR pelo código (lido pelo scanner —
 * ADR 0009 §4).
 */
export class ResolveVehicleQrInputDto {
  constructor(
    /** Token do QR (uuid lido pelo scanner). */
    readonly code: string,
  ) {}
}

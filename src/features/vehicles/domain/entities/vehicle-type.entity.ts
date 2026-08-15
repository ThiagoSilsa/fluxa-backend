/**
 * Tipo de veículo (por empresa) — entidade de domínio.
 *
 * Espelha a tabela `vehicle_type` (migration `0002`). `code` é normalizado
 * (`trim` + `uppercase`) e único por empresa (ADR 0006 §6); `isFleet` é apenas
 * **classificação** (relatórios), não define ocupação.
 */
export interface VehicleTypeEntity {
  /** Id do tipo. */
  id: string;
  /** Empresa dona do tipo. */
  companyId: string;
  /** Código único por empresa (ex.: `FROTA`) — normalizado. */
  code: string;
  /** Nome do tipo (ex.: `Frota`). */
  name: string;
  /** Descrição opcional. */
  description: string | null;
  /** Classificação "frota da empresa" (relatórios). */
  isFleet: boolean;
  /** Se o tipo está ativo (inativo não é selecionável para novos veículos). */
  isActive: boolean;
  /** Data de criação. */
  createdAt: Date;
  /** Data da última atualização. */
  updatedAt: Date;
}

/**
 * Opção de veículo cadastrado da empresa — resposta enxuta de seleção para
 * solicitantes (ADR 0011). Não expõe campos administrativos.
 */
export interface VehicleOptionResponse {
  /** Id do veículo. */
  id: string;
  /** Placa normalizada (ex.: `ABC1D23`). */
  plate: string;
  /** Modelo (opcional). */
  model: string | null;
}

/** Envelope paginado de opções de veículo. */
export interface ListVehicleOptionsResponse {
  limit: number;
  offset: number;
  data: VehicleOptionResponse[];
  count: number;
}

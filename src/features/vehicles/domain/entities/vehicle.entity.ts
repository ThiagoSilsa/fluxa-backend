/**
 * Veículo (por empresa) — entidade de domínio.
 *
 * Espelha a tabela `vehicle` (migration `0002`). `plate` é normalizada
 * (`trim` + `uppercase` + sem hífen/espaço) e única por empresa; `isBlocked`
 * é **derivado** (existe `vehicle_block` ACTIVE) e não é editável pelo CRUD
 * (ADR 0006 §§3–4).
 */
export interface VehicleEntity {
  /** Id do veículo. */
  id: string;
  /** Placa normalizada (ex.: `ABC1D23`). */
  plate: string;
  /** Empresa dona do veículo. */
  companyId: string;
  /** Modelo (opcional). */
  model: string | null;
  /** Cor (opcional). */
  color: string | null;
  /** Observação (opcional). */
  observation: string | null;
  /** Derivado do bloqueio ativo — somente leitura no CRUD. */
  isBlocked: boolean;
  /** Livre acesso (concessão exige `GRANT_FREE_PASS`). */
  freePass: boolean;
  /** Id do tipo de veículo (obrigatório, ativo e da mesma empresa). */
  vehicleTypeId: string;
  /** Se o veículo está ativo (desativado não opera na portaria). */
  isActive: boolean;
  /** Data de criação. */
  createdAt: Date;
  /** Data da última atualização. */
  updatedAt: Date;
}

/**
 * Veículo com o tipo agregado — usado nas respostas de detalhe/listagem.
 */
export interface VehicleWithTypeEntity extends VehicleEntity {
  /** Tipo de veículo (resumo) ou `null` se não resolvido. */
  vehicleType: {
    /** Id do tipo. */
    id: string;
    /** Código do tipo (ex.: `FROTA`). */
    code: string;
    /** Nome do tipo. */
    name: string;
    /** Classificação de frota. */
    isFleet: boolean;
  } | null;
}

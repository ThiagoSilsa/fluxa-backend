/**
 * Departamento (por empresa) — entidade de domínio.
 *
 * Espelha a tabela `department` (migration `0002`). `parkingSpace` é a
 * quantidade de vagas — cadastro obrigatório pela administração (ADR 0006 §7);
 * `0` significa departamento sem vagas.
 */
export interface DepartmentEntity {
  /** Id do departamento. */
  id: string;
  /** Empresa dona do departamento. */
  companyId: string;
  /** Nome do departamento (ex.: `Recepção`). */
  name: string;
  /** Descrição opcional. */
  description: string | null;
  /** Quantidade de vagas (obrigatória no cadastro; `0` = sem vagas). */
  parkingSpace: number;
  /** Se o departamento está ativo (desativar não remove vínculos). */
  isActive: boolean;
  /** Data de criação. */
  createdAt: Date;
  /** Data da última atualização. */
  updatedAt: Date;
}

/**
 * Pessoa (identidade global) — entidade de domínio da feature `users`.
 *
 * Espelha a tabela `user` (ADR 0002): sem `company_id` — a participação numa
 * empresa é o vínculo `user_company`. `email` e `document` são únicos globais.
 */
export interface UserEntity {
  /** Id da pessoa (linha em `user`). */
  id: string;
  /** Nome da pessoa. */
  name: string;
  /** E-mail (identidade global, normalizado em lowercase). */
  email: string;
  /** Hash da senha (bcrypt) — é da pessoa, não da empresa. */
  passwordHash: string;
  /** Telefone (opcional). */
  phone: string | null;
  /** Documento (opcional, único global). */
  document: string | null;
  /** Observação (opcional). */
  observation: string | null;
  /** URL da foto (opcional). */
  photoUrl: string | null;
  /** Momento do último login. */
  lastLoginAt: Date | null;
  /** Data de criação. */
  createdAt: Date;
  /** Data da última atualização. */
  updatedAt: Date;
}

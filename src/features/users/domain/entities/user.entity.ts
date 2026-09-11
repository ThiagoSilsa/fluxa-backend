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
  /**
   * E-mail (identidade global, normalizado em lowercase) — `null` para
   * Visitante sem credenciais (ADR 0013).
   */
  email: string | null;
  /**
   * Hash da senha (bcrypt) — `null` para quem não acessa o sistema (Visitante
   * sem credenciais, ADR 0013).
   */
  passwordHash: string | null;
  /** Telefone (opcional). */
  phone: string | null;
  /** Documento (opcional, único global). */
  document: string | null;
  /** URL da foto (opcional). */
  photoUrl: string | null;
  /** Momento do último login. */
  lastLoginAt: Date | null;
  /** Data de criação. */
  createdAt: Date;
  /** Data da última atualização. */
  updatedAt: Date;
}

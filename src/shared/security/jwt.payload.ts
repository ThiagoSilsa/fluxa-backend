/**
 * Payload do JWT assinado no login e validado nas rotas protegidas.
 *
 * `sub` é o id da pessoa; `companyId` é o da **sessão** (ADR 0002) — a empresa
 * da sessão viaja no token. `iat`/`exp` são preenchidos pelo @nestjs/jwt.
 */
export interface JwtPayload {
  /** Id da pessoa (linha em `user`). */
  sub: string;
  /** Empresa da sessão. */
  companyId: string;
  /** E-mail da pessoa. */
  email: string;
  /** Emitido em (epoch seconds) — preenchido pelo JwtService. */
  iat?: number;
  /** Expira em (epoch seconds) — preenchido pelo JwtService. */
  exp?: number;
}

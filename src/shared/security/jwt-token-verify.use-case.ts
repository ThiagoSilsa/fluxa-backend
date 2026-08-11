import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from './jwt.payload';

/**
 * Verifica a assinatura/expiração do JWT e devolve o payload tipado.
 *
 * Qualquer token inválido/expirado ou com campos obrigatórios ausentes vira
 * 401 — as respostas de autenticação são indistinguíveis (ADR 0002).
 */
@Injectable()
export class JwtTokenVerifyUseCase {
  constructor(private readonly jwtService: JwtService) {}

  /**
   * Valida o token e extrai o payload.
   *
   * @param token Token JWT (Bearer).
   * @returns Payload validado (`sub`, `companyId`, `email`).
   * @throws {UnauthorizedException} Quando o token é inválido/expirado/incompleto.
   */
  public async execute(token: string): Promise<JwtPayload> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    if (!payload.sub || !payload.companyId || !payload.email) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }
    return payload;
  }
}

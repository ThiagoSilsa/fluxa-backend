import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from './jwt.payload';

/**
 * Assina o JWT da sessão com o payload `{ sub, companyId, email }` (ADR 0002).
 *
 * O secret/expiração vêm do `JwtModule` configurado com `JWT_SECRET`/
 * `JWT_EXPIRES_IN`. Use case de responsabilidade única (AGENTS.md).
 */
@Injectable()
export class JwtTokenSignUseCase {
  constructor(private readonly jwtService: JwtService) {}

  /**
   * Assina o token de sessão.
   *
   * @param payload Identidade + empresa da sessão.
   * @returns Token JWT (HS256).
   */
  public async execute(payload: JwtPayload): Promise<string> {
    return this.jwtService.signAsync(payload);
  }
}

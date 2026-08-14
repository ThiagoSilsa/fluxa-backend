import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { ValidateJwtPayloadUseCase } from '../../features/auth/application/use-cases/validate-jwt-payload.use-case';
import { AuthenticatedUserEntity } from '../../features/auth/domain/entities/authenticated-user.entity';
import { JwtTokenVerifyUseCase } from '../security/jwt-token-verify.use-case';

/**
 * Request HTTP com o ator autenticado populado pelo `JwtAuthGuard`.
 */
export interface AuthenticatedRequest extends Request {
  /** Ator autenticado (resolvido a cada requisição). */
  user?: AuthenticatedUserEntity;
}

/**
 * Guard de autenticação JWT (aplicado nos controllers).
 *
 * 1. Extrai o Bearer token;
 * 2. Verifica assinatura/expiração (`JwtTokenVerifyUseCase`);
 * 3. Revalida o vínculo pessoa+empresa a cada requisição
 *    (`ValidateJwtPayloadUseCase` → `ResolveAuthenticatedUserUseCase`);
 * 4. Popula `request.user` com o ator autenticado.
 *
 * Todas as falhas devolvem o mesmo 401 — respostas indistinguíveis (ADR 0002).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtTokenVerify: JwtTokenVerifyUseCase,
    private readonly validateJwtPayload: ValidateJwtPayloadUseCase,
  ) {}

  /**
   * Valida o token e popula o ator autenticado no request.
   *
   * @param context Contexto de execução (HTTP).
   * @returns `true` quando o token é válido e o vínculo ativo.
   * @throws {UnauthorizedException} Token ausente/inválido ou vínculo inativo.
   */
  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const payload = await this.jwtTokenVerify.execute(token);
    const user = await this.validateJwtPayload.execute(payload);
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    request.user = user;
    return true;
  }

  /**
   * Extrai o token do header `Authorization: Bearer <token>`.
   *
   * @param request Requisição HTTP.
   * @returns Token ou `null` quando ausente/malformado.
   */
  private extractBearerToken(request: AuthenticatedRequest): string | null {
    const header = request.headers.authorization;
    if (!header) {
      return null;
    }
    const [scheme, token] = header.split(' ');
    return scheme === 'Bearer' && token ? token : null;
  }
}

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedUserEntity } from '../../features/auth/domain/entities/authenticated-user.entity';
import { REQUIRED_ROLES_KEY } from '../decorators/require-roles.decorator';

/**
 * Guard de cargos — usado com `@RequireRoles()`.
 *
 * Basta que o ator tenha **um** dos cargos declarados (por nome, ex.:
 * `Administração`). Papéis são resolvidos por empresa da sessão.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  /**
   * Valida se o ator possui um dos cargos exigidos pela rota.
   *
   * @param context Contexto de execução (HTTP).
   * @returns `true` quando o ator tem ao menos um cargo exigido.
   * @throws {UnauthorizedException} Sem ator autenticado.
   * @throws {ForbiddenException} Nenhum cargo autorizado.
   */
  public canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUserEntity }>();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const hasRole = required.some((role) => user.roleCodes.includes(role));
    if (!hasRole) {
      throw new ForbiddenException('Acesso negado.');
    }
    return true;
  }
}

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedUserEntity } from '../../features/auth/domain/entities/authenticated-user.entity';
import { PermissionCode } from '../constants/access-control.constant';
import { REQUIRED_PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';

/**
 * Guard de permissões granulares — usado com `@RequirePermissions()`.
 *
 * Exige que TODAS as permissões declaradas estejam no ator autenticado
 * (`request.user.permissions`, resolvidas por empresa da sessão).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  /**
   * Valida as permissões do ator contra as exigidas pela rota.
   *
   * @param context Contexto de execução (HTTP).
   * @returns `true` quando o ator tem todas as permissões exigidas.
   * @throws {UnauthorizedException} Sem ator autenticado.
   * @throws {ForbiddenException} Permissão insuficiente.
   */
  public canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PermissionCode[]>(
      REQUIRED_PERMISSIONS_KEY,
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

    const missing = required.filter(
      (permission) => !user.permissions.includes(permission),
    );
    if (missing.length > 0) {
      throw new ForbiddenException('Permissão insuficiente.');
    }
    return true;
  }
}

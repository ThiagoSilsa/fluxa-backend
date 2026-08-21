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
 * (`request.user.permissions`, resolvidas por empresa da sessão). Ator com
 * cargo `is_admin` ativo na empresa da sessão ignora as verificações (acesso
 * total — ADR 0004), no mesmo espírito do bypass de papel do AGENTS.md §6.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  /**
   * Valida as permissões do ator contra as exigidas pela rota.
   *
   * @param context Contexto de execução (HTTP).
   * @returns `true` quando o ator tem todas as permissões exigidas (ou é
   * `is_admin`).
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

    // `is_admin` concede acesso total (ADR 0004): ignora as permissões
    // declaradas — o cargo de administração não depende da lista.
    if (user.isAdmin) {
      return true;
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

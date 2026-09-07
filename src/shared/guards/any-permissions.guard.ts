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
import { REQUIRED_ANY_PERMISSIONS_KEY } from '../decorators/require-any-permission.decorator';

/**
 * Guard de permissões "pelo menos uma" — usado com `@RequireAnyPermission()`.
 *
 * Ao contrário do `PermissionsGuard` (que exige TODAS as permissões
 * declaradas), aceita o ator quando ele tem **qualquer uma** das permissões
 * aceitas. Ator com cargo `is_admin` ativo na empresa da sessão ignora as
 * verificações (acesso total — ADR 0004).
 */
@Injectable()
export class AnyPermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  /**
   * Valida as permissões do ator contra as aceitas pela rota (OR).
   *
   * @param context Contexto de execução (HTTP).
   * @returns `true` quando o ator tem ao menos uma permissão aceita (ou é
   * `is_admin`).
   * @throws {UnauthorizedException} Sem ator autenticado.
   * @throws {ForbiddenException} Nenhuma das permissões aceitas presente.
   */
  public canActivate(context: ExecutionContext): boolean {
    const accepted = this.reflector.getAllAndOverride<PermissionCode[]>(
      REQUIRED_ANY_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!accepted || accepted.length === 0) {
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

    if (!accepted.some((permission) => user.permissions.includes(permission))) {
      throw new ForbiddenException('Permissão insuficiente.');
    }
    return true;
  }
}

import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key dos cargos exigidos por rota.
 */
export const REQUIRED_ROLES_KEY = 'required_roles';

/**
 * Declara os cargos (por nome) autorizados a acessar a rota (usado com
 * `RolesGuard`). Basta que o usuário tenha **um** dos cargos.
 *
 * @param roles Nomes de cargos (ex.: `Administração`, `Porteiro`).
 * @returns Decorator de metadata.
 */
export const RequireRoles = (...roles: string[]) =>
  SetMetadata(REQUIRED_ROLES_KEY, roles);

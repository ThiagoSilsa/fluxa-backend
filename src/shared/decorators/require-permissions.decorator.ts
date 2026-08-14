import { SetMetadata } from '@nestjs/common';
import { PermissionCode } from '../constants/access-control.constant';

/**
 * Metadata key das permissões exigidas por rota.
 */
export const REQUIRED_PERMISSIONS_KEY = 'required_permissions';

/**
 * Declara as permissões exigidas para acessar a rota (usado com
 * `PermissionsGuard`). Sempre usar o enum `PermissionCode` — strings
 * hardcoded são proibidas (AGENTS.md).
 *
 * @param permissions Permissões exigidas (todas devem estar presentes).
 * @returns Decorator de metadata.
 */
export const RequirePermissions = (...permissions: PermissionCode[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);

import { SetMetadata } from '@nestjs/common';
import { PermissionCode } from '../constants/access-control.constant';

/**
 * Metadata key das permissões aceitas (basta uma) por rota.
 */
export const REQUIRED_ANY_PERMISSIONS_KEY = 'required_any_permissions';

/**
 * Declara as permissões aceitas para acessar a rota (usado com
 * `AnyPermissionsGuard`) — o ator precisa ter **pelo menos uma** delas.
 *
 * Diferente de `@RequirePermissions` (que exige todas), serve para rotas
 * acessíveis por mais de um papel (ex.: endpoints de seleção usados por quem
 * cria solicitação de acesso OU de bloqueio — ADR 0011). Sempre usar o enum
 * `PermissionCode` — strings hardcoded são proibidas (AGENTS.md).
 *
 * @param permissions Permissões aceitas (basta uma presente no ator).
 * @returns Decorator de metadata.
 */
export const RequireAnyPermission = (...permissions: PermissionCode[]) =>
  SetMetadata(REQUIRED_ANY_PERMISSIONS_KEY, permissions);

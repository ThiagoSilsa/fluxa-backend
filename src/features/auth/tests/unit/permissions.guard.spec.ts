// NestJS
import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';

// Guard
import { PermissionsGuard } from '../../../../shared/guards/permissions.guard';

// Constants
import { UserType } from '../../domain/constants/user-type.constant';

// Types
import type { AuthenticatedUserEntity } from '../../domain/entities/authenticated-user.entity';

/**
 * Fixture de ator — porteiro comum (sem `is_admin`).
 */
const actor: AuthenticatedUserEntity = {
  id: '30000000-0000-0000-0000-000000000001',
  companyId: '10000000-0000-0000-0000-000000000001',
  email: 'porteiro@somar.local',
  name: 'Porteiro',
  type: UserType.EMPLOYEE,
  isAdmin: false,
  roleCodes: ['Porteiro'],
  permissions: [PermissionCode.REGISTER_ENTRY],
};

function contextWithUser(
  user: AuthenticatedUserEntity | undefined,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function createGuard(required: PermissionCode[] | undefined): PermissionsGuard {
  const reflector = {
    getAllAndOverride: jest.fn().mockImplementation(() => required),
  } as unknown as Reflector;
  return new PermissionsGuard(reflector);
}

describe('PermissionsGuard', () => {
  it('libera quando a rota não exige permissões', () => {
    const guard = createGuard(undefined);
    expect(guard.canActivate(contextWithUser(actor))).toBe(true);
  });

  it('lança UnauthorizedException quando não há ator autenticado', () => {
    const guard = createGuard([PermissionCode.MANAGE_ROLES]);
    expect(() => guard.canActivate(contextWithUser(undefined))).toThrow(
      UnauthorizedException,
    );
  });

  it('libera quando o ator tem todas as permissões exigidas', () => {
    const guard = createGuard([PermissionCode.REGISTER_ENTRY]);
    expect(guard.canActivate(contextWithUser(actor))).toBe(true);
  });

  it('lança ForbiddenException quando falta permissão exigida', () => {
    const guard = createGuard([PermissionCode.MANAGE_ROLES]);
    expect(() => guard.canActivate(contextWithUser(actor))).toThrow(
      ForbiddenException,
    );
  });

  it('libera o ator com cargo is_admin mesmo sem a permissão exigida (bypass — ADR 0004)', () => {
    const guard = createGuard([PermissionCode.MANAGE_ROLES]);
    expect(
      guard.canActivate(contextWithUser({ ...actor, isAdmin: true })),
    ).toBe(true);
  });
});

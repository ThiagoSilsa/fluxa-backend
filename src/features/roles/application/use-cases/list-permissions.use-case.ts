// NestJS
import { Inject, Injectable, Logger } from '@nestjs/common';

// Repository
import { PERMISSION_REPOSITORY } from '../../domain/repositories/permission.repository';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { PermissionResponse } from '../dto/role-response';
import type { PermissionRepository } from '../../domain/repositories/permission.repository';

/**
 * Lista o catálogo global de permissões.
 *
 * `permission` é catálogo do sistema (leitura apenas — ADR 0004). O acesso é
 * restrito a `is_admin` OU `MANAGE_ROLES` (guard + bypass da Fase 0).
 */
@Injectable()
export class ListPermissionsUseCase {
  private readonly logger = new Logger(ListPermissionsUseCase.name);

  constructor(
    @Inject(PERMISSION_REPOSITORY)
    private readonly permissionRepository: PermissionRepository,
  ) {}

  /**
   * Devolve o catálogo global de permissões (ordenado por código).
   *
   * @param actor Ator autenticado (obrigatório por convenção — o catálogo é
   * global e não depende da empresa).
   * @returns Catálogo completo.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
  ): Promise<PermissionResponse[]> {
    void actor;

    const permissions = await this.permissionRepository.listAll();
    return permissions.map((permission) => ({
      id: permission.id,
      code: permission.code,
      description: permission.description,
    }));
  }
}

// NestJS
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

// Repository
import { PERMISSION_REPOSITORY } from '../../domain/repositories/permission.repository';
import { ROLE_PERMISSION_REPOSITORY } from '../../domain/repositories/role-permission.repository';
import { ROLE_REPOSITORY } from '../../domain/repositories/role.repository';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { ListRolePermissionsInputDto } from '../dto/list-role-permissions-input.dto';
import type { ListRolePermissionsResponse } from '../dto/role-permission-response';
import type { PermissionRepository } from '../../domain/repositories/permission.repository';
import type { RolePermissionRepository } from '../../domain/repositories/role-permission.repository';
import type { RoleRepository } from '../../domain/repositories/role.repository';

/**
 * Lista as permissões de um cargo da empresa da sessão, com o catálogo global
 * disponível para associar.
 */
@Injectable()
export class ListRolePermissionsUseCase {
  private readonly logger = new Logger(ListRolePermissionsUseCase.name);

  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: RoleRepository,
    @Inject(ROLE_PERMISSION_REPOSITORY)
    private readonly rolePermissionRepository: RolePermissionRepository,
    @Inject(PERMISSION_REPOSITORY)
    private readonly permissionRepository: PermissionRepository,
  ) {}

  /**
   * Devolve as permissões vinculadas ao cargo + o catálogo disponível.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Cargo consultado.
   * @returns Permissões vinculadas e catálogo disponível.
   * @throws {NotFoundException} Cargo não existe na empresa.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: ListRolePermissionsInputDto,
  ): Promise<ListRolePermissionsResponse> {
    const role = await this.roleRepository.findByIdAndCompanyId(
      input.roleId,
      actor.companyId,
    );
    if (!role) {
      throw new NotFoundException('Cargo não encontrado.');
    }

    const [links, catalog] = await Promise.all([
      this.rolePermissionRepository.listByRoleIdAndCompanyId(
        input.roleId,
        actor.companyId,
      ),
      this.permissionRepository.listAll(),
    ]);

    return {
      roleId: input.roleId,
      permissions: links.map((link) => ({
        id: link.permission.id,
        code: link.permission.code,
        description: link.permission.description,
      })),
      available: catalog.map((permission) => ({
        id: permission.id,
        code: permission.code,
        description: permission.description,
      })),
    };
  }
}

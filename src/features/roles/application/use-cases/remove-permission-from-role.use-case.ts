// NestJS
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

// Repository
import { ROLE_PERMISSION_REPOSITORY } from '../../domain/repositories/role-permission.repository';
import { ROLE_REPOSITORY } from '../../domain/repositories/role.repository';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { RemovePermissionInputDto } from '../dto/remove-permission-input.dto';
import type { RolePermissionRepository } from '../../domain/repositories/role-permission.repository';
import type { RoleRepository } from '../../domain/repositories/role.repository';

/**
 * Remove a associação de uma permissão a um cargo da empresa da sessão.
 */
@Injectable()
export class RemovePermissionFromRoleUseCase {
  private readonly logger = new Logger(RemovePermissionFromRoleUseCase.name);

  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: RoleRepository,
    @Inject(ROLE_PERMISSION_REPOSITORY)
    private readonly rolePermissionRepository: RolePermissionRepository,
  ) {}

  /**
   * Remove o vínculo cargo ↔ permissão da empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Cargo e permissão a desvincular.
   * @returns Promise resolvida quando o vínculo é removido.
   * @throws {NotFoundException} Cargo não existe na empresa ou vínculo ausente.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: RemovePermissionInputDto,
  ): Promise<void> {
    const role = await this.roleRepository.findByIdAndCompanyId(
      input.roleId,
      actor.companyId,
    );
    if (!role) {
      throw new NotFoundException('Cargo não encontrado.');
    }

    const removed = await this.rolePermissionRepository.remove(
      actor.companyId,
      input.roleId,
      input.permissionId,
    );
    if (!removed) {
      throw new NotFoundException('Vínculo não encontrado.');
    }
  }
}

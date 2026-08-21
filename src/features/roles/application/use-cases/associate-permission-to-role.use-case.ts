// NestJS
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

// Repository
import { PERMISSION_REPOSITORY } from '../../domain/repositories/permission.repository';
import { ROLE_PERMISSION_REPOSITORY } from '../../domain/repositories/role-permission.repository';
import { ROLE_REPOSITORY } from '../../domain/repositories/role.repository';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { AssociatePermissionInputDto } from '../dto/associate-permission-input.dto';
import type { PermissionResponse } from '../dto/role-response';
import type { PermissionRepository } from '../../domain/repositories/permission.repository';
import type { RolePermissionRepository } from '../../domain/repositories/role-permission.repository';
import type { RoleRepository } from '../../domain/repositories/role.repository';

/**
 * Associa uma permissão do catálogo global a um cargo da empresa da sessão.
 *
 * Regras (ADR 0004): cargo deve existir na empresa, permissão deve existir no
 * catálogo global e o vínculo não pode ser duplicado (unique
 * `(company_id, role_id, permission_id)`).
 */
@Injectable()
export class AssociatePermissionToRoleUseCase {
  private readonly logger = new Logger(AssociatePermissionToRoleUseCase.name);

  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: RoleRepository,
    @Inject(PERMISSION_REPOSITORY)
    private readonly permissionRepository: PermissionRepository,
    @Inject(ROLE_PERMISSION_REPOSITORY)
    private readonly rolePermissionRepository: RolePermissionRepository,
  ) {}

  /**
   * Valida cargo/permissão e grava o vínculo escopado pela empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Cargo e permissão a vincular.
   * @returns Permissão vinculada.
   * @throws {NotFoundException} Cargo não existe na empresa ou permissão não
   * existe no catálogo.
   * @throws {ConflictException} Vínculo já existente.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: AssociatePermissionInputDto,
  ): Promise<PermissionResponse> {
    const role = await this.roleRepository.findByIdAndCompanyId(
      input.roleId,
      actor.companyId,
    );
    if (!role) {
      throw new NotFoundException('Cargo não encontrado.');
    }

    const permission = await this.permissionRepository.findById(
      input.permissionId,
    );
    if (!permission) {
      throw new NotFoundException('Permissão não encontrada.');
    }

    if (
      await this.rolePermissionRepository.exists(
        actor.companyId,
        input.roleId,
        input.permissionId,
      )
    ) {
      throw new ConflictException('Permissão já vinculada ao cargo.');
    }

    await this.rolePermissionRepository.associate(
      actor.companyId,
      input.roleId,
      input.permissionId,
    );

    return {
      id: permission.id,
      code: permission.code,
      description: permission.description,
    };
  }
}

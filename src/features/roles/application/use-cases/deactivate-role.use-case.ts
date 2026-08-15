// NestJS
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

// Repository
import { ROLE_REPOSITORY } from '../../domain/repositories/role.repository';

// Mapper
import { toRoleResponse } from '../utils/role-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { GetRoleInputDto } from '../dto/get-role-input.dto';
import type { RoleResponse } from '../dto/role-response';
import type { RoleRepository } from '../../domain/repositories/role.repository';

/**
 * Desativa um cargo da empresa da sessão (soft: `is_active = false`).
 *
 * A desativação **não remove** vínculos existentes em `role_permission` e
 * `user_role` (ADR 0004) — apenas impede novos usos. Cargos `is_admin` são
 * imutáveis.
 */
@Injectable()
export class DeactivateRoleUseCase {
  private readonly logger = new Logger(DeactivateRoleUseCase.name);

  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: RoleRepository,
  ) {}

  /**
   * Desativa o cargo da empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Id do cargo.
   * @returns Cargo desativado.
   * @throws {NotFoundException} Quando o cargo não existe na empresa.
   * @throws {BadRequestException} Quando o cargo é `is_admin` (imutável).
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: GetRoleInputDto,
  ): Promise<RoleResponse> {
    const existing = await this.roleRepository.findByIdAndCompanyId(
      input.id,
      actor.companyId,
    );
    if (!existing) {
      throw new NotFoundException('Cargo não encontrado.');
    }
    if (existing.isAdmin) {
      throw new BadRequestException(
        'Cargos de administração não podem ser desativados.',
      );
    }

    const updated = await this.roleRepository.deactivateByIdAndCompanyId(
      input.id,
      actor.companyId,
    );
    if (!updated) {
      throw new NotFoundException('Cargo não encontrado.');
    }
    return toRoleResponse(updated);
  }
}

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

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { GetRoleInputDto } from '../dto/get-role-input.dto';
import type { RoleRepository } from '../../domain/repositories/role.repository';

/**
 * Exclui fisicamente um cargo da empresa da sessão, em **cascata** (ADR 0004
 * §5): remove os vínculos em `role_permission` e desvincula os usuários
 * (`user_role`) — quem estava vinculado fica sem cargo. A exclusão é
 * irreversível. Cargos `is_admin` são imutáveis.
 */
@Injectable()
export class DeleteRoleUseCase {
  private readonly logger = new Logger(DeleteRoleUseCase.name);

  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: RoleRepository,
  ) {}

  /**
   * Exclui o cargo da empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Id do cargo.
   * @throws {NotFoundException} Quando o cargo não existe na empresa.
   * @throws {BadRequestException} Quando o cargo é `is_admin` (imutável).
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: GetRoleInputDto,
  ): Promise<void> {
    const existing = await this.roleRepository.findByIdAndCompanyId(
      input.id,
      actor.companyId,
    );
    if (!existing) {
      throw new NotFoundException('Cargo não encontrado.');
    }
    if (existing.isAdmin) {
      throw new BadRequestException(
        'Cargos de administração não podem ser excluídos.',
      );
    }

    const deleted = await this.roleRepository.deleteByIdAndCompanyId(
      input.id,
      actor.companyId,
    );
    if (!deleted) {
      throw new NotFoundException('Cargo não encontrado.');
    }
  }
}

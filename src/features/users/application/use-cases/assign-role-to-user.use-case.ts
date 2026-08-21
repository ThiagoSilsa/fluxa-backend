// NestJS
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

// Repositories
import { AUTH_REPOSITORY } from '../../../auth/domain/repositories/auth.repository';
import { USER_COMPANY_REPOSITORY } from '../../../auth/domain/repositories/user-company.repository';
import { ROLE_REPOSITORY } from '../../../roles/domain/repositories/role.repository';
import { USER_ROLE_REPOSITORY } from '../../domain/repositories/user-role.repository';

// Types
import type { AuthRepository } from '../../../auth/domain/repositories/auth.repository';
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { UserCompanyRepository } from '../../../auth/domain/repositories/user-company.repository';
import type { RoleRepository } from '../../../roles/domain/repositories/role.repository';
import type { UserRoleRepository } from '../../domain/repositories/user-role.repository';
import type { AssignRoleInputDto } from '../dto/assign-role-input.dto';

/**
 * Atribui um cargo a um usuário na empresa da sessão (ADR 0005 §5).
 *
 * - Cargo deve pertencer à empresa da sessão (senão 404);
 * - Duplicidade (`user_role` unique) → 409;
 * - **Governança**: atribuir cargo `is_admin` exige ator `is_admin` (403);
 *   gerenciar cargos de um usuário admin também exige ator `is_admin` (403).
 */
@Injectable()
export class AssignRoleToUserUseCase {
  private readonly logger = new Logger(AssignRoleToUserUseCase.name);

  constructor(
    @Inject(USER_COMPANY_REPOSITORY)
    private readonly userCompanyRepository: UserCompanyRepository,
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: RoleRepository,
    @Inject(USER_ROLE_REPOSITORY)
    private readonly userRoleRepository: UserRoleRepository,
    @Inject(AUTH_REPOSITORY)
    private readonly authRepository: AuthRepository,
  ) {}

  /**
   * Atribui o cargo ao usuário na empresa da sessão.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Id da pessoa e id do cargo.
   * @throws {NotFoundException} Usuário sem vínculo ou cargo fora da empresa.
   * @throws {ForbiddenException} Atribuir cargo `is_admin` ou gerenciar cargo
   * de usuário admin sem ser administrador.
   * @throws {ConflictException} Quando o usuário já possui o cargo.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: AssignRoleInputDto,
  ): Promise<void> {
    const link = await this.userCompanyRepository.findByUserIdAndCompanyId(
      input.userId,
      actor.companyId,
    );
    if (!link) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const role = await this.roleRepository.findByIdAndCompanyId(
      input.roleId,
      actor.companyId,
    );
    if (!role) {
      throw new NotFoundException('Cargo não encontrado.');
    }

    const targetIsAdmin =
      await this.authRepository.findHasAdminRoleByUserIdAndCompanyId(
        input.userId,
        actor.companyId,
      );
    if (targetIsAdmin && !actor.isAdmin) {
      throw new ForbiddenException(
        'Apenas administradores podem gerenciar usuários administradores.',
      );
    }
    if (role.isAdmin && !actor.isAdmin) {
      throw new ForbiddenException(
        'Apenas administradores podem atribuir cargos de administração.',
      );
    }

    // 1 cargo por empresa (ADR 0005 §5): o unique (company_id, user_id) garante
    // no banco; aqui traduzimos o caso em 409 antes de tentar gravar.
    const currentRoles = await this.userRoleRepository.listByUserIdAndCompanyId(
      input.userId,
      actor.companyId,
    );
    if (currentRoles.length > 0) {
      throw new ConflictException('Usuário já possui um cargo nesta empresa.');
    }

    await this.userRoleRepository.create(
      input.userId,
      input.roleId,
      actor.companyId,
    );
  }
}

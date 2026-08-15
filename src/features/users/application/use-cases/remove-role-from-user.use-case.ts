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
import type { RemoveRoleInputDto } from '../dto/remove-role-input.dto';

/**
 * Remove um cargo de um usuário na empresa da sessão (ADR 0005 §5).
 *
 * - Cargo deve pertencer à empresa (senão 404) e estar atribuído (senão 404);
 * - **Governança**: remover cargo `is_admin` exige ator `is_admin` (403);
 *   gerenciar cargos de um usuário admin exige ator `is_admin` (403);
 * - **Invariante**: remover o cargo `is_admin` do último admin ativo → 409.
 */
@Injectable()
export class RemoveRoleFromUserUseCase {
  private readonly logger = new Logger(RemoveRoleFromUserUseCase.name);

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
   * Remove o cargo do usuário na empresa da sessão.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Id da pessoa e id do cargo.
   * @throws {NotFoundException} Usuário sem vínculo, cargo fora da empresa ou
   * cargo não atribuído ao usuário.
   * @throws {ForbiddenException} Remover cargo `is_admin` ou gerenciar cargo
   * de usuário admin sem ser administrador.
   * @throws {ConflictException} Remover o cargo do último admin ativo.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: RemoveRoleInputDto,
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

    const exists = await this.userRoleRepository.exists(
      input.userId,
      input.roleId,
      actor.companyId,
    );
    if (!exists) {
      throw new NotFoundException('Usuário não possui este cargo.');
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
        'Apenas administradores podem retirar cargos de administração.',
      );
    }

    if (role.isAdmin) {
      const admins = await this.authRepository.countAdminsByCompanyId(
        actor.companyId,
      );
      if (admins <= 1) {
        throw new ConflictException(
          'Não é possível remover o último administrador ativo da empresa.',
        );
      }
    }

    await this.userRoleRepository.remove(
      input.userId,
      input.roleId,
      actor.companyId,
    );
  }
}

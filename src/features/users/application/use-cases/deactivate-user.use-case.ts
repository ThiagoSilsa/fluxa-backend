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
import { USER_ROLE_REPOSITORY } from '../../domain/repositories/user-role.repository';

// Mapper
import { toUserResponse } from '../utils/user-response.mapper';

// Types
import type { AuthRepository } from '../../../auth/domain/repositories/auth.repository';
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { UserCompanyRepository } from '../../../auth/domain/repositories/user-company.repository';
import type { UserRoleRepository } from '../../domain/repositories/user-role.repository';
import type { GetUserInputDto } from '../dto/get-user-input.dto';
import type { UserResponse } from '../dto/user-response';

/**
 * Desativa a participação do usuário na empresa da sessão (soft — ADR 0005
 * §4): `user_company.is_active = false`. Não exclui a pessoa nem remove dados.
 *
 * **Invariante**: não é possível desativar o **último** usuário com cargo
 * `is_admin` ativo → 409. **Gestão de admin é exclusiva de admin** → 403.
 */
@Injectable()
export class DeactivateUserUseCase {
  private readonly logger = new Logger(DeactivateUserUseCase.name);

  constructor(
    @Inject(USER_COMPANY_REPOSITORY)
    private readonly userCompanyRepository: UserCompanyRepository,
    @Inject(AUTH_REPOSITORY)
    private readonly authRepository: AuthRepository,
    @Inject(USER_ROLE_REPOSITORY)
    private readonly userRoleRepository: UserRoleRepository,
  ) {}

  /**
   * Desativa o vínculo do usuário com a empresa da sessão.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Id da pessoa.
   * @returns Usuário com o vínculo desativado.
   * @throws {NotFoundException} Usuário sem vínculo com a empresa.
   * @throws {ForbiddenException} Desativação de usuário admin por não-admin.
   * @throws {ConflictException} Desativação do último administrador ativo.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: GetUserInputDto,
  ): Promise<UserResponse> {
    const link = await this.userCompanyRepository.findByUserIdAndCompanyId(
      input.id,
      actor.companyId,
    );
    if (!link) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const targetIsAdmin =
      await this.authRepository.findHasAdminRoleByUserIdAndCompanyId(
        input.id,
        actor.companyId,
      );
    if (targetIsAdmin && !actor.isAdmin) {
      throw new ForbiddenException(
        'Apenas administradores podem gerenciar usuários administradores.',
      );
    }
    if (targetIsAdmin) {
      const admins = await this.authRepository.countAdminsByCompanyId(
        actor.companyId,
      );
      if (admins <= 1) {
        throw new ConflictException(
          'Não é possível remover o último administrador ativo da empresa.',
        );
      }
    }

    const updated = await this.userCompanyRepository.updateById(link.linkId, {
      isActive: false,
    });
    if (!updated) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const role = await this.userRoleRepository.listByUserIdAndCompanyId(
      input.id,
      actor.companyId,
    );
    return toUserResponse({ ...link, isActive: false }, role[0] ?? null);
  }
}

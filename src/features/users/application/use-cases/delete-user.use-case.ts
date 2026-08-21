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
import { USER_REPOSITORY } from '../../domain/repositories/user.repository';

// Types
import type { AuthRepository } from '../../../auth/domain/repositories/auth.repository';
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { UserCompanyRepository } from '../../../auth/domain/repositories/user-company.repository';
import type { UserRepository } from '../../domain/repositories/user.repository';
import type { GetUserInputDto } from '../dto/get-user-input.dto';

/**
 * Exclui a participação do usuário na empresa da sessão (físico — ADR 0005
 * §4): remove o cargo (`user_role`) e o vínculo (`user_company`); se for a
 * **última empresa** da pessoa **sem histórico operacional**, remove também a
 * pessoa (`user`).
 *
 * **Invariante**: não é possível excluir o **último** usuário com cargo
 * `is_admin` ativo → 409. **Gestão de admin é exclusiva de admin** → 403.
 */
@Injectable()
export class DeleteUserUseCase {
  private readonly logger = new Logger(DeleteUserUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(USER_COMPANY_REPOSITORY)
    private readonly userCompanyRepository: UserCompanyRepository,
    @Inject(AUTH_REPOSITORY)
    private readonly authRepository: AuthRepository,
  ) {}

  /**
   * Exclui a participação do usuário na empresa da sessão.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Id da pessoa.
   * @throws {NotFoundException} Usuário sem vínculo com a empresa.
   * @throws {ForbiddenException} Exclusão de usuário admin por não-admin.
   * @throws {ConflictException} Exclusão do último administrador ativo.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: GetUserInputDto,
  ): Promise<void> {
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

    await this.userRepository.removeCompanyLink(
      input.id,
      actor.companyId,
      link.linkId,
    );
  }
}

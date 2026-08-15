// NestJS
import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

// Shared
import { PasswordHashUseCase } from '../../../../shared/security/password-hash.use-case';

// Repositories
import { AUTH_REPOSITORY } from '../../../auth/domain/repositories/auth.repository';
import { USER_COMPANY_REPOSITORY } from '../../../auth/domain/repositories/user-company.repository';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository';

// Types
import type { AuthRepository } from '../../../auth/domain/repositories/auth.repository';
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { UserCompanyRepository } from '../../../auth/domain/repositories/user-company.repository';
import type { UserRepository } from '../../domain/repositories/user.repository';
import type { ChangePasswordInputDto } from '../dto/change-password-input.dto';

/**
 * Troca de senha **provisória** por `MANAGE_USERS` (ADR 0005 §6).
 *
 * A senha é da pessoa (ADR 0002): a troca vale para todos os vínculos
 * (efeito cross-tenant aceito). Será substituída pela recuperação de senha.
 * O alvo precisa ter **vínculo ativo** com a empresa da sessão (senão 404);
 * trocar a senha de um usuário admin exige ator `is_admin` (403).
 */
@Injectable()
export class ChangePasswordUseCase {
  private readonly logger = new Logger(ChangePasswordUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(USER_COMPANY_REPOSITORY)
    private readonly userCompanyRepository: UserCompanyRepository,
    @Inject(AUTH_REPOSITORY)
    private readonly authRepository: AuthRepository,
    private readonly passwordHash: PasswordHashUseCase,
  ) {}

  /**
   * Troca a senha da pessoa.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Id da pessoa e nova senha.
   * @throws {NotFoundException} Pessoa sem vínculo ativo com a empresa.
   * @throws {ForbiddenException} Troca de senha de usuário admin por não-admin.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: ChangePasswordInputDto,
  ): Promise<void> {
    const link = await this.userCompanyRepository.findByUserIdAndCompanyId(
      input.id,
      actor.companyId,
    );
    if (!link || !link.isActive) {
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

    // TODO: <Tarefa Futura> Troca de senha provisória por MANAGE_USERS — será
    // substituída pela recuperação de senha da pessoa (ADR 0005 §7); aí
    // nenhuma empresa poderá trocar a senha do usuário.
    // TODO: <Tarefa Futura> Registrar a troca de senha na auditoria quando ela
    // entrar no escopo (audit_log).
    const hash = this.passwordHash.execute(input.newPassword);
    await this.userRepository.updatePasswordById(input.id, hash);
  }
}

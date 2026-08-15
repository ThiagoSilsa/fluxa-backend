// NestJS
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

// Shared
import { normalizeEmail } from '../../../../shared/utils/email.util';

// Repositories
import { AUTH_REPOSITORY } from '../../../auth/domain/repositories/auth.repository';
import { USER_COMPANY_REPOSITORY } from '../../../auth/domain/repositories/user-company.repository';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository';

// Mapper
import { toUserResponse } from '../utils/user-response.mapper';

// Types
import type { AuthRepository } from '../../../auth/domain/repositories/auth.repository';
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { UpdateUserCompanyRepositoryData } from '../../../auth/domain/repositories/user-company.repository';
import type { UserCompanyRepository } from '../../../auth/domain/repositories/user-company.repository';
import type { UpdateUserRepositoryData } from '../../domain/repositories/user.repository';
import type { UserRepository } from '../../domain/repositories/user.repository';
import type { UpdateUserInputDto } from '../dto/update-user-input.dto';
import type { UserResponse } from '../dto/user-response';

/**
 * Edição parcial de usuário (ADR 0005 §3).
 *
 * - **Dados da pessoa** (`name`, `email`, `phone`, `document`, `observation`)
 *   refletem em todas as empresas onde a pessoa participa;
 * - **Dados do vínculo** (`type`, `is_active`) afetam só a empresa da sessão;
 * - `email`/`document` conflitantes → 409 (unicidade global);
 * - `is_active = false` está sujeito à **invariante do último administrador**;
 * - **Gestão de admin é exclusiva de admin**: usuário com cargo `is_admin`
 *   ativo só é editado por ator com `is_admin` ativo → 403.
 */
@Injectable()
export class UpdateUserUseCase {
  private readonly logger = new Logger(UpdateUserUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(USER_COMPANY_REPOSITORY)
    private readonly userCompanyRepository: UserCompanyRepository,
    @Inject(AUTH_REPOSITORY)
    private readonly authRepository: AuthRepository,
  ) {}

  /**
   * Atualiza parcialmente o usuário na empresa da sessão.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Id da pessoa e campos a atualizar.
   * @returns Usuário atualizado.
   * @throws {NotFoundException} Usuário sem vínculo com a empresa.
   * @throws {ForbiddenException} Edição de usuário admin por não-admin.
   * @throws {ConflictException} `email`/`document` de outra pessoa, ou
   * desativar o último administrador ativo.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: UpdateUserInputDto,
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

    if (input.isActive === false && targetIsAdmin) {
      await this.enforceLastAdminInvariant(actor.companyId);
    }

    await this.updatePerson(input);
    await this.updateLink(link.linkId, input);

    const updated = await this.userCompanyRepository.findByUserIdAndCompanyId(
      input.id,
      actor.companyId,
    );
    if (!updated) {
      throw new NotFoundException('Usuário não encontrado.');
    }
    return toUserResponse(updated);
  }

  /**
   * Aplica a invariante do último administrador (409 quando só há um admin).
   *
   * @param companyId Empresa da sessão.
   * @throws {ConflictException} Quando a empresa tem um único admin ativo.
   */
  private async enforceLastAdminInvariant(companyId: string): Promise<void> {
    const admins = await this.authRepository.countAdminsByCompanyId(companyId);
    if (admins <= 1) {
      throw new ConflictException(
        'Não é possível remover o último administrador ativo da empresa.',
      );
    }
  }

  /**
   * Atualiza os dados da pessoa (refletem em todas as empresas).
   *
   * @param input Campos de pessoa a atualizar.
   * @throws {ConflictException} E-mail/documento de outra pessoa.
   */
  private async updatePerson(input: UpdateUserInputDto): Promise<void> {
    const data: UpdateUserRepositoryData = {};

    if (input.email !== undefined) {
      const normalizedEmail = normalizeEmail(input.email);
      const byEmail = await this.userRepository.findByEmail(normalizedEmail);
      if (byEmail && byEmail.id !== input.id) {
        throw new ConflictException('E-mail já cadastrado.');
      }
      data.email = normalizedEmail;
    }

    if (input.document !== undefined && input.document !== null) {
      const byDocument = await this.userRepository.findByDocument(
        input.document,
      );
      if (byDocument && byDocument.id !== input.id) {
        throw new ConflictException('Documento já cadastrado.');
      }
    }

    if (input.name !== undefined) {
      data.name = input.name;
    }
    if (input.phone !== undefined) {
      data.phone = input.phone;
    }
    if (input.document !== undefined) {
      data.document = input.document;
    }
    if (input.observation !== undefined) {
      data.observation = input.observation;
    }

    if (Object.keys(data).length > 0) {
      await this.userRepository.updateById(input.id, data);
    }
  }

  /**
   * Atualiza os dados do vínculo (`type`/`is_active`) da empresa da sessão.
   *
   * @param linkId Id do vínculo.
   * @param input Campos de vínculo a atualizar.
   */
  private async updateLink(
    linkId: string,
    input: UpdateUserInputDto,
  ): Promise<void> {
    const data: UpdateUserCompanyRepositoryData = {};
    if (input.type !== undefined) {
      data.type = input.type;
    }
    if (input.isActive !== undefined) {
      data.isActive = input.isActive;
    }
    if (Object.keys(data).length > 0) {
      await this.userCompanyRepository.updateById(linkId, data);
    }
  }
}

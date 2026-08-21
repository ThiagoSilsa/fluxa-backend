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
import { ROLE_REPOSITORY } from '../../../roles/domain/repositories/role.repository';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository';
import { USER_ROLE_REPOSITORY } from '../../domain/repositories/user-role.repository';

// Mapper
import { toUserResponse } from '../utils/user-response.mapper';

// Types
import type { AuthRepository } from '../../../auth/domain/repositories/auth.repository';
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { UpdateUserCompanyRepositoryData } from '../../../auth/domain/repositories/user-company.repository';
import type { UserCompanyRepository } from '../../../auth/domain/repositories/user-company.repository';
import type { RoleEntity } from '../../../roles/domain/entities/role.entity';
import type { RoleRepository } from '../../../roles/domain/repositories/role.repository';
import type { UpdateUserRepositoryData } from '../../domain/repositories/user.repository';
import type { UserRepository } from '../../domain/repositories/user.repository';
import type { UserRoleRepository } from '../../domain/repositories/user-role.repository';
import type { UpdateUserInputDto } from '../dto/update-user-input.dto';
import type { UserResponse } from '../dto/user-response';

/**
 * Edição parcial de usuário (ADR 0005 §3).
 *
 * - **Dados da pessoa** (`name`, `email`, `phone`, `document`)
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
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: RoleRepository,
    @Inject(USER_ROLE_REPOSITORY)
    private readonly userRoleRepository: UserRoleRepository,
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

    if (input.roleId !== undefined) {
      await this.replaceRole(actor, input.id, input.roleId);
    }

    const updated = await this.userCompanyRepository.findByUserIdAndCompanyId(
      input.id,
      actor.companyId,
    );
    if (!updated) {
      throw new NotFoundException('Usuário não encontrado.');
    }
    const role = await this.userRoleRepository.listByUserIdAndCompanyId(
      input.id,
      actor.companyId,
    );
    return toUserResponse(updated, role[0] ?? null);
  }

  /**
   * Troca o cargo único do usuário na empresa (ADR 0005 §5).
   *
   * `roleId` nulo remove o cargo; UUID válido substitui o atual pelo novo.
   * Aplica a mesma governança dos endpoints de cargo: cargo fora da empresa →
   * 404; atribuir/retirar `is_admin` exige ator `is_admin` (403 — o alvo admin
   * já é bloqueado no início do `execute`); remover `is_admin` do último admin
   * ativo → 409.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param userId Id da pessoa.
   * @param roleId Novo cargo (ou `null` para remover).
   * @throws {NotFoundException} Cargo fora da empresa.
   * @throws {ForbiddenException} Atribuir cargo `is_admin` sem ser admin.
   * @throws {ConflictException} Remover o cargo do último admin ativo.
   */
  private async replaceRole(
    actor: AuthenticatedUserEntity,
    userId: string,
    roleId: string | null,
  ): Promise<void> {
    const currentRoles = await this.userRoleRepository.listByUserIdAndCompanyId(
      userId,
      actor.companyId,
    );
    const current = currentRoles[0] ?? null;

    // Nada a fazer quando o cargo já é o mesmo.
    if (current && current.roleId === roleId) {
      return;
    }

    // Removendo um cargo is_admin (troca ou remoção): a empresa não pode
    // ficar sem nenhum administrador ativo.
    if (current && current.roleIsAdmin) {
      const admins = await this.authRepository.countAdminsByCompanyId(
        actor.companyId,
      );
      if (admins <= 1) {
        throw new ConflictException(
          'Não é possível remover o último administrador ativo da empresa.',
        );
      }
    }

    let newRole: RoleEntity | null = null;
    if (roleId !== null) {
      newRole = await this.roleRepository.findByIdAndCompanyId(
        roleId,
        actor.companyId,
      );
      if (!newRole) {
        throw new NotFoundException('Cargo não encontrado.');
      }
      if (newRole.isAdmin && !actor.isAdmin) {
        throw new ForbiddenException(
          'Apenas administradores podem atribuir cargos de administração.',
        );
      }
    }

    if (current) {
      await this.userRoleRepository.remove(
        userId,
        current.roleId,
        actor.companyId,
      );
    }
    if (newRole) {
      await this.userRoleRepository.create(userId, newRole.id, actor.companyId);
    }
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

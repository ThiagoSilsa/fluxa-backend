// NestJS
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

// Shared
import { PasswordHashUseCase } from '../../../../shared/security/password-hash.use-case';
import { normalizeEmail } from '../../../../shared/utils/email.util';

// Constants
import { UserType } from '../../../auth/domain/constants/user-type.constant';

// Repositories
import { USER_COMPANY_REPOSITORY } from '../../../auth/domain/repositories/user-company.repository';
import { ROLE_REPOSITORY } from '../../../roles/domain/repositories/role.repository';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository';
import { USER_ROLE_REPOSITORY } from '../../domain/repositories/user-role.repository';

// Mapper
import { toCreatedUserResponse } from '../utils/user-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { UserCompanyRepository } from '../../../auth/domain/repositories/user-company.repository';
import type { RoleEntity } from '../../../roles/domain/entities/role.entity';
import type { RoleRepository } from '../../../roles/domain/repositories/role.repository';
import type { UserEntity } from '../../domain/entities/user.entity';
import type { UserRoleWithRoleEntity } from '../../domain/entities/user-role.entity';
import type { UserRoleRepository } from '../../domain/repositories/user-role.repository';
import type { CreateUserInputDto } from '../dto/create-user-input.dto';
import type { CreateUserResponse } from '../dto/user-response';
import type { UserRepository } from '../../domain/repositories/user.repository';

/**
 * Cria um usuário **já vinculado** à empresa do ator (ADR 0005 §2).
 *
 * - Pessoa não existe (busca por e-mail normalizado) → cria `user` +
 *   `user_company` na mesma transação (via repositório);
 * - Pessoa já existe em outra empresa → cria **apenas** o `user_company`;
 *   o body **não pode** conter dados da pessoa ou senha → 400;
 * - Vínculo já existente → 409; documento de outra pessoa → 409;
 * - Violação de unique (concorrência) é traduzida em 409, nunca 500 cru.
 */
@Injectable()
export class CreateUserUseCase {
  private readonly logger = new Logger(CreateUserUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(USER_COMPANY_REPOSITORY)
    private readonly userCompanyRepository: UserCompanyRepository,
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: RoleRepository,
    @Inject(USER_ROLE_REPOSITORY)
    private readonly userRoleRepository: UserRoleRepository,
    private readonly passwordHash: PasswordHashUseCase,
  ) {}

  /**
   * Cria o usuário já vinculado à empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Dados de criação (email, type, e dados da pessoa quando nova).
   * @returns Pessoa + vínculo, com `createdUser` indicando se a pessoa era nova.
   * @throws {BadRequestException} Dados da pessoa/senha enviados no vínculo de
   * pessoa existente, ou nome/senha ausentes para pessoa nova.
   * @throws {ConflictException} Vínculo já existente, documento de outra pessoa
   * ou violação de unique (concorrência).
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: CreateUserInputDto,
  ): Promise<CreateUserResponse> {
    const email = this.normalizeOptionalEmail(input.email);
    const existing = email
      ? await this.userRepository.findByEmail(email)
      : null;

    if (existing) {
      return this.linkExistingPerson(actor, input, existing);
    }
    return this.createNewPerson(actor, input, email);
  }

  /**
   * Cria pessoa nova + vínculo (transação no repositório).
   *
   * @param actor Ator autenticado.
   * @param input Dados de criação.
   * @param email E-mail normalizado.
   * @returns Pessoa criada com `createdUser: true`.
   */
  private async createNewPerson(
    actor: AuthenticatedUserEntity,
    input: CreateUserInputDto,
    email: string | null,
  ): Promise<CreateUserResponse> {
    if (!this.hasValue(input.name)) {
      throw new BadRequestException(
        'Nome é obrigatório para criar um usuário.',
      );
    }

    // Colaborador acessa o sistema: exige e-mail, senha e cargo (ADR 0013).
    // Visitante não tem credenciais nem cargo.
    const isEmployee = input.type === UserType.EMPLOYEE;
    if (isEmployee) {
      if (!email) {
        throw new BadRequestException(
          'E-mail é obrigatório para criar um colaborador.',
        );
      }
      if (!this.hasValue(input.password)) {
        throw new BadRequestException(
          'Senha é obrigatória para criar um colaborador.',
        );
      }
      if (!this.hasValue(input.roleId)) {
        throw new BadRequestException(
          'Cargo é obrigatório para criar um colaborador.',
        );
      }
    }

    if (this.hasValue(input.document)) {
      const byDocument = await this.userRepository.findByDocument(
        input.document as string,
      );
      if (byDocument) {
        throw new ConflictException('Documento já cadastrado.');
      }
    }

    const role = isEmployee
      ? await this.resolveRole(actor, input.roleId)
      : null;

    try {
      const user = await this.userRepository.create({
        name: input.name as string,
        email,
        // Visitante nunca recebe senha (ADR 0013).
        passwordHash: isEmployee
          ? this.passwordHash.execute(input.password as string)
          : null,
        phone: input.phone ?? null,
        document: input.document ?? null,
        companyId: actor.companyId,
        type: input.type,
        isActive: true,
        roleId: role?.id,
      });
      const roleSummary = await this.fetchRoleSummary(user.id, actor.companyId);
      return toCreatedUserResponse(user, input.type, true, true, roleSummary);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('E-mail ou documento já cadastrado.');
      }
      throw error;
    }
  }

  /**
   * Vincula pessoa já existente à empresa do ator (sem criar `user` novo).
   *
   * @param actor Ator autenticado.
   * @param input Dados de criação (só `email` e `type` são aceitos).
   * @param existing Pessoa já existente (identidade global).
   * @returns Pessoa existente com `createdUser: false`.
   */
  private async linkExistingPerson(
    actor: AuthenticatedUserEntity,
    input: CreateUserInputDto,
    existing: UserEntity,
  ): Promise<CreateUserResponse> {
    if (
      this.hasValue(input.name) ||
      this.hasValue(input.password) ||
      this.hasValue(input.phone) ||
      this.hasValue(input.document)
    ) {
      throw new BadRequestException(
        'Não é possível alterar dados da pessoa ao vincular um usuário existente.',
      );
    }

    const alreadyLinked =
      await this.userCompanyRepository.existsByUserIdAndCompanyId(
        existing.id,
        actor.companyId,
      );
    if (alreadyLinked) {
      throw new ConflictException('Usuário já vinculado a esta empresa.');
    }

    const role = await this.resolveRole(actor, input.roleId);

    try {
      await this.userCompanyRepository.create({
        userId: existing.id,
        companyId: actor.companyId,
        type: input.type,
        isActive: true,
      });

      if (role) {
        await this.userRoleRepository.create(
          existing.id,
          role.id,
          actor.companyId,
        );
      }

      const roleSummary = await this.fetchRoleSummary(
        existing.id,
        actor.companyId,
      );
      return toCreatedUserResponse(
        existing,
        input.type,
        true,
        false,
        roleSummary,
      );
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Usuário já vinculado a esta empresa.');
      }
      throw error;
    }
  }

  /**
   * Valida o cargo a vincular na criação (ADR 0005 §5).
   *
   * Cargo deve pertencer à empresa da sessão (senão 404); atribuir cargo
   * `is_admin` exige ator `is_admin` (403). Sem `roleId`, retorna `null`.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param roleId Id do cargo (opcional).
   * @returns Cargo validado ou `null`.
   * @throws {NotFoundException} Cargo fora da empresa.
   * @throws {ForbiddenException} Atribuir cargo `is_admin` sem ser admin.
   */
  private async resolveRole(
    actor: AuthenticatedUserEntity,
    roleId?: string,
  ): Promise<RoleEntity | null> {
    if (!roleId) {
      return null;
    }

    const role = await this.roleRepository.findByIdAndCompanyId(
      roleId,
      actor.companyId,
    );
    if (!role) {
      throw new NotFoundException('Cargo não encontrado.');
    }

    if (role.isAdmin && !actor.isAdmin) {
      throw new ForbiddenException(
        'Apenas administradores podem atribuir cargos de administração.',
      );
    }

    return role;
  }

  /**
   * Busca o resumo do cargo vigente do usuário na empresa (1 cargo por
   * empresa) para incluir na resposta de criação.
   *
   * @param userId Id da pessoa.
   * @param companyId Empresa da sessão.
   * @returns Vínculo `user_role` (ou `null` quando sem cargo).
   */
  private async fetchRoleSummary(
    userId: string,
    companyId: string,
  ): Promise<UserRoleWithRoleEntity | null> {
    const roles = await this.userRoleRepository.listByUserIdAndCompanyId(
      userId,
      companyId,
    );
    return roles[0] ?? null;
  }

  /**
   * Se o valor foi de fato enviado (nem `undefined` nem `null`).
   *
   * @param value Valor do campo.
   * @returns `true` quando o campo está presente.
   */
  private hasValue(value: unknown): boolean {
    return value !== undefined && value !== null;
  }

  /**
   * Normaliza um e-mail opcional (Visitante pode não ter e-mail — ADR 0013).
   *
   * @param email E-mail cru (ou ausente).
   * @returns E-mail normalizado ou `null` quando ausente/vazio.
   */
  private normalizeOptionalEmail(email?: string): string | null {
    if (!this.hasValue(email) || (email as string).trim() === '') {
      return null;
    }
    return normalizeEmail(email as string);
  }

  /**
   * Detecta violação de constraint unique do Postgres (código `23505`) —
   * usada para traduzir a concorrência em 409, nunca 500 cru.
   *
   * @param error Erro lançado pelo repositório.
   * @returns `true` quando é violação de unique.
   */
  private isUniqueViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }
    const driverError = error.driverError as { code?: string } | undefined;
    return driverError?.code === '23505';
  }
}

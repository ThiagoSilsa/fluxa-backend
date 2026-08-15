// NestJS
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

// Shared
import { PasswordHashUseCase } from '../../../../shared/security/password-hash.use-case';
import { normalizeEmail } from '../../../../shared/utils/email.util';

// Repositories
import { USER_COMPANY_REPOSITORY } from '../../../auth/domain/repositories/user-company.repository';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository';

// Mapper
import { toCreatedUserResponse } from '../utils/user-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { UserCompanyRepository } from '../../../auth/domain/repositories/user-company.repository';
import type { UserEntity } from '../../domain/entities/user.entity';
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
    const email = normalizeEmail(input.email);
    const existing = await this.userRepository.findByEmail(email);

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
    email: string,
  ): Promise<CreateUserResponse> {
    if (!this.hasValue(input.name) || !this.hasValue(input.password)) {
      throw new BadRequestException(
        'Nome e senha são obrigatórios para criar um usuário.',
      );
    }

    if (this.hasValue(input.document)) {
      const byDocument = await this.userRepository.findByDocument(
        input.document as string,
      );
      if (byDocument) {
        throw new ConflictException('Documento já cadastrado.');
      }
    }

    try {
      const user = await this.userRepository.create({
        name: input.name as string,
        email,
        passwordHash: this.passwordHash.execute(input.password as string),
        phone: input.phone ?? null,
        document: input.document ?? null,
        observation: input.observation ?? null,
        companyId: actor.companyId,
        type: input.type,
        isActive: true,
      });
      return toCreatedUserResponse(user, input.type, true, true);
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
      this.hasValue(input.document) ||
      this.hasValue(input.observation)
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

    try {
      await this.userCompanyRepository.create({
        userId: existing.id,
        companyId: actor.companyId,
        type: input.type,
        isActive: true,
      });
      return toCreatedUserResponse(existing, input.type, true, false);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Usuário já vinculado a esta empresa.');
      }
      throw error;
    }
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

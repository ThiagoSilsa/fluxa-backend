// NestJS
import { Inject, Injectable, Logger } from '@nestjs/common';

// Shared
import { normalizeEmail } from '../../../../shared/utils/email.util';

// Repository
import { USER_REPOSITORY } from '../../domain/repositories/user.repository';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { EmailStatusInputDto } from '../dto/email-status-input.dto';
import type { EmailStatusResponse } from '../dto/user-response';
import type { UserRepository } from '../../domain/repositories/user.repository';

/**
 * Consulta de existência de e-mail (ADR 0005 §2.1).
 *
 * Devolve **apenas** `{ exists }` — não vaza nome nem em quais empresas a
 * pessoa está. O frontend usa com debounce para transformar o formulário em
 * "vincular" quando a pessoa já existe.
 */
@Injectable()
export class EmailStatusUseCase {
  private readonly logger = new Logger(EmailStatusUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

  /**
   * Verifica se existe conta com o e-mail (normalizado) no sistema.
   *
   * @param _actor Ator autenticado (exigido pela assinatura de use case).
   * @param input E-mail a consultar.
   * @returns `{ exists }` — apenas o boolean.
   */
  public async execute(
    _actor: AuthenticatedUserEntity,
    input: EmailStatusInputDto,
  ): Promise<EmailStatusResponse> {
    const user = await this.userRepository.findByEmail(
      normalizeEmail(input.email),
    );
    return { exists: user !== null };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { JwtPayload } from '../../../../shared/security/jwt.payload';
import { AuthenticatedUserEntity } from '../../domain/entities/authenticated-user.entity';
import { ResolveAuthenticatedUserUseCase } from './resolve-authenticated-user.use-case';

/**
 * Ponte entre o `JwtAuthGuard` e a resolução do usuário autenticado.
 *
 * Recebe o payload já validado (assinatura/expiração) e delega a revalidação
 * do vínculo pessoa+empresa + papéis/permissões.
 */
@Injectable()
export class ValidateJwtPayloadUseCase {
  private readonly logger = new Logger(ValidateJwtPayloadUseCase.name);

  constructor(
    private readonly resolveAuthenticatedUser: ResolveAuthenticatedUserUseCase,
  ) {}

  /**
   * Converte o payload do JWT no ator autenticado.
   *
   * @param payload Payload validado do JWT (`sub`, `companyId`, `email`).
   * @returns Entidade autenticada; `null` se o vínculo não for mais válido.
   */
  public async execute(
    payload: JwtPayload,
  ): Promise<AuthenticatedUserEntity | null> {
    return this.resolveAuthenticatedUser.execute(
      payload.sub,
      payload.companyId,
    );
  }
}

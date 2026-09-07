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
import { ACCESS_REQUEST_REPOSITORY } from '../../domain/repositories/access-request.repository';
import { USER_REPOSITORY } from '../../../users/domain/repositories/user.repository';

// Constants
import { AccessRequestStatus } from '../../domain/constants/access-request.constant';

// Mapper
import { toAccessRequestResponse } from '../utils/access-request-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { AccessRequestRepository } from '../../domain/repositories/access-request.repository';
import type { UserRepository } from '../../../users/domain/repositories/user.repository';
import type { HandleAccessRequestInputDto } from '../dto/handle-access-request-input.dto';
import type { AccessRequestResponse } from '../dto/access-request-response';

/**
 * Cancela uma solicitação de acesso **própria** e em `PENDING` (porteiro —
 * regra 49).
 *
 * A administração não cancela — ela aceita/rejeita.
 */
@Injectable()
export class CancelAccessRequestUseCase {
  private readonly logger = new Logger(CancelAccessRequestUseCase.name);

  constructor(
    @Inject(ACCESS_REQUEST_REPOSITORY)
    private readonly accessRequestRepository: AccessRequestRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

  /**
   * Cancela a solicitação da empresa do ator.
   *
   * @param actor Ator autenticado (porteiro — empresa da sessão).
   * @param input Id da solicitação.
   * @returns Solicitação cancelada.
   * @throws {NotFoundException} Solicitação não existe na empresa.
   * @throws {ForbiddenException} Solicitação não é do próprio porteiro.
   * @throws {ConflictException} Solicitação não está pendente.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: HandleAccessRequestInputDto,
  ): Promise<AccessRequestResponse> {
    const request = await this.accessRequestRepository.findByIdAndCompanyId(
      input.requestId,
      actor.companyId,
    );
    if (!request) {
      throw new NotFoundException('Solicitação não encontrada.');
    }
    if (request.requestedBy !== actor.id) {
      throw new ForbiddenException(
        'Você só pode cancelar as próprias solicitações.',
      );
    }
    if (request.status !== AccessRequestStatus.PENDING) {
      throw new ConflictException(
        'Apenas solicitações pendentes podem ser canceladas.',
      );
    }

    const cancelled =
      await this.accessRequestRepository.updateStatusByIdAndCompanyId(
        request.id,
        actor.companyId,
        { status: AccessRequestStatus.CANCELLED },
      );
    if (!cancelled) {
      throw new NotFoundException('Solicitação não encontrada.');
    }

    const requestedBy = await this.resolveUser(request.requestedBy);
    return toAccessRequestResponse(
      cancelled,
      requestedBy ?? { id: request.requestedBy, name: '—' },
      null,
      null,
    );
  }

  /**
   * Resolve o resumo do usuário (id + nome) ou `null`.
   *
   * @param userId Id do usuário.
   * @returns Resumo do usuário ou `null`.
   */
  private async resolveUser(
    userId: string,
  ): Promise<{ id: string; name: string } | null> {
    const user = await this.userRepository.findById(userId);
    return user ? { id: user.id, name: user.name } : null;
  }
}

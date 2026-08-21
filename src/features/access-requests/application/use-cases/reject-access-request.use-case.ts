// NestJS
import {
  ConflictException,
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
 * Rejeita uma solicitação de acesso (exclusivo da administração — regra 49).
 *
 * Marca `REJECTED` com `handled_by`/`handled_at` e observação. Duplicidade
 * também vira `REJECTED` (regra 47). **Não** cria cadastros nem vínculo.
 */
@Injectable()
export class RejectAccessRequestUseCase {
  private readonly logger = new Logger(RejectAccessRequestUseCase.name);

  constructor(
    @Inject(ACCESS_REQUEST_REPOSITORY)
    private readonly accessRequestRepository: AccessRequestRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

  /**
   * Rejeita a solicitação da empresa do ator.
   *
   * @param actor Ator autenticado (admin — empresa da sessão).
   * @param input Id da solicitação e observação opcional.
   * @returns Solicitação rejeitada.
   * @throws {NotFoundException} Solicitação não existe na empresa.
   * @throws {ConflictException} Solicitação não está aberta (PENDING/IN_CONTACT).
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
    if (
      request.status !== AccessRequestStatus.PENDING &&
      request.status !== AccessRequestStatus.IN_CONTACT
    ) {
      throw new ConflictException(
        'Apenas solicitações pendentes ou em contato podem ser rejeitadas.',
      );
    }

    const rejected =
      await this.accessRequestRepository.updateStatusByIdAndCompanyId(
        request.id,
        actor.companyId,
        {
          status: AccessRequestStatus.REJECTED,
          handledBy: actor.id,
          observation: input.observation?.trim() || null,
        },
      );
    if (!rejected) {
      throw new NotFoundException('Solicitação não encontrada.');
    }

    const requestedBy = await this.resolveUser(request.requestedBy);
    return toAccessRequestResponse(
      rejected,
      requestedBy ?? { id: request.requestedBy, name: '—' },
      { id: actor.id, name: actor.name },
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

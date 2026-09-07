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
 * Marca uma solicitação de acesso como `IN_CONTACT` (administração já em
 * contato — regra 39).
 *
 * Estende o prazo do bloqueio automático (3 dias) até o teto de 7 dias
 * (integração futura — job). Aqui apenas a transição de estado `PENDING →
 * IN_CONTACT` com `handled_by`/`handled_at`.
 */
@Injectable()
export class MarkInContactAccessRequestUseCase {
  private readonly logger = new Logger(MarkInContactAccessRequestUseCase.name);

  constructor(
    @Inject(ACCESS_REQUEST_REPOSITORY)
    private readonly accessRequestRepository: AccessRequestRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

  /**
   * Marca a solicitação como `IN_CONTACT` na empresa do ator.
   *
   * @param actor Ator autenticado (admin — empresa da sessão).
   * @param input Id da solicitação e observação opcional.
   * @returns Solicitação em contato.
   * @throws {NotFoundException} Solicitação não existe na empresa.
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
    if (request.status !== AccessRequestStatus.PENDING) {
      throw new ConflictException(
        'Apenas solicitações pendentes podem ser marcadas como em contato.',
      );
    }

    const inContact =
      await this.accessRequestRepository.updateStatusByIdAndCompanyId(
        request.id,
        actor.companyId,
        {
          status: AccessRequestStatus.IN_CONTACT,
          handledBy: actor.id,
          observation: input.observation?.trim() || null,
        },
      );
    if (!inContact) {
      throw new NotFoundException('Solicitação não encontrada.');
    }

    const requestedBy = await this.resolveUser(request.requestedBy);
    return toAccessRequestResponse(
      inContact,
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

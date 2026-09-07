// NestJS
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

// Repositories
import { BLOCK_REQUEST_REPOSITORY } from '../../domain/repositories/block-request.repository';
import { USER_REPOSITORY } from '../../../users/domain/repositories/user.repository';

// Constants
import { BlockRequestStatus } from '../../domain/constants/block.constant';

// Mapper
import { toBlockRequestResponse } from '../utils/block-request-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { BlockRequestRepository } from '../../domain/repositories/block-request.repository';
import type { UserRepository } from '../../../users/domain/repositories/user.repository';
import type { HandleBlockRequestInputDto } from '../dto/list-block-requests-input.dto';
import type { BlockRequestResponse } from '../dto/block-request-response';

/**
 * Rejeita uma solicitação de bloqueio (exclusivo da administração).
 *
 * Marca `REJECTED` com `handled_by`/`handled_at` e observação — **não** cria
 * bloqueio.
 */
@Injectable()
export class RejectBlockRequestUseCase {
  private readonly logger = new Logger(RejectBlockRequestUseCase.name);

  constructor(
    @Inject(BLOCK_REQUEST_REPOSITORY)
    private readonly blockRequestRepository: BlockRequestRepository,
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
   * @throws {ConflictException} Solicitação não está pendente.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: HandleBlockRequestInputDto,
  ): Promise<BlockRequestResponse> {
    const request = await this.blockRequestRepository.findByIdAndCompanyId(
      input.requestId,
      actor.companyId,
    );
    if (!request) {
      throw new NotFoundException('Solicitação não encontrada.');
    }
    if (request.status !== BlockRequestStatus.PENDING) {
      throw new ConflictException(
        'Apenas solicitações pendentes podem ser rejeitadas.',
      );
    }

    const rejected =
      await this.blockRequestRepository.updateStatusByIdAndCompanyId(
        request.id,
        actor.companyId,
        {
          status: BlockRequestStatus.REJECTED,
          handledBy: actor.id,
          observation: input.observation?.trim() || null,
        },
      );
    if (!rejected) {
      throw new NotFoundException('Solicitação não encontrada.');
    }

    const requestedBy = await this.resolveUser(request.requestedBy);
    return toBlockRequestResponse(
      rejected,
      requestedBy ?? { id: request.requestedBy, name: '—' },
      { id: actor.id, name: actor.name },
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

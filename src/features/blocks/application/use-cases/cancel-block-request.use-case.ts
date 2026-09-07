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
 * Cancela uma solicitação de bloqueio **própria** e em `PENDING` (porteiro).
 *
 * A administração não cancela — ela aprova/rejeita.
 */
@Injectable()
export class CancelBlockRequestUseCase {
  private readonly logger = new Logger(CancelBlockRequestUseCase.name);

  constructor(
    @Inject(BLOCK_REQUEST_REPOSITORY)
    private readonly blockRequestRepository: BlockRequestRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

  /**
   * Cancela a solicitação da empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Id da solicitação.
   * @returns Solicitação cancelada.
   * @throws {NotFoundException} Solicitação não existe na empresa.
   * @throws {ForbiddenException} Solicitação não é do próprio porteiro.
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
    if (request.requestedBy !== actor.id) {
      throw new ForbiddenException(
        'Você só pode cancelar as próprias solicitações.',
      );
    }
    if (request.status !== BlockRequestStatus.PENDING) {
      throw new ConflictException(
        'Apenas solicitações pendentes podem ser canceladas.',
      );
    }

    const cancelled =
      await this.blockRequestRepository.updateStatusByIdAndCompanyId(
        request.id,
        actor.companyId,
        { status: BlockRequestStatus.CANCELLED },
      );
    if (!cancelled) {
      throw new NotFoundException('Solicitação não encontrada.');
    }

    const requestedBy = await this.resolveUser(request.requestedBy);
    return toBlockRequestResponse(
      cancelled,
      requestedBy ?? { id: request.requestedBy, name: '—' },
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

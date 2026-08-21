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

// DTOs
import { CreateBlockInputDto } from '../dto/create-block-input.dto';

// Mapper
import { toBlockRequestResponse } from '../utils/block-request-response.mapper';

// Use cases (orquestração — AGENTS.md)
import { CreateVehicleBlockUseCase } from './create-vehicle-block.use-case';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { BlockRequestRepository } from '../../domain/repositories/block-request.repository';
import type { UserRepository } from '../../../users/domain/repositories/user.repository';
import type { HandleBlockRequestInputDto } from '../dto/list-block-requests-input.dto';
import type { BlockRequestResponse } from '../dto/block-request-response';

/**
 * Aprova uma solicitação de bloqueio (exclusivo da administração).
 *
 * Cria o `vehicle_block` (`MANUAL`, `blocked_by` = admin que aprovou, motivo =
 * o da solicitação) e marca a solicitação `APPROVED` com
 * `resolved_block_id`/`handled_by`/`handled_at`. Já bloqueado → **409** (o
 * admin pode rejeitar).
 */
@Injectable()
export class ApproveBlockRequestUseCase {
  private readonly logger = new Logger(ApproveBlockRequestUseCase.name);

  constructor(
    @Inject(BLOCK_REQUEST_REPOSITORY)
    private readonly blockRequestRepository: BlockRequestRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    private readonly createVehicleBlockUseCase: CreateVehicleBlockUseCase,
  ) {}

  /**
   * Aprova a solicitação da empresa do ator e cria o bloqueio.
   *
   * @param actor Ator autenticado (admin — empresa da sessão).
   * @param input Id da solicitação e observação opcional.
   * @returns Solicitação aprovada.
   * @throws {NotFoundException} Solicitação não existe na empresa.
   * @throws {ConflictException} Solicitação não está pendente (ou já bloqueado).
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
        'Apenas solicitações pendentes podem ser aprovadas.',
      );
    }

    // Cria o bloqueio (MANUAL, motivo da solicitação) — propaga 409 se já
    // bloqueado.
    const block = await this.createVehicleBlockUseCase.execute(
      actor,
      new CreateBlockInputDto(request.plate, request.reason),
    );

    const approved =
      await this.blockRequestRepository.updateStatusByIdAndCompanyId(
        request.id,
        actor.companyId,
        {
          status: BlockRequestStatus.APPROVED,
          handledBy: actor.id,
          observation: input.observation?.trim() || null,
          resolvedBlockId: block.id,
        },
      );
    if (!approved) {
      throw new NotFoundException('Solicitação não encontrada.');
    }

    const requestedBy = await this.resolveUser(request.requestedBy);
    return toBlockRequestResponse(
      approved,
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

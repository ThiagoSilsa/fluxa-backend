// NestJS
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';

// Repositories
import { BLOCK_REQUEST_REPOSITORY } from '../../domain/repositories/block-request.repository';
import { USER_REPOSITORY } from '../../../users/domain/repositories/user.repository';

// Mapper
import { toBlockRequestResponse } from '../utils/block-request-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { BlockRequestRepository } from '../../domain/repositories/block-request.repository';
import type { UserRepository } from '../../../users/domain/repositories/user.repository';
import type { HandleBlockRequestInputDto } from '../dto/list-block-requests-input.dto';
import type { BlockRequestResponse } from '../dto/block-request-response';

/**
 * Busca uma solicitação de bloqueio por id na empresa da sessão — escalonada
 * por papel (ADR 0012 §2): o gestor vê qualquer; o solicitante vê apenas a
 * própria.
 */
@Injectable()
export class GetBlockRequestUseCase {
  private readonly logger = new Logger(GetBlockRequestUseCase.name);

  constructor(
    @Inject(BLOCK_REQUEST_REPOSITORY)
    private readonly blockRequestRepository: BlockRequestRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

  /**
   * Detalha uma solicitação de bloqueio da empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Id da solicitação.
   * @returns Solicitação da empresa.
   * @throws {NotFoundException} Quando a solicitação não existe na empresa ou o
   * solicitante não é o dono (cross-tenant/terceiro não revelado).
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: HandleBlockRequestInputDto,
  ): Promise<BlockRequestResponse> {
    const request = await this.blockRequestRepository.findByIdAndCompanyId(
      input.requestId,
      actor.companyId,
    );
    if (
      !request ||
      (!this.canManageAll(actor) && request.requestedBy !== actor.id)
    ) {
      throw new NotFoundException('Solicitação não encontrada.');
    }

    const [requestedBy, handledBy] = await Promise.all([
      this.resolveUser(request.requestedBy),
      request.handledBy ? this.resolveUser(request.handledBy) : null,
    ]);

    return toBlockRequestResponse(
      request,
      requestedBy ?? { id: request.requestedBy, name: '—' },
      handledBy,
    );
  }

  /**
   * Indica se o ator gerencia todas as solicitações da empresa (`is_admin` ou
   * com `MANAGE_BLOCKS`). Solicitantes (`CREATE_BLOCK_REQUEST`) sem gestão veem
   * apenas as próprias (ADR 0012 §2).
   *
   * @param actor Ator autenticado.
   * @returns `true` quando o ator pode detalhar qualquer solicitação.
   */
  private canManageAll(actor: AuthenticatedUserEntity): boolean {
    return (
      actor.isAdmin || actor.permissions.includes(PermissionCode.MANAGE_BLOCKS)
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
  ): Promise<BlockRequestResponse['requestedBy'] | null> {
    const user = await this.userRepository.findById(userId);
    return user ? { id: user.id, name: user.name } : null;
  }
}

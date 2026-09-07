// NestJS
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

// Repositories
import { ACCESS_REQUEST_REPOSITORY } from '../../domain/repositories/access-request.repository';
import { USER_REPOSITORY } from '../../../users/domain/repositories/user.repository';

// Mapper
import { toAccessRequestResponse } from '../utils/access-request-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { AccessRequestRepository } from '../../domain/repositories/access-request.repository';
import type { UserRepository } from '../../../users/domain/repositories/user.repository';
import type { HandleAccessRequestInputDto } from '../dto/handle-access-request-input.dto';
import type { AccessRequestResponse } from '../dto/access-request-response';

/**
 * Busca uma solicitação de acesso por id na empresa da sessão (detalhe da
 * administração).
 */
@Injectable()
export class GetAccessRequestUseCase {
  private readonly logger = new Logger(GetAccessRequestUseCase.name);

  constructor(
    @Inject(ACCESS_REQUEST_REPOSITORY)
    private readonly accessRequestRepository: AccessRequestRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

  /**
   * Detalha uma solicitação da empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Id da solicitação.
   * @returns Solicitação da empresa.
   * @throws {NotFoundException} Quando a solicitação não existe na empresa
   * (cross-tenant não revelado).
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

    const [requestedBy, handledBy, authorizedBy] = await Promise.all([
      this.resolveUser(request.requestedBy),
      request.handledBy ? this.resolveUser(request.handledBy) : null,
      request.authorizedBy ? this.resolveUser(request.authorizedBy) : null,
    ]);

    return toAccessRequestResponse(
      request,
      requestedBy ?? { id: request.requestedBy, name: '—' },
      handledBy,
      authorizedBy,
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
  ): Promise<AccessRequestResponse['requestedBy'] | null> {
    const user = await this.userRepository.findById(userId);
    return user ? { id: user.id, name: user.name } : null;
  }
}

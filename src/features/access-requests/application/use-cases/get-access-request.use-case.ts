// NestJS
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';

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
   * Detalha uma solicitação da empresa do ator — escalonada por papel (ADR
   * 0012 §2): o gestor vê qualquer; o solicitante vê apenas a própria (as
   * demais respondem como não encontradas).
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Id da solicitação.
   * @returns Solicitação da empresa.
   * @throws {NotFoundException} Quando a solicitação não existe na empresa ou
   * o solicitante não é o dono (cross-tenant/terceiro não revelado).
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: HandleAccessRequestInputDto,
  ): Promise<AccessRequestResponse> {
    const request = await this.accessRequestRepository.findByIdAndCompanyId(
      input.requestId,
      actor.companyId,
    );
    if (
      !request ||
      (!this.canManageAll(actor) && request.requestedBy !== actor.id)
    ) {
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
   * Indica se o ator gerencia todas as solicitações da empresa (`is_admin` ou
   * com `MANAGE_ACCESS_REQUESTS`). Solicitantes (`CREATE_ACCESS_REQUEST`) sem
   * gestão veem apenas as próprias (ADR 0012 §2).
   *
   * @param actor Ator autenticado.
   * @returns `true` quando o ator pode detalhar qualquer solicitação.
   */
  private canManageAll(actor: AuthenticatedUserEntity): boolean {
    return (
      actor.isAdmin ||
      actor.permissions.includes(PermissionCode.MANAGE_ACCESS_REQUESTS)
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

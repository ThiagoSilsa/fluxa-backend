// NestJS
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

// Repositories
import { VEHICLE_BLOCK_REPOSITORY } from '../../domain/repositories/vehicle-block.repository';
import { USER_REPOSITORY } from '../../../users/domain/repositories/user.repository';

// Mapper
import { toBlockResponse } from '../utils/block-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { VehicleBlockRepository } from '../../domain/repositories/vehicle-block.repository';
import type { UserRepository } from '../../../users/domain/repositories/user.repository';
import type { GetBlockInputDto } from '../dto/list-blocks-input.dto';
import type { BlockResponse } from '../dto/block-response';

/**
 * Busca um bloqueio por id na empresa da sessão.
 */
@Injectable()
export class GetVehicleBlockUseCase {
  private readonly logger = new Logger(GetVehicleBlockUseCase.name);

  constructor(
    @Inject(VEHICLE_BLOCK_REPOSITORY)
    private readonly vehicleBlockRepository: VehicleBlockRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

  /**
   * Detalha um bloqueio da empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Id do bloqueio.
   * @returns Bloqueio da empresa.
   * @throws {NotFoundException} Quando o bloqueio não existe na empresa
   * (cross-tenant não revelado).
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: GetBlockInputDto,
  ): Promise<BlockResponse> {
    const block = await this.vehicleBlockRepository.findByIdAndCompanyId(
      input.blockId,
      actor.companyId,
    );
    if (!block) {
      throw new NotFoundException('Bloqueio não encontrado.');
    }

    const [blockedBy, revokedBy] = await Promise.all([
      this.resolveUser(block.blockedBy),
      this.resolveUser(block.revokedBy),
    ]);

    return toBlockResponse(block, blockedBy, revokedBy);
  }

  /**
   * Resolve o resumo do usuário (id + nome) ou `null`.
   *
   * @param userId Id do usuário (ou null).
   * @returns Resumo do usuário ou `null`.
   */
  private async resolveUser(
    userId: string | null,
  ): Promise<{ id: string; name: string } | null> {
    if (!userId) {
      return null;
    }
    const user = await this.userRepository.findById(userId);
    return user ? { id: user.id, name: user.name } : null;
  }
}

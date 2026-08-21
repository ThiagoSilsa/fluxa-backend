// NestJS
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

// Repositories
import { VEHICLE_BLOCK_REPOSITORY } from '../../domain/repositories/vehicle-block.repository';
import { USER_REPOSITORY } from '../../../users/domain/repositories/user.repository';

// Constants
import { VehicleBlockStatus } from '../../domain/constants/block.constant';

// Mapper
import { toBlockResponse } from '../utils/block-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { VehicleBlockRepository } from '../../domain/repositories/vehicle-block.repository';
import type { UserRepository } from '../../../users/domain/repositories/user.repository';
import type { RevokeBlockInputDto } from '../dto/revoke-block-input.dto';
import type { BlockResponse } from '../dto/block-response';

/**
 * Revoga um bloqueio ativo da empresa da sessão (motivo obrigatório).
 *
 * `vehicle.is_blocked` é recalculado na mesma transação (false se não restar
 * bloqueio ativo — ADR 0010 §2). Bloqueio não ativo → **409**.
 */
@Injectable()
export class RevokeVehicleBlockUseCase {
  private readonly logger = new Logger(RevokeVehicleBlockUseCase.name);

  constructor(
    @Inject(VEHICLE_BLOCK_REPOSITORY)
    private readonly vehicleBlockRepository: VehicleBlockRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

  /**
   * Revoga o bloqueio da empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Id do bloqueio e motivo da revogação.
   * @returns Bloqueio revogado.
   * @throws {NotFoundException} Bloqueio não existe na empresa.
   * @throws {BadRequestException} Motivo vazio.
   * @throws {ConflictException} Bloqueio não está ativo.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: RevokeBlockInputDto,
  ): Promise<BlockResponse> {
    const revokedReason = input.reason.trim();
    if (!revokedReason) {
      throw new BadRequestException('O motivo da revogação é obrigatório.');
    }

    const block = await this.vehicleBlockRepository.findByIdAndCompanyId(
      input.blockId,
      actor.companyId,
    );
    if (!block) {
      throw new NotFoundException('Bloqueio não encontrado.');
    }
    if (block.status !== VehicleBlockStatus.ACTIVE) {
      throw new ConflictException('Bloqueio já está revogado.');
    }

    const revoked = await this.vehicleBlockRepository.revokeByIdAndCompanyId(
      input.blockId,
      actor.companyId,
      { revokedBy: actor.id, revokedReason },
    );
    if (!revoked) {
      throw new NotFoundException('Bloqueio não encontrado.');
    }

    const blockedBy = await this.resolveUser(block.blockedBy);

    return toBlockResponse(revoked, blockedBy, {
      id: actor.id,
      name: actor.name,
    });
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

// NestJS
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

// Repository
import { ENTRANCE_REPOSITORY } from '../../domain/repositories/entrance.repository';

// Mapper
import { toEntranceResponse } from '../utils/entrance-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { EntranceResponse } from '../dto/entrance-response';
import type { UpdateEntranceInputDto } from '../dto/update-entrance-input.dto';
import type { EntranceRepository } from '../../domain/repositories/entrance.repository';

/**
 * Atualiza o nome de uma portaria da empresa da sessão (PATCH parcial).
 */
@Injectable()
export class UpdateEntranceUseCase {
  private readonly logger = new Logger(UpdateEntranceUseCase.name);

  constructor(
    @Inject(ENTRANCE_REPOSITORY)
    private readonly entranceRepository: EntranceRepository,
  ) {}

  /**
   * Atualiza a portaria (nome) da empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Id e campos a atualizar.
   * @returns Portaria atualizada.
   * @throws {NotFoundException} Quando a portaria não existe na empresa.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: UpdateEntranceInputDto,
  ): Promise<EntranceResponse> {
    const existing = await this.entranceRepository.findByIdAndCompanyId(
      input.id,
      actor.companyId,
    );
    if (!existing) {
      throw new NotFoundException('Portaria não encontrada.');
    }

    const updated = await this.entranceRepository.updateByIdAndCompanyId(
      input.id,
      actor.companyId,
      { name: input.name, isActive: input.isActive },
    );
    if (!updated) {
      throw new NotFoundException('Portaria não encontrada.');
    }
    return toEntranceResponse(updated);
  }
}

// NestJS
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

// Repository
import { ENTRANCE_REPOSITORY } from '../../domain/repositories/entrance.repository';

// Mapper
import { toEntranceResponse } from '../utils/entrance-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { EntranceResponse } from '../dto/entrance-response';
import type { GetEntranceInputDto } from '../dto/get-entrance-input.dto';
import type { EntranceRepository } from '../../domain/repositories/entrance.repository';

/**
 * Desativa uma portaria da empresa da sessão (soft: `is_active = false`).
 *
 * A desativação **não** apaga o histórico (movimentos, `entry_denial`,
 * devices; ADR 0006 §10) — apenas impede novos usos (seleção para novos
 * `device`/movimentos, semana 3+).
 */
@Injectable()
export class DeactivateEntranceUseCase {
  private readonly logger = new Logger(DeactivateEntranceUseCase.name);

  constructor(
    @Inject(ENTRANCE_REPOSITORY)
    private readonly entranceRepository: EntranceRepository,
  ) {}

  /**
   * Desativa a portaria da empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Id da portaria.
   * @returns Portaria desativada.
   * @throws {NotFoundException} Quando a portaria não existe na empresa.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: GetEntranceInputDto,
  ): Promise<EntranceResponse> {
    const existing = await this.entranceRepository.findByIdAndCompanyId(
      input.id,
      actor.companyId,
    );
    if (!existing) {
      throw new NotFoundException('Portaria não encontrada.');
    }

    const updated = await this.entranceRepository.deactivateByIdAndCompanyId(
      input.id,
      actor.companyId,
    );
    if (!updated) {
      throw new NotFoundException('Portaria não encontrada.');
    }
    return toEntranceResponse(updated);
  }
}

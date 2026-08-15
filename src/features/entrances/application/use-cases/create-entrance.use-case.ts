// NestJS
import { Inject, Injectable, Logger } from '@nestjs/common';

// Repository
import { ENTRANCE_REPOSITORY } from '../../domain/repositories/entrance.repository';

// Mapper
import { toEntranceResponse } from '../utils/entrance-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { CreateEntranceInputDto } from '../dto/create-entrance-input.dto';
import type { EntranceResponse } from '../dto/entrance-response';
import type { EntranceRepository } from '../../domain/repositories/entrance.repository';

/**
 * Cria uma portaria na empresa da sessão.
 */
@Injectable()
export class CreateEntranceUseCase {
  private readonly logger = new Logger(CreateEntranceUseCase.name);

  constructor(
    @Inject(ENTRANCE_REPOSITORY)
    private readonly entranceRepository: EntranceRepository,
  ) {}

  /**
   * Cria a portaria com `companyId` da sessão.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Dados de criação (nome).
   * @returns Portaria criada.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: CreateEntranceInputDto,
  ): Promise<EntranceResponse> {
    const entrance = await this.entranceRepository.create({
      companyId: actor.companyId,
      name: input.name,
    });

    return toEntranceResponse(entrance);
  }
}

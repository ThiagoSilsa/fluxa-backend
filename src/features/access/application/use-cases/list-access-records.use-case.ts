// NestJS
import { Inject, Injectable, Logger } from '@nestjs/common';

// Repositories
import { ACCESS_RECORD_REPOSITORY } from '../../domain/repositories/access-record.repository';
import { ENTRANCE_REPOSITORY } from '../../../entrances/domain/repositories/entrance.repository';

// Mapper
import { toAccessRecordResponse } from '../utils/access-record-response.mapper';

// Shared
import { normalizePlate } from '../../../../shared/utils/plate.util';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { AccessRecordRepository } from '../../domain/repositories/access-record.repository';
import type { EntranceRepository } from '../../../entrances/domain/repositories/entrance.repository';
import type { ListAccessRecordsInputDto } from '../dto/list-access-records-input.dto';
import type { ListAccessRecordsResponse } from '../dto/access-record-response';

/**
 * Feed de registros da portaria (ADR 0015): entradas, saídas e impedimentos em
 * uma linha do tempo única, mais recente primeiro.
 *
 * Sem janela de tempo padrão — a portaria abre a tela e vê o movimento
 * recente, com os filtros (tipo, placa, período, portaria) como refinamento.
 * As portarias ativas vão em `parameters` para o filtro do cliente **sem**
 * exigir `MANAGE_ENTRANCES` de quem opera o balcão.
 */
@Injectable()
export class ListAccessRecordsUseCase {
  private readonly logger = new Logger(ListAccessRecordsUseCase.name);

  /** Limite de portarias no metadado de filtro. */
  private static readonly ENTRANCES_LIMIT = 100;

  constructor(
    @Inject(ACCESS_RECORD_REPOSITORY)
    private readonly accessRecordRepository: AccessRecordRepository,
    @Inject(ENTRANCE_REPOSITORY)
    private readonly entranceRepository: EntranceRepository,
  ) {}

  /**
   * Lista os registros da empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Filtros e paginação.
   * @returns Página do feed + metadados de filtro.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: ListAccessRecordsInputDto,
  ): Promise<ListAccessRecordsResponse> {
    const plate = input.plate?.trim() ? normalizePlate(input.plate) : undefined;

    const { data, count } = await this.accessRecordRepository.list(
      actor.companyId,
      {
        kind: input.kind,
        plate,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        entranceId: input.entranceId,
        doormanId: input.doormanId,
        limit: input.limit,
        offset: input.offset,
      },
    );

    const { data: entrances } = await this.entranceRepository.list(
      actor.companyId,
      {
        isActive: true,
        limit: ListAccessRecordsUseCase.ENTRANCES_LIMIT,
        offset: 0,
      },
    );

    return {
      limit: input.limit,
      offset: input.offset,
      data: data.map(toAccessRecordResponse),
      count,
      parameters: [
        {
          key: 'entrance_id',
          label: 'Portaria',
          allowed_values: entrances.map((entrance) => ({
            id: entrance.id,
            name: entrance.name,
          })),
        },
      ],
    };
  }
}

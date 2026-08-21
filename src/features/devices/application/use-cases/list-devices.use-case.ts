// NestJS
import { Inject, Injectable, Logger } from '@nestjs/common';

// Shared
import type { ParameterDto } from '../../../../shared/dto/parameter.dto';

// Repositories
import { DEVICE_REPOSITORY } from '../../domain/repositories/device.repository';
import { ENTRANCE_REPOSITORY } from '../../../entrances/domain/repositories/entrance.repository';

// Mapper
import { toDeviceResponse } from '../utils/device-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { DeviceRepository } from '../../domain/repositories/device.repository';
import type { EntranceRepository } from '../../../entrances/domain/repositories/entrance.repository';
import type { ListDevicesInputDto } from '../dto/list-devices-input.dto';
import type { ListDevicesResponse } from '../dto/device-response';

/**
 * Lista dispositivos da empresa da sessão com paginação, busca por nome,
 * filtro de estado e ordenação.
 *
 * Devolve no formato padrão do AGENTS.md §3 (`{ limit, offset, data, count,
 * parameters? }`) — `parameters` traz os `allowed_values` das **portarias
 * ativas** para o vínculo `entrance_id` (ADR 0008 §5).
 */
@Injectable()
export class ListDevicesUseCase {
  private readonly logger = new Logger(ListDevicesUseCase.name);

  constructor(
    @Inject(DEVICE_REPOSITORY)
    private readonly deviceRepository: DeviceRepository,
    @Inject(ENTRANCE_REPOSITORY)
    private readonly entranceRepository: EntranceRepository,
  ) {}

  /**
   * Lista os dispositivos escopados pela empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Busca, filtros, ordenação e paginação.
   * @returns Página de dispositivos com o total sem paginação.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: ListDevicesInputDto,
  ): Promise<ListDevicesResponse> {
    const { data, count } = await this.deviceRepository.list(actor.companyId, {
      search: input.search,
      isActive: input.isActive,
      sortBy: input.sortBy,
      sortOrder: input.sortOrder,
      limit: input.limit,
      offset: input.offset,
    });

    return {
      limit: input.limit,
      offset: input.offset,
      data: data.map(toDeviceResponse),
      count,
      parameters: await this.buildParameters(actor.companyId),
    };
  }

  /**
   * Monta os metadados de filtros da listagem — `allowed_values` das
   * **portarias ativas** da empresa para o vínculo `entrance_id` (ADR 0008
   * §5). O front usa essas opções sem importar a feature entrances.
   *
   * @param companyId Empresa da sessão.
   * @returns Lista de parâmetros (vazia se não houver portaria ativa).
   */
  private async buildParameters(companyId: string): Promise<ParameterDto[]> {
    const entrances = await this.entranceRepository.list(companyId, {
      isActive: true,
      limit: 100,
      offset: 0,
    });

    return [
      {
        key: 'entrance_id',
        label: 'Portaria',
        allowed_values: entrances.data.map((entrance) => ({
          id: entrance.id,
          name: entrance.name,
        })),
      },
    ];
  }
}

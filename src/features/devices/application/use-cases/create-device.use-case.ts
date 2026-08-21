// NestJS
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

// TypeORM
import { QueryFailedError } from 'typeorm';

// Repositories
import { DEVICE_REPOSITORY } from '../../domain/repositories/device.repository';
import { ENTRANCE_REPOSITORY } from '../../../entrances/domain/repositories/entrance.repository';

// Mapper
import { toDeviceResponse } from '../utils/device-response.mapper';

// Utils
import { buildDeviceWithEntrance } from '../utils/build-device-with-entrance';
import { generateDeviceToken } from '../utils/generate-device-token';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { DeviceEntity } from '../../domain/entities/device.entity';
import type { DeviceRepository } from '../../domain/repositories/device.repository';
import type { EntranceRepository } from '../../../entrances/domain/repositories/entrance.repository';
import type { EntranceEntity } from '../../../entrances/domain/entities/entrance.entity';
import type { CreateDeviceInputDto } from '../dto/create-device-input.dto';
import type { DeviceWithTokenResponse } from '../dto/device-response';

/**
 * Cria um dispositivo na empresa da sessão (pré-provisionamento de tablet).
 *
 * Gera o token via `crypto.randomBytes` e o devolve **uma única vez** nesta
 * resposta (write-only — ADR 0008 §3). O vínculo com portaria é opcional e
 * exige portaria **ativa** da mesma empresa (ADR 0008 §4).
 */
@Injectable()
export class CreateDeviceUseCase {
  private readonly logger = new Logger(CreateDeviceUseCase.name);

  constructor(
    @Inject(DEVICE_REPOSITORY)
    private readonly deviceRepository: DeviceRepository,
    @Inject(ENTRANCE_REPOSITORY)
    private readonly entranceRepository: EntranceRepository,
  ) {}

  /**
   * Cria o dispositivo com `companyId` da sessão e token gerado pelo backend.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Dados de criação (nome, plataforma, portaria opcional).
   * @returns Dispositivo criado + token (exibido uma única vez).
   * @throws {NotFoundException} Quando a portaria não existe na empresa.
   * @throws {BadRequestException} Quando a portaria está inativa.
   * @throws {ConflictException} Quando o token gerado colide (improvável).
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: CreateDeviceInputDto,
  ): Promise<DeviceWithTokenResponse> {
    const entrance = await this.resolveEntrance(
      input.entranceId,
      actor.companyId,
    );
    const token = generateDeviceToken();

    let saved: DeviceEntity;
    try {
      saved = await this.deviceRepository.create({
        companyId: actor.companyId,
        name: input.name,
        token,
        platform: input.platform,
        entranceId: entrance?.id,
      });
    } catch (error) {
      if (error instanceof QueryFailedError) {
        throw new ConflictException(
          'Não foi possível criar o dispositivo (token duplicado).',
        );
      }
      throw error;
    }

    return {
      device: toDeviceResponse(
        buildDeviceWithEntrance(
          saved,
          entrance ? { id: entrance.id, name: entrance.name } : null,
        ),
      ),
      token,
    };
  }

  /**
   * Valida a portaria de vínculo (opcional): deve existir na empresa e estar
   * ativa.
   *
   * @param entranceId Id da portaria (ou undefined).
   * @param companyId Empresa da sessão.
   * @returns Portaria validada ou `null` quando não há vínculo.
   * @throws {NotFoundException} Portaria não existe na empresa (cross-tenant
   * não revelado).
   * @throws {BadRequestException} Portaria inativa não pode ser vinculada.
   */
  private async resolveEntrance(
    entranceId: string | undefined,
    companyId: string,
  ): Promise<EntranceEntity | null> {
    if (!entranceId) {
      return null;
    }

    const entrance = await this.entranceRepository.findByIdAndCompanyId(
      entranceId,
      companyId,
    );
    if (!entrance) {
      throw new NotFoundException('Portaria não encontrada.');
    }
    if (!entrance.isActive) {
      throw new BadRequestException(
        'Portaria inativa não pode ser vinculada a um dispositivo.',
      );
    }
    return entrance;
  }
}

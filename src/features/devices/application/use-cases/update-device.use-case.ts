// NestJS
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

// Repositories
import { DEVICE_REPOSITORY } from '../../domain/repositories/device.repository';
import { ENTRANCE_REPOSITORY } from '../../../entrances/domain/repositories/entrance.repository';

// Mapper
import { toDeviceResponse } from '../utils/device-response.mapper';

// Utils
import { buildDeviceWithEntrance } from '../utils/build-device-with-entrance';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { DeviceRepository } from '../../domain/repositories/device.repository';
import type { EntranceRepository } from '../../../entrances/domain/repositories/entrance.repository';
import type { EntranceEntity } from '../../../entrances/domain/entities/entrance.entity';
import type { UpdateDeviceInputDto } from '../dto/update-device-input.dto';
import type { DeviceResponse } from '../dto/device-response';

/**
 * Atualiza um dispositivo da empresa da sessão (PATCH parcial): nome, vínculo
 * com portaria e status.
 *
 * `platform` é imutável (ADR 0008 §7); `appVersion`/`lastSyncAt` são somente
 * leitura (preenchidos pelo app — semana 3+). Desativar (`isActive = false`)
 * é a suspensão: o token deixa de valer para sync (ADR 0008 §6).
 */
@Injectable()
export class UpdateDeviceUseCase {
  private readonly logger = new Logger(UpdateDeviceUseCase.name);

  constructor(
    @Inject(DEVICE_REPOSITORY)
    private readonly deviceRepository: DeviceRepository,
    @Inject(ENTRANCE_REPOSITORY)
    private readonly entranceRepository: EntranceRepository,
  ) {}

  /**
   * Atualiza o dispositivo (nome/vínculo/status) da empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Id e campos a atualizar.
   * @returns Dispositivo atualizado.
   * @throws {NotFoundException} Quando o dispositivo não existe na empresa.
   * @throws {BadRequestException} Quando a portaria vinculada está inativa.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: UpdateDeviceInputDto,
  ): Promise<DeviceResponse> {
    const existing = await this.deviceRepository.findByIdAndCompanyId(
      input.id,
      actor.companyId,
    );
    if (!existing) {
      throw new NotFoundException('Dispositivo não encontrado.');
    }

    // Resolve o novo vínculo de portaria (se enviado no PATCH).
    let entrance: EntranceEntity | null | undefined;
    if (input.entranceId !== undefined) {
      entrance =
        input.entranceId === null
          ? null
          : await this.resolveEntrance(input.entranceId, actor.companyId);
    }

    const updated = await this.deviceRepository.updateByIdAndCompanyId(
      input.id,
      actor.companyId,
      {
        name: input.name,
        entranceId: entrance === undefined ? undefined : (entrance?.id ?? null),
        isActive: input.isActive,
      },
    );
    if (!updated) {
      throw new NotFoundException('Dispositivo não encontrado.');
    }

    // O resumo da portaria na resposta: novo vínculo, desvínculo ou o atual.
    const entranceSummary =
      entrance === undefined
        ? existing.entrance
        : entrance
          ? { id: entrance.id, name: entrance.name }
          : null;

    return toDeviceResponse(buildDeviceWithEntrance(updated, entranceSummary));
  }

  /**
   * Valida a portaria de vínculo: deve existir na empresa e estar ativa.
   *
   * @param entranceId Id da portaria.
   * @param companyId Empresa da sessão.
   * @returns Portaria validada.
   * @throws {NotFoundException} Portaria não existe na empresa (cross-tenant
   * não revelado).
   * @throws {BadRequestException} Portaria inativa não pode ser vinculada.
   */
  private async resolveEntrance(
    entranceId: string,
    companyId: string,
  ): Promise<EntranceEntity> {
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

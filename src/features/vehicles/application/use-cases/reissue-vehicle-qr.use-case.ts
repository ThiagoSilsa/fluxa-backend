// NestJS
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

// Repositories
import { VEHICLE_QR_REPOSITORY } from '../../domain/repositories/vehicle-qr.repository';
import { VEHICLE_REPOSITORY } from '../../domain/repositories/vehicle.repository';

// Mapper
import { toVehicleQrResponse } from '../utils/vehicle-qr-response.mapper';

// Utils
import { generateQrCode } from '../utils/generate-qr-code';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { VehicleQrRepository } from '../../domain/repositories/vehicle-qr.repository';
import type { VehicleRepository } from '../../domain/repositories/vehicle.repository';
import type { GetVehicleQrInputDto } from '../dto/get-vehicle-qr-input.dto';
import type { VehicleQrResponse } from '../dto/vehicle-qr-response';

/**
 * Reemite o QR code de um veículo da empresa da sessão (adesivo novo).
 *
 * Revoga o QR ativo atual (`is_active = false`) e cria um **novo** `code` em
 * transação (ADR 0009 §2). O adesivo antigo passa a "expirado".
 */
@Injectable()
export class ReissueVehicleQrUseCase {
  private readonly logger = new Logger(ReissueVehicleQrUseCase.name);

  constructor(
    @Inject(VEHICLE_QR_REPOSITORY)
    private readonly vehicleQrRepository: VehicleQrRepository,
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: VehicleRepository,
  ) {}

  /**
   * Reemite o QR do veículo da empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Id do veículo.
   * @returns Novo QR (novo `code`).
   * @throws {NotFoundException} Quando o veículo não existe na empresa.
   * @throws {ConflictException} Quando não há QR ativo para reemitir (use o
   * `POST /vehicles/:id/qr` para emitir o primeiro).
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: GetVehicleQrInputDto,
  ): Promise<VehicleQrResponse> {
    const vehicle = await this.vehicleRepository.findByIdAndCompanyId(
      input.vehicleId,
      actor.companyId,
    );
    if (!vehicle) {
      throw new NotFoundException('Veículo não encontrado.');
    }

    const active =
      await this.vehicleQrRepository.findActiveByVehicleIdAndCompanyId(
        input.vehicleId,
        actor.companyId,
      );
    if (!active) {
      throw new ConflictException(
        'Nenhum QR code ativo para reemitir — emita o primeiro.',
      );
    }

    const qr = await this.vehicleQrRepository.reissue(
      input.vehicleId,
      actor.companyId,
      {
        code: generateQrCode(),
        issuedBy: actor.id,
      },
    );
    return toVehicleQrResponse(qr);
  }
}

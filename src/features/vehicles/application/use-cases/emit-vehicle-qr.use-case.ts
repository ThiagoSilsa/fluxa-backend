// NestJS
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

// TypeORM
import { QueryFailedError } from 'typeorm';

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
 * Emite o QR code **permanente** de um veículo da empresa da sessão.
 *
 * Gera o `code` (uuid v4) e cria o QR ativo com `issued_by` = ator (ADR 0009
 * §2). **409** se o veículo já tiver um QR ativo (reimprimir usa o `GET`).
 */
@Injectable()
export class EmitVehicleQrUseCase {
  private readonly logger = new Logger(EmitVehicleQrUseCase.name);

  constructor(
    @Inject(VEHICLE_QR_REPOSITORY)
    private readonly vehicleQrRepository: VehicleQrRepository,
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: VehicleRepository,
  ) {}

  /**
   * Emite o QR do veículo da empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Id do veículo.
   * @returns QR emitido (token permanente).
   * @throws {NotFoundException} Quando o veículo não existe na empresa.
   * @throws {ConflictException} Quando já existe QR ativo para o veículo.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: GetVehicleQrInputDto,
  ): Promise<VehicleQrResponse> {
    await this.ensureVehicleExists(input.vehicleId, actor.companyId);

    const active =
      await this.vehicleQrRepository.findActiveByVehicleIdAndCompanyId(
        input.vehicleId,
        actor.companyId,
      );
    if (active) {
      throw new ConflictException('Este veículo já possui um QR code ativo.');
    }

    const code = generateQrCode();
    try {
      const qr = await this.vehicleQrRepository.create({
        companyId: actor.companyId,
        vehicleId: input.vehicleId,
        code,
        issuedBy: actor.id,
      });
      return toVehicleQrResponse(qr);
    } catch (error) {
      if (error instanceof QueryFailedError) {
        throw new ConflictException(
          'Não foi possível emitir o QR code (conflito de código).',
        );
      }
      throw error;
    }
  }

  /**
   * Garante que o veículo existe na empresa da sessão.
   *
   * @param vehicleId Id do veículo.
   * @param companyId Empresa da sessão.
   * @throws {NotFoundException} Veículo não existe (cross-tenant não revelado).
   */
  private async ensureVehicleExists(
    vehicleId: string,
    companyId: string,
  ): Promise<void> {
    const vehicle = await this.vehicleRepository.findByIdAndCompanyId(
      vehicleId,
      companyId,
    );
    if (!vehicle) {
      throw new NotFoundException('Veículo não encontrado.');
    }
  }
}

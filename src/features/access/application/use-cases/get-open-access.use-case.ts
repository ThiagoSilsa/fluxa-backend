// NestJS
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';

// Shared
import {
  isValidBrazilianPlate,
  normalizePlate,
} from '../../../../shared/utils/plate.util';

// Repositories
import { VEHICLE_ACCESS_REPOSITORY } from '../../domain/repositories/vehicle-access.repository';
import { VEHICLE_REPOSITORY } from '../../../vehicles/domain/repositories/vehicle.repository';
import { USER_REPOSITORY } from '../../../users/domain/repositories/user.repository';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { VehicleAccessEntity } from '../../domain/entities/vehicle-access.entity';
import type { VehicleAccessRepository } from '../../domain/repositories/vehicle-access.repository';
import type { VehicleRepository } from '../../../vehicles/domain/repositories/vehicle.repository';
import type { UserRepository } from '../../../users/domain/repositories/user.repository';
import type { GetOpenAccessInputDto } from '../dto/get-open-access-input.dto';
import type { OpenAccessResponse } from '../dto/access-response';

/**
 * Consulta os acessos abertos (`INSIDE`) de uma placa — conferência do
 * condutor na saída (regra 8).
 */
@Injectable()
export class GetOpenAccessUseCase {
  private readonly logger = new Logger(GetOpenAccessUseCase.name);

  constructor(
    @Inject(VEHICLE_ACCESS_REPOSITORY)
    private readonly vehicleAccessRepository: VehicleAccessRepository,
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: VehicleRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

  /**
   * Lista os acessos abertos da placa na empresa do ator.
   *
   * @param actor Ator autenticado (porteiro — empresa da sessão).
   * @param input Placa.
   * @returns Acessos abertos com o condutor resolvido.
   * @throws {BadRequestException} Placa inválida.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: GetOpenAccessInputDto,
  ): Promise<{ data: OpenAccessResponse[] }> {
    const plate = normalizePlate(input.plate);
    if (!isValidBrazilianPlate(plate)) {
      throw new BadRequestException('Placa inválida.');
    }
    const companyId = actor.companyId;

    const vehicle = await this.vehicleRepository.findByPlateAndCompanyId(
      plate,
      companyId,
    );
    const byVehicle = vehicle
      ? await this.vehicleAccessRepository.findOpenByVehicleIdAndCompanyId(
          vehicle.id,
          companyId,
        )
      : [];
    const byPlate =
      await this.vehicleAccessRepository.findOpenByTemporaryPlateAndCompanyId(
        plate,
        companyId,
      );

    const seen = new Set<string>();
    const open = [...byVehicle, ...byPlate].filter((access) => {
      if (seen.has(access.id)) {
        return false;
      }
      seen.add(access.id);
      return true;
    });

    const data = await Promise.all(
      open.map((access) => this.toOpenResponse(access)),
    );
    return { data };
  }

  /**
   * Mapeia um acesso aberto para a resposta, resolvendo o nome do condutor.
   *
   * @param access Acesso aberto.
   * @returns Acesso aberto no formato de resposta.
   */
  private async toOpenResponse(
    access: VehicleAccessEntity,
  ): Promise<OpenAccessResponse> {
    let driverId: string | null = null;
    let driverName: string | null = null;
    if (access.driverUserId) {
      driverId = access.driverUserId;
      const user = await this.userRepository.findById(access.driverUserId);
      driverName = user?.name ?? null;
    } else if (access.temporaryDriverName) {
      driverName = access.temporaryDriverName;
    }

    return {
      id: access.id,
      vehicleId: access.vehicleId,
      temporaryPlate: access.temporaryPlate,
      driver: { id: driverId, name: driverName },
      departmentId: access.departmentId,
      entryAt: access.entryAt ? access.entryAt.toISOString() : null,
      overCapacity: access.overCapacity,
    };
  }
}

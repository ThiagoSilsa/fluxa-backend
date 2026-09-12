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
import { DEPARTMENT_REPOSITORY } from '../../../departments/domain/repositories/department.repository';
import { USER_REPOSITORY } from '../../../users/domain/repositories/user.repository';

// Mapper + util da ficha (condutor/setor/veículo — regra 8)
import {
  toFichaDriverResponse,
  toFichaVehicleResponse,
} from '../utils/access-response.mapper';
import { resolveAccessFicha } from '../utils/resolve-access-ficha.util';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { VehicleAccessEntity } from '../../domain/entities/vehicle-access.entity';
import type { VehicleAccessRepository } from '../../domain/repositories/vehicle-access.repository';
import type { VehicleRepository } from '../../../vehicles/domain/repositories/vehicle.repository';
import type { DepartmentRepository } from '../../../departments/domain/repositories/department.repository';
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
    @Inject(DEPARTMENT_REPOSITORY)
    private readonly departmentRepository: DepartmentRepository,
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
      open.map((access) => this.toOpenResponse(access, companyId)),
    );
    return { data };
  }

  /**
   * Mapeia um acesso aberto para a resposta, com a ficha resolvida (condutor,
   * setor e veículo) — conferência do porteiro na saída (regra 8).
   *
   * @param access Acesso aberto.
   * @param companyId Empresa da sessão.
   * @returns Acesso aberto no formato de resposta.
   */
  private async toOpenResponse(
    access: VehicleAccessEntity,
    companyId: string,
  ): Promise<OpenAccessResponse> {
    const ficha = await resolveAccessFicha(access, companyId, {
      vehicleRepository: this.vehicleRepository,
      departmentRepository: this.departmentRepository,
      userRepository: this.userRepository,
    });

    return {
      id: access.id,
      vehicleId: access.vehicleId,
      temporaryPlate: access.temporaryPlate,
      driver: toFichaDriverResponse(ficha.driver),
      departmentId: access.departmentId,
      departmentName: ficha.departmentName,
      entryAt: access.entryAt ? access.entryAt.toISOString() : null,
      overCapacity: access.overCapacity,
      vehicle: toFichaVehicleResponse(ficha.vehicle),
    };
  }
}

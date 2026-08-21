// NestJS
import {
  GoneException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

// Repositories
import { DEPARTMENT_REPOSITORY } from '../../../departments/domain/repositories/department.repository';
import { USER_VEHICLE_REPOSITORY } from '../../domain/repositories/user-vehicle.repository';
import { VEHICLE_DEPARTMENT_REPOSITORY } from '../../domain/repositories/vehicle-department.repository';
import { VEHICLE_QR_REPOSITORY } from '../../domain/repositories/vehicle-qr.repository';
import { VEHICLE_REPOSITORY } from '../../domain/repositories/vehicle.repository';

// Mapper
import { toVehicleResponse } from '../utils/vehicle-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { DepartmentRepository } from '../../../departments/domain/repositories/department.repository';
import type { UserVehicleRepository } from '../../domain/repositories/user-vehicle.repository';
import type { VehicleDepartmentRepository } from '../../domain/repositories/vehicle-department.repository';
import type { VehicleQrRepository } from '../../domain/repositories/vehicle-qr.repository';
import type { VehicleRepository } from '../../domain/repositories/vehicle.repository';
import type { ResolveVehicleQrInputDto } from '../dto/resolve-vehicle-qr-input.dto';
import type {
  VehicleDriverResponse,
  VehicleResponse,
} from '../dto/vehicle-response';

/**
 * Resolve o veículo a partir do `code` do QR lido pelo scanner (ADR 0009 §4)
 * — o contrato que o app do porteiro vai consumir ao escanear o adesivo.
 *
 * QR **ativo** → devolve o veículo com o agregado (tipo, departamento,
 * motoristas) que o porteiro precisa para o fluxo de entrada; QR **revogado**
 * → **410 Gone** ("QR expirado"); `code` desconhecido/outro tenant → **404**.
 */
@Injectable()
export class ResolveVehicleQrUseCase {
  private readonly logger = new Logger(ResolveVehicleQrUseCase.name);

  constructor(
    @Inject(VEHICLE_QR_REPOSITORY)
    private readonly vehicleQrRepository: VehicleQrRepository,
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: VehicleRepository,
    @Inject(VEHICLE_DEPARTMENT_REPOSITORY)
    private readonly vehicleDepartmentRepository: VehicleDepartmentRepository,
    @Inject(DEPARTMENT_REPOSITORY)
    private readonly departmentRepository: DepartmentRepository,
    @Inject(USER_VEHICLE_REPOSITORY)
    private readonly userVehicleRepository: UserVehicleRepository,
  ) {}

  /**
   * Resolve o veículo pelo código do QR na empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Código do QR (lido pelo scanner).
   * @returns Veículo com o agregado para o fluxo de entrada.
   * @throws {NotFoundException} Código desconhecido ou de outro tenant (não
   * revela existência).
   * @throws {GoneException} QR revogado ("QR expirado").
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: ResolveVehicleQrInputDto,
  ): Promise<VehicleResponse> {
    const qr = await this.vehicleQrRepository.findByCodeAndCompanyId(
      input.code,
      actor.companyId,
    );
    if (!qr) {
      throw new NotFoundException('QR code não encontrado.');
    }
    if (!qr.isActive) {
      throw new GoneException('QR code expirado.');
    }

    const vehicle = await this.vehicleRepository.findByIdAndCompanyId(
      qr.vehicleId,
      actor.companyId,
    );
    if (!vehicle) {
      throw new NotFoundException('Veículo não encontrado.');
    }

    const [department, drivers] = await Promise.all([
      this.resolveDepartment(qr.vehicleId, actor.companyId),
      this.resolveDrivers(qr.vehicleId, actor.companyId),
    ]);

    return { ...toVehicleResponse(vehicle), department, drivers };
  }

  /**
   * Resolve o departamento padrão **ativo** do veículo (id + nome), ou `null`
   * se não houver vínculo ativo.
   *
   * @param vehicleId Id do veículo.
   * @param companyId Empresa da sessão.
   * @returns Departamento padrão ou `null`.
   */
  private async resolveDepartment(
    vehicleId: string,
    companyId: string,
  ): Promise<{ id: string; name: string } | null> {
    const link =
      await this.vehicleDepartmentRepository.findActiveByVehicleIdAndCompanyId(
        vehicleId,
        companyId,
      );
    if (!link) {
      return null;
    }
    const department = await this.departmentRepository.findByIdAndCompanyId(
      link.departmentId,
      companyId,
    );
    return department ? { id: department.id, name: department.name } : null;
  }

  /**
   * Resolve os motoristas vinculados ao veículo.
   *
   * @param vehicleId Id do veículo.
   * @param companyId Empresa da sessão.
   * @returns Motoristas (id + nome, `isPrimary`, `canDrive`).
   */
  private async resolveDrivers(
    vehicleId: string,
    companyId: string,
  ): Promise<VehicleDriverResponse[]> {
    const links = await this.userVehicleRepository.findByVehicleIdAndCompanyId(
      vehicleId,
      companyId,
    );
    return links.map((link) => ({
      id: link.id,
      user: { id: link.user.id, name: link.user.name },
      isPrimary: link.isPrimary,
      canDrive: link.canDrive,
    }));
  }
}

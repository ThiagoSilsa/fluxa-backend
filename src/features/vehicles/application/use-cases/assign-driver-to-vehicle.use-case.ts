// NestJS
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

// Repositories
import { USER_COMPANY_REPOSITORY } from '../../../auth/domain/repositories/user-company.repository';
import { USER_VEHICLE_REPOSITORY } from '../../domain/repositories/user-vehicle.repository';
import { VEHICLE_REPOSITORY } from '../../domain/repositories/vehicle.repository';

// Mapper
import { toUserVehicleDriverResponse } from '../utils/user-vehicle-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { UserCompanyRepository } from '../../../auth/domain/repositories/user-company.repository';
import type { UserVehicleRepository } from '../../domain/repositories/user-vehicle.repository';
import type { VehicleRepository } from '../../domain/repositories/vehicle.repository';
import type { AssignDriverInputDto } from '../dto/assign-driver-input.dto';
import type { UserVehicleDriverResponse } from '../dto/user-vehicle-response';

/**
 * Vincula um motorista a um veículo na empresa da sessão (ADR 0006 §9).
 *
 * - O motorista precisa ter **vínculo ativo** (`user_company`) com a empresa
 *   → 404 (validação multi-tenant da referência de `user` pelo vínculo);
 * - Vínculo já existente → 409 (unique `(company_id, user_id, vehicle_id)`);
 * - `is_primary = true` **desmarca o primário anterior** do veículo (o
 *   repositório faz em transação); concorrência → 409 no unique parcial.
 */
@Injectable()
export class AssignDriverToVehicleUseCase {
  private readonly logger = new Logger(AssignDriverToVehicleUseCase.name);

  constructor(
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: VehicleRepository,
    @Inject(USER_VEHICLE_REPOSITORY)
    private readonly userVehicleRepository: UserVehicleRepository,
    @Inject(USER_COMPANY_REPOSITORY)
    private readonly userCompanyRepository: UserCompanyRepository,
  ) {}

  /**
   * Cria o vínculo motorista ↔ veículo da empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Ids do veículo e do motorista, `isPrimary`/`canDrive`.
   * @returns Vínculo criado (com o motorista).
   * @throws {NotFoundException} Veículo não existe na empresa ou motorista sem
   * vínculo ativo.
   * @throws {ConflictException} Vínculo duplicado (ou concorrência no unique).
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: AssignDriverInputDto,
  ): Promise<UserVehicleDriverResponse> {
    const vehicle = await this.vehicleRepository.findByIdAndCompanyId(
      input.vehicleId,
      actor.companyId,
    );
    if (!vehicle) {
      throw new NotFoundException('Veículo não encontrado.');
    }

    const hasActiveLink = await this.userCompanyRepository.existsActive(
      input.userId,
      actor.companyId,
    );
    if (!hasActiveLink) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const existing =
      await this.userVehicleRepository.findByUserIdAndVehicleIdAndCompanyId(
        input.userId,
        input.vehicleId,
        actor.companyId,
      );
    if (existing) {
      throw new ConflictException('Motorista já vinculado a este veículo.');
    }

    try {
      await this.userVehicleRepository.create({
        companyId: actor.companyId,
        userId: input.userId,
        vehicleId: input.vehicleId,
        isPrimary: input.isPrimary,
        canDrive: input.canDrive,
      });
    } catch (error) {
      if (error instanceof QueryFailedError) {
        throw new ConflictException('Motorista já vinculado a este veículo.');
      }
      throw error;
    }

    const created =
      await this.userVehicleRepository.findByUserIdAndVehicleIdAndCompanyId(
        input.userId,
        input.vehicleId,
        actor.companyId,
      );
    if (!created) {
      throw new NotFoundException('Vínculo não encontrado.');
    }
    return toUserVehicleDriverResponse(created);
  }
}

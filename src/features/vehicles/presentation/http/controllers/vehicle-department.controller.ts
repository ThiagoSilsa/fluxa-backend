// NestJS
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

// Shared
import { PermissionCode } from '../../../../../shared/constants/access-control.constant';

// Decorators
import { RequirePermissions } from '../../../../../shared/decorators/require-permissions.decorator';

// Guards
import { JwtAuthGuard } from '../../../../../shared/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../../../shared/guards/permissions.guard';

// Types
import type { AuthenticatedRequest } from '../../../../../shared/guards/jwt-auth.guard';
import type { AuthenticatedUserEntity } from '../../../../auth/domain/entities/authenticated-user.entity';

// DTOs (apresentação)
import { SetVehicleDepartmentDto } from '../dto/set-vehicle-department.dto';

// DTOs (aplicação)
import { GetVehicleDepartmentInputDto } from '../../../application/dto/get-vehicle-department-input.dto';
import { RemoveVehicleDepartmentInputDto } from '../../../application/dto/remove-vehicle-department-input.dto';
import { SetVehicleDepartmentInputDto } from '../../../application/dto/set-vehicle-department-input.dto';

// Use cases
import { GetVehicleDepartmentUseCase } from '../../../application/use-cases/get-vehicle-department.use-case';
import { RemoveVehicleDepartmentUseCase } from '../../../application/use-cases/remove-vehicle-department.use-case';
import { SetVehicleDepartmentUseCase } from '../../../application/use-cases/set-vehicle-department.use-case';

// Types de resposta
import type { VehicleDepartmentResponse } from '../../../application/dto/vehicle-department-response';

// Decorators Swagger da feature
import {
  ApiGetVehicleDepartment,
  ApiRemoveVehicleDepartment,
  ApiSetVehicleDepartment,
} from '../../../decorators/api-vehicles.decorator';

/**
 * Departamento padrão do veículo — exige `MANAGE_VEHICLES`.
 *
 * Contrato de *upsert* na linha única `(company_id, vehicle_id)` (ADR 0006
 * §8): `PUT` cria/reativa/atualiza, `GET` devolve o vínculo ativo (ou 404) e
 * `DELETE` desativa (`is_active = false`).
 */
@Controller('vehicles/:vehicleId/department')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PermissionCode.MANAGE_VEHICLES)
export class VehicleDepartmentController {
  constructor(
    private readonly setVehicleDepartmentUseCase: SetVehicleDepartmentUseCase,
    private readonly getVehicleDepartmentUseCase: GetVehicleDepartmentUseCase,
    private readonly removeVehicleDepartmentUseCase: RemoveVehicleDepartmentUseCase,
  ) {}

  @Get()
  @ApiGetVehicleDepartment()
  public getVehicleDepartment(
    @Req() request: AuthenticatedRequest,
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
  ): Promise<VehicleDepartmentResponse> {
    return this.getVehicleDepartmentUseCase.execute(
      this.requireUser(request),
      new GetVehicleDepartmentInputDto(vehicleId),
    );
  }

  @Put()
  @ApiSetVehicleDepartment()
  public setVehicleDepartment(
    @Req() request: AuthenticatedRequest,
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @Body() dto: SetVehicleDepartmentDto,
  ): Promise<VehicleDepartmentResponse> {
    return this.setVehicleDepartmentUseCase.execute(
      this.requireUser(request),
      new SetVehicleDepartmentInputDto(vehicleId, dto.departmentId),
    );
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiRemoveVehicleDepartment()
  public async removeVehicleDepartment(
    @Req() request: AuthenticatedRequest,
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
  ): Promise<void> {
    await this.removeVehicleDepartmentUseCase.execute(
      this.requireUser(request),
      new RemoveVehicleDepartmentInputDto(vehicleId),
    );
  }

  /**
   * Extrai o ator autenticado do request (populado pelo `JwtAuthGuard`).
   *
   * @param request Requisição HTTP.
   * @returns Ator autenticado.
   * @throws {UnauthorizedException} Sem ator no request.
   */
  private requireUser(request: AuthenticatedRequest): AuthenticatedUserEntity {
    if (!request.user) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }
    return request.user;
  }
}

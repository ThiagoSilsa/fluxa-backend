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
  Patch,
  Post,
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
import { AssignDriverDto } from '../dto/assign-driver.dto';
import { UpdateDriverDto } from '../dto/update-driver.dto';

// DTOs (aplicação)
import { AssignDriverInputDto } from '../../../application/dto/assign-driver-input.dto';
import { ListVehicleDriversInputDto } from '../../../application/dto/list-vehicle-drivers-input.dto';
import { RemoveDriverInputDto } from '../../../application/dto/remove-driver-input.dto';
import { UpdateDriverInputDto } from '../../../application/dto/update-driver-input.dto';

// Use cases
import { AssignDriverToVehicleUseCase } from '../../../application/use-cases/assign-driver-to-vehicle.use-case';
import { ListVehicleDriversUseCase } from '../../../application/use-cases/list-vehicle-drivers.use-case';
import { RemoveVehicleDriverUseCase } from '../../../application/use-cases/remove-vehicle-driver.use-case';
import { UpdateVehicleDriverUseCase } from '../../../application/use-cases/update-vehicle-driver.use-case';

// Types de resposta
import type {
  ListVehicleDriversResponse,
  UserVehicleDriverResponse,
} from '../../../application/dto/user-vehicle-response';

// Decorators Swagger da feature
import {
  ApiAssignDriver,
  ApiListVehicleDrivers,
  ApiRemoveVehicleDriver,
  ApiUpdateVehicleDriver,
} from '../../../decorators/api-vehicles.decorator';

/**
 * Motoristas de um veículo — exige `MANAGE_VEHICLES`.
 *
 * `POST` vincula (motorista precisa de vínculo ativo na empresa; 1 primário
 * por veículo — substituição em transação), `PATCH` ajusta
 * `isPrimary`/`canDrive` sem remover+recriar e `DELETE` remove fisicamente
 * (ADR 0006 §9).
 */
@Controller('vehicles/:vehicleId/drivers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PermissionCode.MANAGE_VEHICLES)
export class VehicleDriversController {
  constructor(
    private readonly assignDriverToVehicleUseCase: AssignDriverToVehicleUseCase,
    private readonly listVehicleDriversUseCase: ListVehicleDriversUseCase,
    private readonly updateVehicleDriverUseCase: UpdateVehicleDriverUseCase,
    private readonly removeVehicleDriverUseCase: RemoveVehicleDriverUseCase,
  ) {}

  @Get()
  @ApiListVehicleDrivers()
  public listVehicleDrivers(
    @Req() request: AuthenticatedRequest,
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
  ): Promise<ListVehicleDriversResponse> {
    return this.listVehicleDriversUseCase.execute(
      this.requireUser(request),
      new ListVehicleDriversInputDto(vehicleId),
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiAssignDriver()
  public assignDriver(
    @Req() request: AuthenticatedRequest,
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @Body() dto: AssignDriverDto,
  ): Promise<UserVehicleDriverResponse> {
    return this.assignDriverToVehicleUseCase.execute(
      this.requireUser(request),
      new AssignDriverInputDto(
        vehicleId,
        dto.userId,
        dto.isPrimary ?? false,
        dto.canDrive ?? true,
      ),
    );
  }

  @Patch(':userId')
  @ApiUpdateVehicleDriver()
  public updateVehicleDriver(
    @Req() request: AuthenticatedRequest,
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateDriverDto,
  ): Promise<UserVehicleDriverResponse> {
    return this.updateVehicleDriverUseCase.execute(
      this.requireUser(request),
      new UpdateDriverInputDto(vehicleId, userId, dto.isPrimary, dto.canDrive),
    );
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiRemoveVehicleDriver()
  public async removeVehicleDriver(
    @Req() request: AuthenticatedRequest,
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<void> {
    await this.removeVehicleDriverUseCase.execute(
      this.requireUser(request),
      new RemoveDriverInputDto(vehicleId, userId),
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

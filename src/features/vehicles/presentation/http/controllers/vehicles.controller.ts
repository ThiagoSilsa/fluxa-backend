// NestJS
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
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
import { CreateVehicleDto } from '../dto/create-vehicle.dto';
import { ListVehiclesQueryDto } from '../dto/list-vehicles.query.dto';
import { UpdateVehicleDto } from '../dto/update-vehicle.dto';

// DTOs (aplicação)
import { CreateVehicleInputDto } from '../../../application/dto/create-vehicle-input.dto';
import { GetVehicleInputDto } from '../../../application/dto/get-vehicle-input.dto';
import { ListVehiclesInputDto } from '../../../application/dto/list-vehicles-input.dto';
import { UpdateVehicleInputDto } from '../../../application/dto/update-vehicle-input.dto';

// Use cases
import { CreateVehicleUseCase } from '../../../application/use-cases/create-vehicle.use-case';
import { DeactivateVehicleUseCase } from '../../../application/use-cases/deactivate-vehicle.use-case';
import { GetVehicleUseCase } from '../../../application/use-cases/get-vehicle.use-case';
import { ListVehiclesUseCase } from '../../../application/use-cases/list-vehicles.use-case';
import { UpdateVehicleUseCase } from '../../../application/use-cases/update-vehicle.use-case';

// Types de resposta
import type {
  ListVehiclesResponse,
  VehicleResponse,
} from '../../../application/dto/vehicle-response';

// Decorators Swagger da feature
import {
  ApiCreateVehicle,
  ApiDeactivateVehicle,
  ApiGetVehicle,
  ApiListVehicles,
  ApiUpdateVehicle,
} from '../../../decorators/api-vehicles.decorator';

/**
 * CRUD de veículos (por empresa) — exige `MANAGE_VEHICLES`.
 *
 * Placa normalizada + validada, `free_pass` restrito a `GRANT_FREE_PASS`,
 * `is_blocked` read-only e `vehicle_type_id` ativo (ADR 0006 §§3–6); o
 * controller só valida entrada e delega para os use cases.
 */
@Controller('vehicles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PermissionCode.MANAGE_VEHICLES)
export class VehiclesController {
  constructor(
    private readonly createVehicleUseCase: CreateVehicleUseCase,
    private readonly listVehiclesUseCase: ListVehiclesUseCase,
    private readonly getVehicleUseCase: GetVehicleUseCase,
    private readonly updateVehicleUseCase: UpdateVehicleUseCase,
    private readonly deactivateVehicleUseCase: DeactivateVehicleUseCase,
  ) {}

  @Post()
  @ApiCreateVehicle()
  public createVehicle(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateVehicleDto,
  ): Promise<VehicleResponse> {
    return this.createVehicleUseCase.execute(
      this.requireUser(request),
      new CreateVehicleInputDto(
        dto.plate,
        dto.vehicleTypeId,
        dto.model,
        dto.color,
        dto.observation,
        dto.freePass ?? false,
        dto.isBlocked,
      ),
    );
  }

  @Get()
  @ApiListVehicles()
  public listVehicles(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListVehiclesQueryDto,
  ): Promise<ListVehiclesResponse> {
    return this.listVehiclesUseCase.execute(
      this.requireUser(request),
      new ListVehiclesInputDto(
        query.search,
        query.vehicleTypeId,
        query.freePass,
        query.isActive,
        query.limit,
        query.offset,
      ),
    );
  }

  @Get(':id')
  @ApiGetVehicle()
  public getVehicle(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<VehicleResponse> {
    return this.getVehicleUseCase.execute(
      this.requireUser(request),
      new GetVehicleInputDto(id),
    );
  }

  @Patch(':id')
  @ApiUpdateVehicle()
  public updateVehicle(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVehicleDto,
  ): Promise<VehicleResponse> {
    return this.updateVehicleUseCase.execute(
      this.requireUser(request),
      new UpdateVehicleInputDto(
        id,
        dto.plate,
        dto.model,
        dto.color,
        dto.observation,
        dto.freePass,
        dto.vehicleTypeId,
        dto.isActive,
        dto.isBlocked,
      ),
    );
  }

  @Delete(':id')
  @ApiDeactivateVehicle()
  public deactivateVehicle(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<VehicleResponse> {
    return this.deactivateVehicleUseCase.execute(
      this.requireUser(request),
      new GetVehicleInputDto(id),
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

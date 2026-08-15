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
import { CreateVehicleTypeDto } from '../dto/create-vehicle-type.dto';
import { ListVehicleTypesQueryDto } from '../dto/list-vehicle-types.query.dto';
import { UpdateVehicleTypeDto } from '../dto/update-vehicle-type.dto';

// DTOs (aplicação)
import { CreateVehicleTypeInputDto } from '../../../application/dto/create-vehicle-type-input.dto';
import { GetVehicleTypeInputDto } from '../../../application/dto/get-vehicle-type-input.dto';
import { ListVehicleTypesInputDto } from '../../../application/dto/list-vehicle-types-input.dto';
import { UpdateVehicleTypeInputDto } from '../../../application/dto/update-vehicle-type-input.dto';

// Use cases
import { CreateVehicleTypeUseCase } from '../../../application/use-cases/create-vehicle-type.use-case';
import { DeactivateVehicleTypeUseCase } from '../../../application/use-cases/deactivate-vehicle-type.use-case';
import { GetVehicleTypeUseCase } from '../../../application/use-cases/get-vehicle-type.use-case';
import { ListVehicleTypesUseCase } from '../../../application/use-cases/list-vehicle-types.use-case';
import { UpdateVehicleTypeUseCase } from '../../../application/use-cases/update-vehicle-type.use-case';

// Types de resposta
import type {
  ListVehicleTypesResponse,
  VehicleTypeResponse,
} from '../../../application/dto/vehicle-type-response';

// Decorators Swagger da feature
import {
  ApiCreateVehicleType,
  ApiDeactivateVehicleType,
  ApiGetVehicleType,
  ApiListVehicleTypes,
  ApiUpdateVehicleType,
} from '../../../decorators/api-vehicles.decorator';

/**
 * CRUD de tipos de veículo (por empresa) — exige `MANAGE_VEHICLE_TYPES`.
 *
 * `code` é normalizado e único por empresa (ADR 0006 §6); a desativação é
 * soft (não remove veículos); o controller só valida entrada e delega para os
 * use cases.
 */
@Controller('vehicle-types')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PermissionCode.MANAGE_VEHICLE_TYPES)
export class VehicleTypesController {
  constructor(
    private readonly createVehicleTypeUseCase: CreateVehicleTypeUseCase,
    private readonly listVehicleTypesUseCase: ListVehicleTypesUseCase,
    private readonly getVehicleTypeUseCase: GetVehicleTypeUseCase,
    private readonly updateVehicleTypeUseCase: UpdateVehicleTypeUseCase,
    private readonly deactivateVehicleTypeUseCase: DeactivateVehicleTypeUseCase,
  ) {}

  @Post()
  @ApiCreateVehicleType()
  public createVehicleType(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateVehicleTypeDto,
  ): Promise<VehicleTypeResponse> {
    return this.createVehicleTypeUseCase.execute(
      this.requireUser(request),
      new CreateVehicleTypeInputDto(
        dto.code,
        dto.name,
        dto.isFleet ?? false,
        dto.description,
      ),
    );
  }

  @Get()
  @ApiListVehicleTypes()
  public listVehicleTypes(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListVehicleTypesQueryDto,
  ): Promise<ListVehicleTypesResponse> {
    return this.listVehicleTypesUseCase.execute(
      this.requireUser(request),
      new ListVehicleTypesInputDto(
        query.search,
        query.isFleet,
        query.isActive,
        query.limit,
        query.offset,
      ),
    );
  }

  @Get(':id')
  @ApiGetVehicleType()
  public getVehicleType(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<VehicleTypeResponse> {
    return this.getVehicleTypeUseCase.execute(
      this.requireUser(request),
      new GetVehicleTypeInputDto(id),
    );
  }

  @Patch(':id')
  @ApiUpdateVehicleType()
  public updateVehicleType(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVehicleTypeDto,
  ): Promise<VehicleTypeResponse> {
    return this.updateVehicleTypeUseCase.execute(
      this.requireUser(request),
      new UpdateVehicleTypeInputDto(
        id,
        dto.code,
        dto.name,
        dto.description,
        dto.isFleet,
        dto.isActive,
      ),
    );
  }

  @Delete(':id')
  @ApiDeactivateVehicleType()
  public deactivateVehicleType(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<VehicleTypeResponse> {
    return this.deactivateVehicleTypeUseCase.execute(
      this.requireUser(request),
      new GetVehicleTypeInputDto(id),
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

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
import { CreateDeviceDto } from '../dto/create-device.dto';
import { ListDevicesQueryDto } from '../dto/list-devices.query.dto';
import { UpdateDeviceDto } from '../dto/update-device.dto';

// DTOs (aplicação)
import { CreateDeviceInputDto } from '../../../application/dto/create-device-input.dto';
import { GetDeviceInputDto } from '../../../application/dto/get-device-input.dto';
import { ListDevicesInputDto } from '../../../application/dto/list-devices-input.dto';
import { UpdateDeviceInputDto } from '../../../application/dto/update-device-input.dto';

// Use cases
import { CreateDeviceUseCase } from '../../../application/use-cases/create-device.use-case';
import { DeleteDeviceUseCase } from '../../../application/use-cases/delete-device.use-case';
import { GetDeviceUseCase } from '../../../application/use-cases/get-device.use-case';
import { ListDevicesUseCase } from '../../../application/use-cases/list-devices.use-case';
import { RotateDeviceTokenUseCase } from '../../../application/use-cases/rotate-device-token.use-case';
import { UpdateDeviceUseCase } from '../../../application/use-cases/update-device.use-case';

// Types de resposta
import type {
  DeviceResponse,
  DeviceWithTokenResponse,
  ListDevicesResponse,
} from '../../../application/dto/device-response';

// Decorators Swagger da feature
import {
  ApiCreateDevice,
  ApiDeleteDevice,
  ApiGetDevice,
  ApiListDevices,
  ApiRotateDeviceToken,
  ApiUpdateDevice,
} from '../../../decorators/api-devices.decorator';

/**
 * CRUD de dispositivos do app do porteiro (por empresa) — exige
 * `MANAGE_DEVICES` (ADR 0008 §2).
 *
 * O token é gerado pelo backend e exibido **apenas** na criação e na rotação
 * (write-only). A exclusão é física (204); a suspensão reversível segue via
 * `PATCH isActive`.
 */
@Controller('devices')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PermissionCode.MANAGE_DEVICES)
export class DevicesController {
  constructor(
    private readonly createDeviceUseCase: CreateDeviceUseCase,
    private readonly listDevicesUseCase: ListDevicesUseCase,
    private readonly getDeviceUseCase: GetDeviceUseCase,
    private readonly updateDeviceUseCase: UpdateDeviceUseCase,
    private readonly deleteDeviceUseCase: DeleteDeviceUseCase,
    private readonly rotateDeviceTokenUseCase: RotateDeviceTokenUseCase,
  ) {}

  @Post()
  @ApiCreateDevice()
  public createDevice(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateDeviceDto,
  ): Promise<DeviceWithTokenResponse> {
    return this.createDeviceUseCase.execute(
      this.requireUser(request),
      new CreateDeviceInputDto(dto.name, dto.platform, dto.entranceId),
    );
  }

  @Get()
  @ApiListDevices()
  public listDevices(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListDevicesQueryDto,
  ): Promise<ListDevicesResponse> {
    return this.listDevicesUseCase.execute(
      this.requireUser(request),
      new ListDevicesInputDto(
        query.search,
        query.isActive,
        query.sortBy,
        query.sortOrder,
        query.limit,
        query.offset,
      ),
    );
  }

  @Get(':id')
  @ApiGetDevice()
  public getDevice(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DeviceResponse> {
    return this.getDeviceUseCase.execute(
      this.requireUser(request),
      new GetDeviceInputDto(id),
    );
  }

  @Patch(':id')
  @ApiUpdateDevice()
  public updateDevice(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeviceDto,
  ): Promise<DeviceResponse> {
    return this.updateDeviceUseCase.execute(
      this.requireUser(request),
      new UpdateDeviceInputDto(id, dto.name, dto.entranceId, dto.isActive),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiDeleteDevice()
  public deleteDevice(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.deleteDeviceUseCase.execute(
      this.requireUser(request),
      new GetDeviceInputDto(id),
    );
  }

  @Post(':id/rotate-token')
  @HttpCode(HttpStatus.OK)
  @ApiRotateDeviceToken()
  public rotateDeviceToken(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DeviceWithTokenResponse> {
    return this.rotateDeviceTokenUseCase.execute(
      this.requireUser(request),
      new GetDeviceInputDto(id),
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

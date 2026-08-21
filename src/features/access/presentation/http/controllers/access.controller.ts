// NestJS
import {
  Body,
  Controller,
  Get,
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
import { GetOpenAccessQueryDto } from '../dto/get-open-access.query.dto';
import { RegisterEntryDto } from '../dto/register-entry.dto';
import { RegisterExitDto } from '../dto/register-exit.dto';

// DTOs (aplicação)
import { GetOpenAccessInputDto } from '../../../application/dto/get-open-access-input.dto';
import { RegisterEntryInputDto } from '../../../application/dto/register-entry-input.dto';
import { RegisterExitInputDto } from '../../../application/dto/register-exit-input.dto';

// Use cases
import { GetOccupancyUseCase } from '../../../application/use-cases/get-occupancy.use-case';
import { GetOpenAccessUseCase } from '../../../application/use-cases/get-open-access.use-case';
import { RegisterEntryUseCase } from '../../../application/use-cases/register-entry.use-case';
import { RegisterExitUseCase } from '../../../application/use-cases/register-exit.use-case';

// Types de resposta
import type {
  AccessEntryResponse,
  AccessExitResponse,
  OccupancyResponse,
  OpenAccessResponse,
} from '../../../application/dto/access-response';

// Decorators Swagger da feature
import {
  ApiGetOccupancy,
  ApiGetOpenAccess,
  ApiRegisterEntry,
  ApiRegisterExit,
} from '../../../decorators/api-access.decorator';

/**
 * Núcleo de acesso (ADR 0010 §6) — entrada, saída, conferência e ocupação.
 *
 * Permissões por método: entrada exige `REGISTER_ENTRY`; saída/conferência
 * exige `REGISTER_EXIT`; ocupação exige `VIEW_DASHBOARDS`.
 */
@Controller('access')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AccessController {
  constructor(
    private readonly registerEntryUseCase: RegisterEntryUseCase,
    private readonly registerExitUseCase: RegisterExitUseCase,
    private readonly getOpenAccessUseCase: GetOpenAccessUseCase,
    private readonly getOccupancyUseCase: GetOccupancyUseCase,
  ) {}

  @Post('entry')
  @RequirePermissions(PermissionCode.REGISTER_ENTRY)
  @ApiRegisterEntry()
  public registerEntry(
    @Req() request: AuthenticatedRequest,
    @Body() dto: RegisterEntryDto,
  ): Promise<AccessEntryResponse> {
    return this.registerEntryUseCase.execute(
      this.requireUser(request),
      new RegisterEntryInputDto(
        dto.plate,
        dto.driverUserId,
        dto.temporaryDriverName,
        dto.departmentId,
        dto.accessRequestId,
        dto.overCapacity ?? false,
        dto.idempotencyKey,
      ),
    );
  }

  @Post('exit')
  @RequirePermissions(PermissionCode.REGISTER_EXIT)
  @ApiRegisterExit()
  public registerExit(
    @Req() request: AuthenticatedRequest,
    @Body() dto: RegisterExitDto,
  ): Promise<AccessExitResponse> {
    return this.registerExitUseCase.execute(
      this.requireUser(request),
      new RegisterExitInputDto(
        dto.plate,
        dto.driverUserId,
        dto.temporaryDriverName,
        dto.idempotencyKey,
      ),
    );
  }

  @Get('open')
  @RequirePermissions(PermissionCode.REGISTER_EXIT)
  @ApiGetOpenAccess()
  public getOpenAccess(
    @Req() request: AuthenticatedRequest,
    @Query() query: GetOpenAccessQueryDto,
  ): Promise<{ data: OpenAccessResponse[] }> {
    return this.getOpenAccessUseCase.execute(
      this.requireUser(request),
      new GetOpenAccessInputDto(query.plate),
    );
  }

  @Get('occupancy')
  @RequirePermissions(PermissionCode.VIEW_DASHBOARDS)
  @ApiGetOccupancy()
  public getOccupancy(
    @Req() request: AuthenticatedRequest,
  ): Promise<OccupancyResponse> {
    return this.getOccupancyUseCase.execute(this.requireUser(request));
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

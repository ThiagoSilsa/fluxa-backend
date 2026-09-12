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
import { RequireAnyPermission } from '../../../../../shared/decorators/require-any-permission.decorator';
import { RequirePermissions } from '../../../../../shared/decorators/require-permissions.decorator';

// Guards
import { AnyPermissionsGuard } from '../../../../../shared/guards/any-permissions.guard';
import { JwtAuthGuard } from '../../../../../shared/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../../../shared/guards/permissions.guard';

// Types
import type { AuthenticatedRequest } from '../../../../../shared/guards/jwt-auth.guard';
import type { AuthenticatedUserEntity } from '../../../../auth/domain/entities/authenticated-user.entity';

// DTOs (apresentação)
import { GetAccessContextQueryDto } from '../dto/get-access-context.query.dto';
import { GetOpenAccessQueryDto } from '../dto/get-open-access.query.dto';
import { ListAccessRecordsQueryDto } from '../dto/list-access-records.query.dto';
import { RegisterEntryDto } from '../dto/register-entry.dto';
import { RegisterExitDto } from '../dto/register-exit.dto';

// DTOs (aplicação)
import { GetAccessContextInputDto } from '../../../application/dto/get-access-context-input.dto';
import { GetOpenAccessInputDto } from '../../../application/dto/get-open-access-input.dto';
import { ListAccessRecordsInputDto } from '../../../application/dto/list-access-records-input.dto';
import { RegisterEntryInputDto } from '../../../application/dto/register-entry-input.dto';
import { RegisterEntryRequestInputDto } from '../../../application/dto/register-entry-request-input.dto';
import { RegisterExitInputDto } from '../../../application/dto/register-exit-input.dto';

// Use cases
import { GetAccessContextUseCase } from '../../../application/use-cases/get-access-context.use-case';
import { GetOccupancyUseCase } from '../../../application/use-cases/get-occupancy.use-case';
import { GetOpenAccessUseCase } from '../../../application/use-cases/get-open-access.use-case';
import { ListAccessRecordsUseCase } from '../../../application/use-cases/list-access-records.use-case';
import { RegisterEntryUseCase } from '../../../application/use-cases/register-entry.use-case';
import { RegisterExitUseCase } from '../../../application/use-cases/register-exit.use-case';

// Types de resposta
import type { AccessContextResponse } from '../../../application/dto/access-context-response';
import type { ListAccessRecordsResponse } from '../../../application/dto/access-record-response';
import type {
  AccessEntryResponse,
  AccessExitResponse,
  OccupancyResponse,
  OpenAccessResponse,
} from '../../../application/dto/access-response';

// Decorators Swagger da feature
import {
  ApiGetAccessContext,
  ApiGetOccupancy,
  ApiGetOpenAccess,
  ApiListAccessRecords,
  ApiRegisterEntry,
  ApiRegisterExit,
} from '../../../decorators/api-access.decorator';

/**
 * Núcleo de acesso (ADR 0010 §6) — contexto/veredito, entrada, saída,
 * conferência, ocupação e o feed de registros da portaria (ADR 0015).
 *
 * Permissões por método: contexto e feed aceitam `REGISTER_ENTRY` **ou**
 * `REGISTER_EXIT` **ou** `REGISTER_DENIAL` (OR); entrada exige
 * `REGISTER_ENTRY`; saída/conferência exige `REGISTER_EXIT`; ocupação exige
 * `VIEW_DASHBOARDS`.
 */
@Controller('access')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AccessController {
  constructor(
    private readonly registerEntryUseCase: RegisterEntryUseCase,
    private readonly registerExitUseCase: RegisterExitUseCase,
    private readonly getOpenAccessUseCase: GetOpenAccessUseCase,
    private readonly getOccupancyUseCase: GetOccupancyUseCase,
    private readonly getAccessContextUseCase: GetAccessContextUseCase,
    private readonly listAccessRecordsUseCase: ListAccessRecordsUseCase,
  ) {}

  @Get('context')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermission(
    PermissionCode.REGISTER_ENTRY,
    PermissionCode.REGISTER_EXIT,
    PermissionCode.REGISTER_DENIAL,
  )
  @ApiGetAccessContext()
  public getAccessContext(
    @Req() request: AuthenticatedRequest,
    @Query() query: GetAccessContextQueryDto,
  ): Promise<AccessContextResponse> {
    return this.getAccessContextUseCase.execute(
      this.requireUser(request),
      new GetAccessContextInputDto(
        query.plate,
        query.search,
        query.departmentId,
        query.driverUserId,
      ),
    );
  }

  @Get('records')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermission(
    PermissionCode.REGISTER_ENTRY,
    PermissionCode.REGISTER_EXIT,
    PermissionCode.REGISTER_DENIAL,
  )
  @ApiListAccessRecords()
  public listAccessRecords(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListAccessRecordsQueryDto,
  ): Promise<ListAccessRecordsResponse> {
    return this.listAccessRecordsUseCase.execute(
      this.requireUser(request),
      new ListAccessRecordsInputDto(
        query.kind,
        query.plate,
        query.dateFrom ? new Date(query.dateFrom) : undefined,
        query.dateTo ? new Date(query.dateTo) : undefined,
        query.entranceId,
        query.doormanId,
        query.limit,
        query.offset,
      ),
    );
  }

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
        dto.source,
        dto.entranceId,
        dto.request
          ? new RegisterEntryRequestInputDto(
              dto.request.type,
              dto.request.userType,
              dto.request.payload ?? {},
              dto.request.contactPhone,
              dto.request.departmentId,
            )
          : undefined,
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
        dto.source,
        dto.entranceId,
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

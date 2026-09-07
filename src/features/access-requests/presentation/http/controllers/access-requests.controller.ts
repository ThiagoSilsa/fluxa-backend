// NestJS
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
import { AcceptAccessRequestDto } from '../dto/accept-access-request.dto';
import { CreateAccessRequestDto } from '../dto/create-access-request.dto';
import { HandleAccessRequestDto } from '../dto/handle-access-request.dto';
import { ListAccessRequestsQueryDto } from '../dto/list-access-requests.query.dto';

// DTOs (aplicação)
import { AcceptAccessRequestInputDto } from '../../../application/dto/accept-access-request-input.dto';
import { CreateAccessRequestInputDto } from '../../../application/dto/create-access-request-input.dto';
import { HandleAccessRequestInputDto } from '../../../application/dto/handle-access-request-input.dto';
import { ListAccessRequestsInputDto } from '../../../application/dto/list-access-requests-input.dto';

// Use cases
import { AcceptAccessRequestUseCase } from '../../../application/use-cases/accept-access-request.use-case';
import { CancelAccessRequestUseCase } from '../../../application/use-cases/cancel-access-request.use-case';
import { CreateAccessRequestUseCase } from '../../../application/use-cases/create-access-request.use-case';
import { GetAccessRequestUseCase } from '../../../application/use-cases/get-access-request.use-case';
import { ListAccessRequestsUseCase } from '../../../application/use-cases/list-access-requests.use-case';
import { MarkInContactAccessRequestUseCase } from '../../../application/use-cases/mark-in-contact-access-request.use-case';
import { RejectAccessRequestUseCase } from '../../../application/use-cases/reject-access-request.use-case';

// Types de resposta
import type {
  AccessRequestResponse,
  ListAccessRequestsResponse,
} from '../../../application/dto/access-request-response';

// Decorators Swagger da feature
import {
  ApiAcceptAccessRequest,
  ApiCancelAccessRequest,
  ApiCreateAccessRequest,
  ApiGetAccessRequest,
  ApiListAccessRequests,
  ApiMarkInContactAccessRequest,
  ApiRejectAccessRequest,
} from '../../../decorators/api-access-requests.decorator';

/**
 * Solicitações de acesso (por empresa) — regra 41.
 *
 * Permissões por método: criar (`CREATE_ACCESS_REQUEST`) e cancelar a própria
 * (`CANCEL_ACCESS_REQUEST`) são do porteiro; listar/detalhar/aceitar/rejeitar/
 * em-contato exigem `MANAGE_ACCESS_REQUESTS` (admin/segurança).
 */
@Controller('access-requests')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AccessRequestsController {
  constructor(
    private readonly createAccessRequestUseCase: CreateAccessRequestUseCase,
    private readonly listAccessRequestsUseCase: ListAccessRequestsUseCase,
    private readonly getAccessRequestUseCase: GetAccessRequestUseCase,
    private readonly acceptAccessRequestUseCase: AcceptAccessRequestUseCase,
    private readonly rejectAccessRequestUseCase: RejectAccessRequestUseCase,
    private readonly markInContactAccessRequestUseCase: MarkInContactAccessRequestUseCase,
    private readonly cancelAccessRequestUseCase: CancelAccessRequestUseCase,
  ) {}

  @Post()
  @RequirePermissions(PermissionCode.CREATE_ACCESS_REQUEST)
  @ApiCreateAccessRequest()
  public createAccessRequest(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateAccessRequestDto,
  ): Promise<AccessRequestResponse> {
    return this.createAccessRequestUseCase.execute(
      this.requireUser(request),
      new CreateAccessRequestInputDto(
        dto.plate,
        dto.type,
        dto.vehicleId,
        dto.userId,
        dto.contactChannel,
        dto.contactPhone,
        dto.departmentId,
        dto.payload,
      ),
    );
  }

  @Get()
  @RequirePermissions(PermissionCode.MANAGE_ACCESS_REQUESTS)
  @ApiListAccessRequests()
  public listAccessRequests(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListAccessRequestsQueryDto,
  ): Promise<ListAccessRequestsResponse> {
    return this.listAccessRequestsUseCase.execute(
      this.requireUser(request),
      new ListAccessRequestsInputDto(
        query.status,
        query.plate,
        query.limit,
        query.offset,
      ),
    );
  }

  @Get(':id')
  @RequirePermissions(PermissionCode.MANAGE_ACCESS_REQUESTS)
  @ApiGetAccessRequest()
  public getAccessRequest(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AccessRequestResponse> {
    return this.getAccessRequestUseCase.execute(
      this.requireUser(request),
      new HandleAccessRequestInputDto(id),
    );
  }

  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PermissionCode.MANAGE_ACCESS_REQUESTS)
  @ApiAcceptAccessRequest()
  public acceptAccessRequest(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto?: AcceptAccessRequestDto,
  ): Promise<AccessRequestResponse> {
    return this.acceptAccessRequestUseCase.execute(
      this.requireUser(request),
      new AcceptAccessRequestInputDto(
        id,
        dto?.vehicleTypeId,
        dto?.canDrive ?? true,
        dto?.isPrimary ?? false,
        dto?.observation,
      ),
    );
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PermissionCode.MANAGE_ACCESS_REQUESTS)
  @ApiRejectAccessRequest()
  public rejectAccessRequest(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto?: HandleAccessRequestDto,
  ): Promise<AccessRequestResponse> {
    return this.rejectAccessRequestUseCase.execute(
      this.requireUser(request),
      new HandleAccessRequestInputDto(id, dto?.observation),
    );
  }

  @Post(':id/in-contact')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PermissionCode.MANAGE_ACCESS_REQUESTS)
  @ApiMarkInContactAccessRequest()
  public markInContactAccessRequest(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto?: HandleAccessRequestDto,
  ): Promise<AccessRequestResponse> {
    return this.markInContactAccessRequestUseCase.execute(
      this.requireUser(request),
      new HandleAccessRequestInputDto(id, dto?.observation),
    );
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PermissionCode.CANCEL_ACCESS_REQUEST)
  @ApiCancelAccessRequest()
  public cancelAccessRequest(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AccessRequestResponse> {
    return this.cancelAccessRequestUseCase.execute(
      this.requireUser(request),
      new HandleAccessRequestInputDto(id),
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

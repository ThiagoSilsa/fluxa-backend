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
import { CreateBlockRequestDto } from '../dto/create-block-request.dto';
import { ListBlockRequestsQueryDto } from '../dto/list-block-requests.query.dto';

// DTOs (aplicação)
import { CreateBlockRequestInputDto } from '../../../application/dto/create-block-request-input.dto';
import { HandleBlockRequestInputDto } from '../../../application/dto/list-block-requests-input.dto';
import { ListBlockRequestsInputDto } from '../../../application/dto/list-block-requests-input.dto';

// Use cases
import { ApproveBlockRequestUseCase } from '../../../application/use-cases/approve-block-request.use-case';
import { CancelBlockRequestUseCase } from '../../../application/use-cases/cancel-block-request.use-case';
import { CreateBlockRequestUseCase } from '../../../application/use-cases/create-block-request.use-case';
import { GetBlockRequestUseCase } from '../../../application/use-cases/get-block-request.use-case';
import { ListBlockRequestsUseCase } from '../../../application/use-cases/list-block-requests.use-case';
import { RejectBlockRequestUseCase } from '../../../application/use-cases/reject-block-request.use-case';

// Types de resposta
import type {
  BlockRequestResponse,
  ListBlockRequestsResponse,
} from '../../../application/dto/block-request-response';

// Decorators Swagger da feature
import {
  ApiApproveBlockRequest,
  ApiCancelBlockRequest,
  ApiCreateBlockRequest,
  ApiGetBlockRequest,
  ApiListBlockRequests,
  ApiRejectBlockRequest,
} from '../../../decorators/api-blocks.decorator';

/**
 * Solicitações de bloqueio do porteiro (por empresa).
 *
 * Permissões por método: criar/cancelar exigem `CREATE_BLOCK_REQUEST`
 * (porteiro); listar/detalhar são escalonadas por papel (gestor vê todas;
 * solicitante só as próprias — ADR 0012); aprovar/rejeitar exigem
 * `MANAGE_BLOCKS` (admin/segurança).
 */
@Controller('block-requests')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BlockRequestsController {
  constructor(
    private readonly createBlockRequestUseCase: CreateBlockRequestUseCase,
    private readonly listBlockRequestsUseCase: ListBlockRequestsUseCase,
    private readonly getBlockRequestUseCase: GetBlockRequestUseCase,
    private readonly approveBlockRequestUseCase: ApproveBlockRequestUseCase,
    private readonly rejectBlockRequestUseCase: RejectBlockRequestUseCase,
    private readonly cancelBlockRequestUseCase: CancelBlockRequestUseCase,
  ) {}

  @Post()
  @RequirePermissions(PermissionCode.CREATE_BLOCK_REQUEST)
  @ApiCreateBlockRequest()
  public createBlockRequest(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateBlockRequestDto,
  ): Promise<BlockRequestResponse> {
    return this.createBlockRequestUseCase.execute(
      this.requireUser(request),
      new CreateBlockRequestInputDto(dto.plate, dto.reason),
    );
  }

  @Get()
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermission(
    PermissionCode.MANAGE_BLOCKS,
    PermissionCode.CREATE_BLOCK_REQUEST,
  )
  @ApiListBlockRequests()
  public listBlockRequests(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListBlockRequestsQueryDto,
  ): Promise<ListBlockRequestsResponse> {
    return this.listBlockRequestsUseCase.execute(
      this.requireUser(request),
      new ListBlockRequestsInputDto(query.status, query.limit, query.offset),
    );
  }

  @Get(':id')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermission(
    PermissionCode.MANAGE_BLOCKS,
    PermissionCode.CREATE_BLOCK_REQUEST,
  )
  @ApiGetBlockRequest()
  public getBlockRequest(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BlockRequestResponse> {
    return this.getBlockRequestUseCase.execute(
      this.requireUser(request),
      new HandleBlockRequestInputDto(id),
    );
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PermissionCode.MANAGE_BLOCKS)
  @ApiApproveBlockRequest()
  public approveBlockRequest(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto?: { observation?: string },
  ): Promise<BlockRequestResponse> {
    return this.approveBlockRequestUseCase.execute(
      this.requireUser(request),
      new HandleBlockRequestInputDto(id, dto?.observation),
    );
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PermissionCode.MANAGE_BLOCKS)
  @ApiRejectBlockRequest()
  public rejectBlockRequest(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto?: { observation?: string },
  ): Promise<BlockRequestResponse> {
    return this.rejectBlockRequestUseCase.execute(
      this.requireUser(request),
      new HandleBlockRequestInputDto(id, dto?.observation),
    );
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PermissionCode.CREATE_BLOCK_REQUEST)
  @ApiCancelBlockRequest()
  public cancelBlockRequest(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BlockRequestResponse> {
    return this.cancelBlockRequestUseCase.execute(
      this.requireUser(request),
      new HandleBlockRequestInputDto(id),
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

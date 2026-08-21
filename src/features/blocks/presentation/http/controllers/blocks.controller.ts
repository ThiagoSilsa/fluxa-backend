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
import { CreateBlockDto } from '../dto/create-block.dto';
import { ListBlocksQueryDto } from '../dto/list-blocks.query.dto';
import { RevokeBlockDto } from '../dto/revoke-block.dto';

// DTOs (aplicação)
import { CreateBlockInputDto } from '../../../application/dto/create-block-input.dto';
import { GetBlockInputDto } from '../../../application/dto/list-blocks-input.dto';
import { ListBlocksInputDto } from '../../../application/dto/list-blocks-input.dto';
import { RevokeBlockInputDto } from '../../../application/dto/revoke-block-input.dto';

// Use cases
import { CreateVehicleBlockUseCase } from '../../../application/use-cases/create-vehicle-block.use-case';
import { GetVehicleBlockUseCase } from '../../../application/use-cases/get-vehicle-block.use-case';
import { ListVehicleBlocksUseCase } from '../../../application/use-cases/list-vehicle-blocks.use-case';
import { RevokeVehicleBlockUseCase } from '../../../application/use-cases/revoke-vehicle-block.use-case';

// Types de resposta
import type {
  BlockResponse,
  ListBlocksResponse,
} from '../../../application/dto/block-response';

// Decorators Swagger da feature
import {
  ApiCreateBlock,
  ApiGetBlock,
  ApiListBlocks,
  ApiRevokeBlock,
} from '../../../decorators/api-blocks.decorator';

/**
 * Gestão de bloqueios de veículos (por empresa) — exige `MANAGE_BLOCKS`
 * (ADR 0010 §2). O `is_blocked` do veículo é mantido nesta feature.
 */
@Controller('blocks')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PermissionCode.MANAGE_BLOCKS)
export class BlocksController {
  constructor(
    private readonly createVehicleBlockUseCase: CreateVehicleBlockUseCase,
    private readonly listVehicleBlocksUseCase: ListVehicleBlocksUseCase,
    private readonly getVehicleBlockUseCase: GetVehicleBlockUseCase,
    private readonly revokeVehicleBlockUseCase: RevokeVehicleBlockUseCase,
  ) {}

  @Post()
  @ApiCreateBlock()
  public createBlock(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateBlockDto,
  ): Promise<BlockResponse> {
    return this.createVehicleBlockUseCase.execute(
      this.requireUser(request),
      new CreateBlockInputDto(dto.plate, dto.reason),
    );
  }

  @Get()
  @ApiListBlocks()
  public listBlocks(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListBlocksQueryDto,
  ): Promise<ListBlocksResponse> {
    return this.listVehicleBlocksUseCase.execute(
      this.requireUser(request),
      new ListBlocksInputDto(
        query.search,
        query.status,
        query.limit,
        query.offset,
      ),
    );
  }

  @Get(':id')
  @ApiGetBlock()
  public getBlock(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BlockResponse> {
    return this.getVehicleBlockUseCase.execute(
      this.requireUser(request),
      new GetBlockInputDto(id),
    );
  }

  @Post(':id/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiRevokeBlock()
  public revokeBlock(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RevokeBlockDto,
  ): Promise<BlockResponse> {
    return this.revokeVehicleBlockUseCase.execute(
      this.requireUser(request),
      new RevokeBlockInputDto(id, dto.reason),
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

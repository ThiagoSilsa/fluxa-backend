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
import { CreateEntranceDto } from '../dto/create-entrance.dto';
import { ListEntrancesQueryDto } from '../dto/list-entrances.query.dto';
import { UpdateEntranceDto } from '../dto/update-entrance.dto';

// DTOs (aplicação)
import { CreateEntranceInputDto } from '../../../application/dto/create-entrance-input.dto';
import { GetEntranceInputDto } from '../../../application/dto/get-entrance-input.dto';
import { ListEntrancesInputDto } from '../../../application/dto/list-entrances-input.dto';
import { UpdateEntranceInputDto } from '../../../application/dto/update-entrance-input.dto';

// Use cases
import { CreateEntranceUseCase } from '../../../application/use-cases/create-entrance.use-case';
import { DeleteEntranceUseCase } from '../../../application/use-cases/delete-entrance.use-case';
import { GetEntranceUseCase } from '../../../application/use-cases/get-entrance.use-case';
import { ListEntrancesUseCase } from '../../../application/use-cases/list-entrances.use-case';
import { UpdateEntranceUseCase } from '../../../application/use-cases/update-entrance.use-case';

// Types de resposta
import type {
  EntranceResponse,
  ListEntrancesResponse,
} from '../../../application/dto/entrance-response';

// Decorators Swagger da feature
import {
  ApiCreateEntrance,
  ApiDeleteEntrance,
  ApiGetEntrance,
  ApiListEntrances,
  ApiUpdateEntrance,
} from '../../../decorators/api-entrances.decorator';

/**
 * CRUD de portarias (por empresa) — exige `MANAGE_ENTRANCES`.
 *
 * Portaria é independente de departamento (ADR 0006 §5); a exclusão é física
 * (204) e bloqueada com 409 quando há dispositivos vinculados via `device`; a
 * suspensão reversível segue via `PATCH isActive`.
 */
@Controller('entrances')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PermissionCode.MANAGE_ENTRANCES)
export class EntrancesController {
  constructor(
    private readonly createEntranceUseCase: CreateEntranceUseCase,
    private readonly listEntrancesUseCase: ListEntrancesUseCase,
    private readonly getEntranceUseCase: GetEntranceUseCase,
    private readonly updateEntranceUseCase: UpdateEntranceUseCase,
    private readonly deleteEntranceUseCase: DeleteEntranceUseCase,
  ) {}

  @Post()
  @ApiCreateEntrance()
  public createEntrance(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateEntranceDto,
  ): Promise<EntranceResponse> {
    return this.createEntranceUseCase.execute(
      this.requireUser(request),
      new CreateEntranceInputDto(dto.name),
    );
  }

  @Get()
  @ApiListEntrances()
  public listEntrances(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListEntrancesQueryDto,
  ): Promise<ListEntrancesResponse> {
    return this.listEntrancesUseCase.execute(
      this.requireUser(request),
      new ListEntrancesInputDto(
        query.search,
        query.isActive,
        query.limit,
        query.offset,
      ),
    );
  }

  @Get(':id')
  @ApiGetEntrance()
  public getEntrance(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EntranceResponse> {
    return this.getEntranceUseCase.execute(
      this.requireUser(request),
      new GetEntranceInputDto(id),
    );
  }

  @Patch(':id')
  @ApiUpdateEntrance()
  public updateEntrance(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEntranceDto,
  ): Promise<EntranceResponse> {
    return this.updateEntranceUseCase.execute(
      this.requireUser(request),
      new UpdateEntranceInputDto(id, dto.name, dto.isActive),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiDeleteEntrance()
  public deleteEntrance(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.deleteEntranceUseCase.execute(
      this.requireUser(request),
      new GetEntranceInputDto(id),
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

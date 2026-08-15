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
import { AssociatePermissionDto } from '../dto/associate-permission.dto';
import { CreateRoleDto } from '../dto/create-role.dto';
import { ListRolesQueryDto } from '../dto/list-roles.query.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';

// DTOs (aplicação)
import { AssociatePermissionInputDto } from '../../../application/dto/associate-permission-input.dto';
import { CreateRoleInputDto } from '../../../application/dto/create-role-input.dto';
import { GetRoleInputDto } from '../../../application/dto/get-role-input.dto';
import { ListRolePermissionsInputDto } from '../../../application/dto/list-role-permissions-input.dto';
import { ListRolesInputDto } from '../../../application/dto/list-roles-input.dto';
import { RemovePermissionInputDto } from '../../../application/dto/remove-permission-input.dto';
import { UpdateRoleInputDto } from '../../../application/dto/update-role-input.dto';

// Use cases
import { AssociatePermissionToRoleUseCase } from '../../../application/use-cases/associate-permission-to-role.use-case';
import { CreateRoleUseCase } from '../../../application/use-cases/create-role.use-case';
import { DeactivateRoleUseCase } from '../../../application/use-cases/deactivate-role.use-case';
import { GetRoleUseCase } from '../../../application/use-cases/get-role.use-case';
import { ListRolePermissionsUseCase } from '../../../application/use-cases/list-role-permissions.use-case';
import { ListRolesUseCase } from '../../../application/use-cases/list-roles.use-case';
import { RemovePermissionFromRoleUseCase } from '../../../application/use-cases/remove-permission-from-role.use-case';
import { UpdateRoleUseCase } from '../../../application/use-cases/update-role.use-case';

// Types de resposta
import type {
  ListRolesResponse,
  PermissionResponse,
  RoleResponse,
} from '../../../application/dto/role-response';
import type { ListRolePermissionsResponse } from '../../../application/dto/role-permission-response';

// Decorators Swagger da feature
import {
  ApiAssociatePermission,
  ApiCreateRole,
  ApiDeactivateRole,
  ApiGetRole,
  ApiListRolePermissions,
  ApiListRoles,
  ApiRemovePermission,
  ApiUpdateRole,
} from '../../../decorators/api-roles.decorator';

/**
 * CRUD de cargos (por empresa) — exige `MANAGE_ROLES`.
 *
 * Cargos `is_admin` são imutáveis pelo CRUD (ADR 0004) — as regras vivem nos
 * use cases; o controller só valida entrada e delega.
 */
@Controller('roles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PermissionCode.MANAGE_ROLES)
export class RolesController {
  constructor(
    private readonly createRoleUseCase: CreateRoleUseCase,
    private readonly listRolesUseCase: ListRolesUseCase,
    private readonly getRoleUseCase: GetRoleUseCase,
    private readonly updateRoleUseCase: UpdateRoleUseCase,
    private readonly deactivateRoleUseCase: DeactivateRoleUseCase,
    private readonly associatePermissionToRoleUseCase: AssociatePermissionToRoleUseCase,
    private readonly removePermissionFromRoleUseCase: RemovePermissionFromRoleUseCase,
    private readonly listRolePermissionsUseCase: ListRolePermissionsUseCase,
  ) {}

  @Post()
  @ApiCreateRole()
  public createRole(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateRoleDto,
  ): Promise<RoleResponse> {
    return this.createRoleUseCase.execute(
      this.requireUser(request),
      new CreateRoleInputDto(dto.name, dto.description, dto.isAdmin),
    );
  }

  @Get()
  @ApiListRoles()
  public listRoles(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListRolesQueryDto,
  ): Promise<ListRolesResponse> {
    return this.listRolesUseCase.execute(
      this.requireUser(request),
      new ListRolesInputDto(query.search, query.limit, query.offset),
    );
  }

  @Get(':id')
  @ApiGetRole()
  public getRole(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RoleResponse> {
    return this.getRoleUseCase.execute(
      this.requireUser(request),
      new GetRoleInputDto(id),
    );
  }

  @Patch(':id')
  @ApiUpdateRole()
  public updateRole(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ): Promise<RoleResponse> {
    return this.updateRoleUseCase.execute(
      this.requireUser(request),
      new UpdateRoleInputDto(id, dto.name, dto.description),
    );
  }

  @Delete(':id')
  @ApiDeactivateRole()
  public deactivateRole(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RoleResponse> {
    return this.deactivateRoleUseCase.execute(
      this.requireUser(request),
      new GetRoleInputDto(id),
    );
  }

  @Post(':id/permissions')
  @HttpCode(HttpStatus.CREATED)
  @ApiAssociatePermission()
  public associatePermission(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssociatePermissionDto,
  ): Promise<PermissionResponse> {
    return this.associatePermissionToRoleUseCase.execute(
      this.requireUser(request),
      new AssociatePermissionInputDto(id, dto.permissionId),
    );
  }

  @Get(':id/permissions')
  @ApiListRolePermissions()
  public listRolePermissions(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ListRolePermissionsResponse> {
    return this.listRolePermissionsUseCase.execute(
      this.requireUser(request),
      new ListRolePermissionsInputDto(id),
    );
  }

  @Delete(':id/permissions/:permissionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiRemovePermission()
  public async removePermission(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('permissionId', ParseUUIDPipe) permissionId: string,
  ): Promise<void> {
    await this.removePermissionFromRoleUseCase.execute(
      this.requireUser(request),
      new RemovePermissionInputDto(id, permissionId),
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

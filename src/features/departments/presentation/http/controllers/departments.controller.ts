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
import { CreateDepartmentDto } from '../dto/create-department.dto';
import { ListDepartmentsQueryDto } from '../dto/list-departments.query.dto';
import { UpdateDepartmentDto } from '../dto/update-department.dto';

// DTOs (aplicação)
import { CreateDepartmentInputDto } from '../../../application/dto/create-department-input.dto';
import { GetDepartmentInputDto } from '../../../application/dto/get-department-input.dto';
import { ListDepartmentsInputDto } from '../../../application/dto/list-departments-input.dto';
import { UpdateDepartmentInputDto } from '../../../application/dto/update-department-input.dto';

// Use cases
import { CreateDepartmentUseCase } from '../../../application/use-cases/create-department.use-case';
import { DeactivateDepartmentUseCase } from '../../../application/use-cases/deactivate-department.use-case';
import { GetDepartmentUseCase } from '../../../application/use-cases/get-department.use-case';
import { ListDepartmentsUseCase } from '../../../application/use-cases/list-departments.use-case';
import { UpdateDepartmentUseCase } from '../../../application/use-cases/update-department.use-case';

// Types de resposta
import type {
  DepartmentResponse,
  ListDepartmentsResponse,
} from '../../../application/dto/department-response';

// Decorators Swagger da feature
import {
  ApiCreateDepartment,
  ApiDeactivateDepartment,
  ApiGetDepartment,
  ApiListDepartments,
  ApiUpdateDepartment,
} from '../../../decorators/api-departments.decorator';

/**
 * CRUD de departamentos (por empresa) — exige `MANAGE_DEPARTMENTS`.
 *
 * `parking_space` é obrigatório no cadastro (ADR 0006 §7) e a desativação é
 * soft (não remove vínculos); o controller só valida entrada e delega para os
 * use cases.
 */
@Controller('departments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PermissionCode.MANAGE_DEPARTMENTS)
export class DepartmentsController {
  constructor(
    private readonly createDepartmentUseCase: CreateDepartmentUseCase,
    private readonly listDepartmentsUseCase: ListDepartmentsUseCase,
    private readonly getDepartmentUseCase: GetDepartmentUseCase,
    private readonly updateDepartmentUseCase: UpdateDepartmentUseCase,
    private readonly deactivateDepartmentUseCase: DeactivateDepartmentUseCase,
  ) {}

  @Post()
  @ApiCreateDepartment()
  public createDepartment(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateDepartmentDto,
  ): Promise<DepartmentResponse> {
    return this.createDepartmentUseCase.execute(
      this.requireUser(request),
      new CreateDepartmentInputDto(dto.name, dto.parkingSpace, dto.description),
    );
  }

  @Get()
  @ApiListDepartments()
  public listDepartments(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListDepartmentsQueryDto,
  ): Promise<ListDepartmentsResponse> {
    return this.listDepartmentsUseCase.execute(
      this.requireUser(request),
      new ListDepartmentsInputDto(
        query.search,
        query.isActive,
        query.limit,
        query.offset,
      ),
    );
  }

  @Get(':id')
  @ApiGetDepartment()
  public getDepartment(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DepartmentResponse> {
    return this.getDepartmentUseCase.execute(
      this.requireUser(request),
      new GetDepartmentInputDto(id),
    );
  }

  @Patch(':id')
  @ApiUpdateDepartment()
  public updateDepartment(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDepartmentDto,
  ): Promise<DepartmentResponse> {
    return this.updateDepartmentUseCase.execute(
      this.requireUser(request),
      new UpdateDepartmentInputDto(
        id,
        dto.name,
        dto.description,
        dto.parkingSpace,
        dto.isActive,
      ),
    );
  }

  @Delete(':id')
  @ApiDeactivateDepartment()
  public deactivateDepartment(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DepartmentResponse> {
    return this.deactivateDepartmentUseCase.execute(
      this.requireUser(request),
      new GetDepartmentInputDto(id),
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

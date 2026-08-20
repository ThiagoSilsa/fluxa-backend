// NestJS
import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

// Swagger
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

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
import { ListImportJobsQueryDto } from '../dto/list-import-jobs.query.dto';

// DTOs (aplicação)
import { ListImportJobsDto } from '../../../application/dto/list-import-jobs.dto';
import type {
  ImportJobResponse,
  ListImportJobsResponse,
} from '../../../application/dto/import-job-response';

// Use cases
import { GetImportJobStatusUseCase } from '../../../application/use-cases/get-import-job-status.use-case';
import { ListImportJobsUseCase } from '../../../application/use-cases/list-import-jobs.use-case';

// Decorators Swagger da feature
import {
  ApiGetImportJobStatus,
  ApiListImportJobs,
} from '../../../decorators/api-import-jobs.decorator';

/**
 * Consulta de jobs de importação (por empresa) — exige `MANAGE_IMPORTS`
 * (ADR 0007 §6). A criação dos jobs acontece nos importadores de cada recurso
 * (`POST /<recurso>/import` — Fase 1, marcos 3–5).
 */
@Controller('import-jobs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PermissionCode.MANAGE_IMPORTS)
export class ImportJobsController {
  constructor(
    private readonly listImportJobsUseCase: ListImportJobsUseCase,
    private readonly getImportJobStatusUseCase: GetImportJobStatusUseCase,
  ) {}

  /**
   * Lista jobs de importação da empresa da sessão (paginação + filtro por tipo).
   *
   * @param request Requisição autenticada.
   * @param query Filtros e paginação.
   * @returns Resposta paginada de jobs.
   */
  @Get()
  @ApiListImportJobs()
  public listJobs(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListImportJobsQueryDto,
  ): Promise<ListImportJobsResponse> {
    return this.listImportJobsUseCase.execute(
      this.requireUser(request),
      new ListImportJobsDto(query.type, query.limit, query.offset),
    );
  }

  /**
   * Consulta o status de um job de importação (polling da UI).
   *
   * @param request Requisição autenticada.
   * @param jobId Id do job (uuid).
   * @returns O job no formato de resposta.
   */
  @Get(':jobId')
  @ApiGetImportJobStatus()
  public getJobStatus(
    @Req() request: AuthenticatedRequest,
    @Param('jobId', ParseUUIDPipe) jobId: string,
  ): Promise<ImportJobResponse> {
    return this.getImportJobStatusUseCase.execute(
      this.requireUser(request),
      jobId,
    );
  }

  /**
   * Extrai o ator autenticado do request.
   *
   * @param request Requisição autenticada.
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

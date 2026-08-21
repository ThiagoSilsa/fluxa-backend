// NestJS
import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

// Swagger
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';

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

// Use cases
import { ImportDepartmentsUseCase } from '../../../application/use-cases/import-departments.use-case';

// DTOs
import type { ImportDepartmentsResult } from '../../../application/dto/import-departments-result';

// Decorators Swagger da feature
import { ApiImportDepartments } from '../../../decorators/api-departments.decorator';

/** Limite máximo de upload (ADR 0007 §6). */
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Upload de importação de departamentos — exige `MANAGE_IMPORTS`
 * (ADR 0007 §6). O arquivo é validado estruturalmente e enfileirado; o
 * processamento acontece no worker (`ImportDepartmentsProcessor`).
 */
@ApiTags('Importação de Departamentos')
@ApiBearerAuth('access-token')
@Controller('departments/import')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PermissionCode.MANAGE_IMPORTS)
export class DepartmentsImportController {
  constructor(
    private readonly importDepartmentsUseCase: ImportDepartmentsUseCase,
  ) {}

  /**
   * Recebe o XLSX (multipart, campo `file`) e enfileira a importação.
   *
   * @param request Requisição autenticada.
   * @param file Arquivo `.xlsx` (≤ 50MB).
   * @returns `{ jobId, status: 'PENDING' }` para o polling da UI.
   */
  @Post()
  @ApiImportDepartments()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, callback) => {
        if (!file.originalname.toLowerCase().endsWith('.xlsx')) {
          callback(
            new BadRequestException('Apenas arquivos XLSX são aceitos.'),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  public importDepartments(
    @Req() request: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ImportDepartmentsResult> {
    return this.importDepartmentsUseCase.execute(
      this.requireUser(request),
      file,
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

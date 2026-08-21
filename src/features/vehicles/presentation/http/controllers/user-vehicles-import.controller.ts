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
import { ImportUserVehiclesUseCase } from '../../../application/use-cases/import-user-vehicles.use-case';

// DTOs
import type { ImportUserVehiclesResult } from '../../../application/dto/import-user-vehicles-result';

// Decorators Swagger da feature
import { ApiImportUserVehicles } from '../../../decorators/api-vehicles.decorator';

/** Limite máximo de upload (ADR 0007 §6). */
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Upload de importação de vínculo usuário-veículo — exige `MANAGE_IMPORTS`
 * (ADR 0007 §6). O processamento acontece no worker
 * (`ImportUserVehiclesProcessor`).
 */
@ApiTags('Importação de Vínculo Usuário-Veículo')
@ApiBearerAuth('access-token')
@Controller('user-vehicles/import')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PermissionCode.MANAGE_IMPORTS)
export class UserVehiclesImportController {
  constructor(
    private readonly importUserVehiclesUseCase: ImportUserVehiclesUseCase,
  ) {}

  /**
   * Recebe o XLSX (multipart, campo `file`) e enfileira a importação.
   *
   * @param request Requisição autenticada.
   * @param file Arquivo `.xlsx` (≤ 50MB).
   * @returns `{ jobId, status: 'PENDING' }` para o polling da UI.
   */
  @Post()
  @ApiImportUserVehicles()
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
  public importUserVehicles(
    @Req() request: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ImportUserVehiclesResult> {
    return this.importUserVehiclesUseCase.execute(
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

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
import { ImportVehiclesUseCase } from '../../../application/use-cases/import-vehicles.use-case';

// DTOs
import type { ImportVehiclesResult } from '../../../application/dto/import-vehicles-result';

// Decorators Swagger da feature
import { ApiImportVehicles } from '../../../decorators/api-vehicles.decorator';

/** Limite máximo de upload (ADR 0007 §6). */
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Upload de importação de veículos — exige `MANAGE_IMPORTS` (ADR 0007 §6).
 * `freePass = true` em qualquer linha exige `GRANT_FREE_PASS` (validação no
 * use case, mesma regra do CRUD — ADR 0006 §4). O processamento acontece no
 * worker (`ImportVehiclesProcessor`).
 */
@ApiTags('Importação de Veículos')
@ApiBearerAuth('access-token')
@Controller('vehicles/import')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PermissionCode.MANAGE_IMPORTS)
export class VehiclesImportController {
  constructor(private readonly importVehiclesUseCase: ImportVehiclesUseCase) {}

  /**
   * Recebe o XLSX (multipart, campo `file`) e enfileira a importação.
   *
   * @param request Requisição autenticada.
   * @param file Arquivo `.xlsx` (≤ 50MB).
   * @returns `{ jobId, status: 'PENDING' }` para o polling da UI.
   */
  @Post()
  @ApiImportVehicles()
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
  public importVehicles(
    @Req() request: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ImportVehiclesResult> {
    return this.importVehiclesUseCase.execute(this.requireUser(request), file);
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

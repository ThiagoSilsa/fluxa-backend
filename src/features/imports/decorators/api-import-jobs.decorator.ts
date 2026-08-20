// NestJS
import { applyDecorators } from '@nestjs/common';

// Swagger
import { ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';

// Constants
import { ImportJobType } from '../domain/constants/import-job.constant';

/**
 * Decorator Swagger de `GET /import-jobs` — listagem paginada de jobs.
 */
export function ApiListImportJobs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Lista jobs de importação da empresa',
      description:
        'Jobs da empresa da sessão, do mais recente para o mais antigo, com ' +
        'paginação e filtro opcional por tipo (MANAGE_IMPORTS).',
    }),
    ApiQuery({
      name: 'type',
      required: false,
      enum: ImportJobType,
      description: 'Filtro por tipo de importação.',
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
      description: 'Tamanho da página (default 20).',
    }),
    ApiQuery({
      name: 'offset',
      required: false,
      type: Number,
      description: 'Offset da página (default 0).',
    }),
    ApiResponse({ status: 200, description: 'Jobs listados.' }),
  );
}

/**
 * Decorator Swagger de `GET /import-jobs/:jobId` — status de um job.
 */
export function ApiGetImportJobStatus() {
  return applyDecorators(
    ApiOperation({
      summary: 'Consulta o status de um job de importação',
      description: 'Usado pelo polling da UI enquanto o job processa.',
    }),
    ApiParam({
      name: 'jobId',
      type: String,
      format: 'uuid',
      description: 'Id do job.',
    }),
    ApiResponse({ status: 200, description: 'Job retornado.' }),
    ApiResponse({ status: 404, description: 'Job não encontrado.' }),
  );
}

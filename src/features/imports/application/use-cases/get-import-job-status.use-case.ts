// NestJS
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

// Domain
import { IMPORT_JOB_REPOSITORY } from '../../domain/repositories/import-job.repository';

// DTOs
import type { ImportJobResponse } from '../dto/import-job-response';

// Utils
import { toImportJobResponse } from '../utils/import-job-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { ImportJobRepository } from '../../domain/repositories/import-job.repository';

/**
 * Consulta o status atual de um job de importação da empresa da sessão —
 * usado pelo polling da UI (ADR 0007 §9).
 */
@Injectable()
export class GetImportJobStatusUseCase {
  private readonly logger = new Logger(GetImportJobStatusUseCase.name);

  constructor(
    @Inject(IMPORT_JOB_REPOSITORY)
    private readonly importJobRepository: ImportJobRepository,
  ) {}

  /**
   * Busca o job pelo id dentro da empresa da sessão.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param jobId Id do job.
   * @returns O job no formato de resposta.
   * @throws {NotFoundException} Quando o job não existe ou é de outro tenant.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    jobId: string,
  ): Promise<ImportJobResponse> {
    const job = await this.importJobRepository.findByIdAndCompanyId(
      jobId,
      actor.companyId,
    );

    if (!job) {
      throw new NotFoundException('Job de importação não encontrado.');
    }

    return toImportJobResponse(job);
  }
}

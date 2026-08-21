// NestJS
import { Inject, Injectable, Logger } from '@nestjs/common';

// Domain
import { IMPORT_JOB_REPOSITORY } from '../../domain/repositories/import-job.repository';

// DTOs
import { ListImportJobsDto } from '../dto/list-import-jobs.dto';
import type { ListImportJobsResponse } from '../dto/import-job-response';

// Utils
import { toImportJobResponse } from '../utils/import-job-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { ImportJobRepository } from '../../domain/repositories/import-job.repository';

/**
 * Lista os jobs de importação da empresa da sessão, do mais recente para o
 * mais antigo, com paginação e filtro opcional por tipo (ADR 0007 §6/§10).
 */
@Injectable()
export class ListImportJobsUseCase {
  private readonly logger = new Logger(ListImportJobsUseCase.name);

  constructor(
    @Inject(IMPORT_JOB_REPOSITORY)
    private readonly importJobRepository: ImportJobRepository,
  ) {}

  /**
   * Executa a listagem paginada de jobs da empresa da sessão.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Filtros e paginação (já validados pelo controller).
   * @returns Resposta paginada no formato padrão `{ limit, offset, count, data }`.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: ListImportJobsDto,
  ): Promise<ListImportJobsResponse> {
    const result = await this.importJobRepository.findByCompanyIdPaginated({
      companyId: actor.companyId,
      type: input.type,
      limit: input.limit,
      offset: input.offset,
    });

    return {
      limit: input.limit,
      offset: input.offset,
      count: result.count,
      data: result.data.map((job) => toImportJobResponse(job)),
    };
  }
}

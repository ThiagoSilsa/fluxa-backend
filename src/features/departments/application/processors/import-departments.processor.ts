// Node
import * as fs from 'node:fs';

// NestJS
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

// Shared
import { QUEUE_NAMES } from '../../../../shared/queue/queue.module';
import { readSheetAsRows } from '../../../../shared/spreadsheet/read-spreadsheet.util';
import type { SheetRow } from '../../../../shared/spreadsheet/read-spreadsheet.util';

// Departments
import { DEPARTMENT_REPOSITORY } from '../../domain/repositories/department.repository';
import type { DepartmentRepository } from '../../domain/repositories/department.repository';
import type { CreateDepartmentRepositoryData } from '../../domain/repositories/department.repository';

// Imports (feature genérica)
import { IMPORT_JOB_REPOSITORY } from '../../../imports/domain/repositories/import-job.repository';
import { ImportJobStatus } from '../../../imports/domain/constants/import-job.constant';
import type { ImportJobRepository } from '../../../imports/domain/repositories/import-job.repository';

// DTOs
import type { ImportDepartmentsJobData } from '../dto/import-departments-job-data';

/**
 * Worker de importação de departamentos (ADR 0007 §2/§5/§8).
 *
 * Consome a fila `import-departments` com `concurrency: 1`, lê o arquivo do
 * disco, valida linha a linha (fail-fast) e insere em lote (chunks de 500).
 * Atualiza o job: `PROCESSING` → `DONE` (contadores) ou `FAILED` (com
 * `errorMessage` `Linha N: ...`).
 */
@Processor(QUEUE_NAMES.IMPORT_DEPARTMENTS, { concurrency: 1 })
@Injectable()
export class ImportDepartmentsProcessor extends WorkerHost {
  private readonly logger = new Logger(ImportDepartmentsProcessor.name);

  /** Tamanho do lote de inserção (ADR 0007 §8). */
  private readonly CHUNK_SIZE = 500;

  constructor(
    @Inject(IMPORT_JOB_REPOSITORY)
    private readonly importJobRepository: ImportJobRepository,
    @Inject(DEPARTMENT_REPOSITORY)
    private readonly departmentRepository: DepartmentRepository,
  ) {
    super();
  }

  /**
   * Processa um job de importação de departamentos.
   *
   * @param job Job enfileirado (jobId, companyId, filePath, ...).
   */
  public async process(job: Job<ImportDepartmentsJobData>): Promise<void> {
    const { jobId, companyId, filePath } = job.data;

    try {
      // 1. PROCESSING
      await this.importJobRepository.updateStatus(
        jobId,
        ImportJobStatus.PROCESSING,
        { startedAt: new Date() },
      );

      // 2. Lê e parseia do disco
      let records: SheetRow[];
      try {
        records = await readSheetAsRows({ filePath });
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        throw new BadRequestException('Erro ao ler o arquivo XLSX do disco.');
      }

      if (records.length === 0) {
        throw new BadRequestException('A planilha está vazia.');
      }

      // 3. Valida linha a linha (fail-fast) e prepara os inputs
      const inputs = await this.buildCreateInputs(records, companyId);

      // 4. Insere em lote (chunks de 500)
      let inserted = 0;
      for (let i = 0; i < inputs.length; i += this.CHUNK_SIZE) {
        const chunk = inputs.slice(i, i + this.CHUNK_SIZE);
        const created = await this.departmentRepository.createBatch(chunk);
        inserted += created.length;
      }

      // 5. DONE com contadores
      await this.importJobRepository.updateStatus(jobId, ImportJobStatus.DONE, {
        processedRows: records.length,
        successCount: inserted,
        errorCount: 0,
        completedAt: new Date(),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erro desconhecido';
      this.logger.error(`Job ${jobId} falhou: ${message}`);

      // 6. FAILED com mensagem
      await this.importJobRepository.updateStatus(
        jobId,
        ImportJobStatus.FAILED,
        {
          errorMessage: message,
          errorCount: 1,
          completedAt: new Date(),
        },
      );
      throw error;
    } finally {
      this.cleanupTempFile(filePath);
    }
  }

  /**
   * Valida todas as linhas (fail-fast) e devolve os inputs de criação.
   *
   * Regras por linha (ADR 0007 §8): `name` entre 2 e 255 caracteres (sem
   * duplicado na empresa nem dentro do arquivo); `parkingSpace` inteiro ≥ 0;
   * `description` opcional.
   *
   * @param records Linhas da planilha (cabeçalho → texto).
   * @param companyId Empresa da sessão.
   * @returns Inputs de criação prontos para `createBatch`.
   * @throws {BadRequestException} Na primeira linha inválida (`Linha N: ...`).
   */
  private async buildCreateInputs(
    records: SheetRow[],
    companyId: string,
  ): Promise<CreateDepartmentRepositoryData[]> {
    const names = records
      .map((record) => (record.name ?? '').trim())
      .filter((name) => name !== '');
    const existing = await this.departmentRepository.findByNamesAndCompanyId(
      names,
      companyId,
    );
    const existingNames = new Set(
      existing.map((department) => department.name),
    );
    const seen = new Set<string>();
    const inputs: CreateDepartmentRepositoryData[] = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const lineNumber = i + 2; // linha 1 é o cabeçalho

      const name = (record.name ?? '').trim();
      if (name.length < 2 || name.length > 255) {
        throw new BadRequestException(
          `Linha ${lineNumber}: name deve ter entre 2 e 255 caracteres.`,
        );
      }
      if (existingNames.has(name) || seen.has(name)) {
        throw new BadRequestException(
          `Linha ${lineNumber}: departamento "${name}" já existe.`,
        );
      }
      seen.add(name);

      const parkingSpaceRaw = (record.parkingSpace ?? '').trim();
      if (parkingSpaceRaw === '' || !/^\d+$/.test(parkingSpaceRaw)) {
        throw new BadRequestException(
          `Linha ${lineNumber}: parkingSpace deve ser um inteiro maior ou igual a 0.`,
        );
      }
      const parkingSpace = parseInt(parkingSpaceRaw, 10);

      const description = (record.description ?? '').trim() || null;

      inputs.push({ companyId, name, description, parkingSpace });
    }

    return inputs;
  }

  /**
   * Remove o diretório temporário do arquivo (chamado em `finally`).
   *
   * @param filePath Caminho do arquivo temporário.
   */
  private cleanupTempFile(filePath: string): void {
    try {
      const dir = filePath.replace(/\/[^/]+$/, '');
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // silencia erro de cleanup
    }
  }
}

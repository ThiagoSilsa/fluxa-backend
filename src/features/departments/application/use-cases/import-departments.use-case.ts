// Node
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

// NestJS
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

// Shared
import { QUEUE_NAMES } from '../../../../shared/queue/queue.module';
import { readSheetAsRows } from '../../../../shared/spreadsheet/read-spreadsheet.util';
import type { SheetRow } from '../../../../shared/spreadsheet/read-spreadsheet.util';

// Imports (feature genérica)
import { IMPORT_JOB_REPOSITORY } from '../../../imports/domain/repositories/import-job.repository';
import { ImportJobType } from '../../../imports/domain/constants/import-job.constant';
import type { ImportJobRepository } from '../../../imports/domain/repositories/import-job.repository';

// DTOs
import type { ImportDepartmentsJobData } from '../dto/import-departments-job-data';
import type { ImportDepartmentsResult } from '../dto/import-departments-result';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';

/**
 * Colunas obrigatórias na planilha de departamentos (aba `data`).
 */
const REQUIRED_COLUMNS = ['name', 'parkingSpace'];

/**
 * Colunas aceitas na planilha de departamentos (obrigatórias + opcionais).
 */
const EXPECTED_COLUMNS = ['name', 'parkingSpace', 'description'];

/**
 * Use case de upload de importação de departamentos (ADR 0007 §5/§6/§8).
 *
 * Valida a estrutura do XLSX (extensão, aba `data`, vazio, colunas), salva o
 * arquivo em diretório temporário, cria o job `PENDING` e enfileira o
 * processamento — o trabalho pesado fica no `ImportDepartmentsProcessor`.
 */
@Injectable()
export class ImportDepartmentsUseCase {
  private readonly logger = new Logger(ImportDepartmentsUseCase.name);

  constructor(
    @Inject(IMPORT_JOB_REPOSITORY)
    private readonly importJobRepository: ImportJobRepository,
    @InjectQueue(QUEUE_NAMES.IMPORT_DEPARTMENTS)
    private readonly importQueue: Queue,
  ) {}

  /**
   * Valida o arquivo, cria o job e enfileira o processamento.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param file Arquivo multipart (nome original + buffer).
   * @returns `{ jobId, status: 'PENDING' }`.
   * @throws {BadRequestException} Extensão inválida, planilha vazia ou colunas
   * obrigatórias/desconhecidas.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    file: { originalname: string; buffer: Buffer },
  ): Promise<ImportDepartmentsResult> {
    const companyId = actor.companyId;

    // 1. Extensão
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.xlsx') {
      throw new BadRequestException(
        'Formato de arquivo inválido. Apenas XLSX é aceito.',
      );
    }

    // 2. Salva em disco temporário (o worker relê depois — ADR 0007 §2)
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'departments-import-'),
    );
    const tempFilePath = path.join(tempDir, file.originalname);
    fs.writeFileSync(tempFilePath, file.buffer);

    try {
      // 3. Parse estrutural (apenas a aba `data`)
      let records: SheetRow[];
      try {
        records = await readSheetAsRows({ buffer: file.buffer });
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        throw new BadRequestException(
          'Erro ao fazer parsing do XLSX. Verifique se o arquivo está no formato correto.',
        );
      }

      if (records.length === 0) {
        throw new BadRequestException('A planilha está vazia.');
      }

      // 4. Colunas obrigatórias
      const headers = Object.keys(records[0]);
      const missingColumns = REQUIRED_COLUMNS.filter(
        (col) => !headers.includes(col),
      );
      if (missingColumns.length > 0) {
        throw new BadRequestException(
          `Colunas obrigatórias ausentes na planilha: ${missingColumns.join(', ')}.`,
        );
      }

      // 5. Colunas desconhecidas
      const unknownColumns = headers.filter(
        (col) => !EXPECTED_COLUMNS.includes(col),
      );
      if (unknownColumns.length > 0) {
        throw new BadRequestException(
          `Colunas desconhecidas na planilha: ${unknownColumns.join(', ')}.`,
        );
      }

      // 6. Cria o job (PENDING)
      const job = await this.importJobRepository.create({
        companyId,
        createdByUserId: actor.id,
        type: ImportJobType.DEPARTMENT,
        fileName: file.originalname,
        totalRows: records.length,
      });

      // 7. Enfileira o processamento assíncrono
      const jobData: ImportDepartmentsJobData = {
        jobId: job.id,
        companyId,
        createdByUserId: actor.id,
        filePath: tempFilePath,
        totalRows: records.length,
      };
      await this.importQueue.add('import', jobData, {
        removeOnComplete: 50,
        removeOnFail: 100,
      });

      return { jobId: job.id, status: 'PENDING' };
    } catch (error) {
      this.cleanupTempFile(tempFilePath);
      throw error;
    }
  }

  /**
   * Remove o diretório temporário do arquivo (chamado em `catch`/`finally`).
   *
   * @param filePath Caminho do arquivo temporário.
   */
  private cleanupTempFile(filePath: string): void {
    try {
      fs.rmSync(path.dirname(filePath), { recursive: true, force: true });
    } catch {
      // silencia erro de cleanup
    }
  }
}

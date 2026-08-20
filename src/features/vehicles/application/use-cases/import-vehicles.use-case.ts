// Node
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

// NestJS
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';
import { QUEUE_NAMES } from '../../../../shared/queue/queue.module';
import { readSheetAsRows } from '../../../../shared/spreadsheet/read-spreadsheet.util';
import type { SheetRow } from '../../../../shared/spreadsheet/read-spreadsheet.util';

// Imports (feature genérica)
import { IMPORT_JOB_REPOSITORY } from '../../../imports/domain/repositories/import-job.repository';
import { ImportJobType } from '../../../imports/domain/constants/import-job.constant';
import type { ImportJobRepository } from '../../../imports/domain/repositories/import-job.repository';

// DTOs
import type { ImportVehiclesJobData } from '../dto/import-vehicles-job-data';
import type { ImportVehiclesResult } from '../dto/import-vehicles-result';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';

/**
 * Colunas obrigatórias na planilha de veículos (aba `data`).
 */
const REQUIRED_COLUMNS = ['plate', 'vehicleType'];

/**
 * Colunas aceitas na planilha de veículos (obrigatórias + opcionais).
 */
const EXPECTED_COLUMNS = [
  'plate',
  'vehicleType',
  'model',
  'color',
  'observation',
  'freePass',
  'department',
];

/**
 * Use case de upload de importação de veículos (ADR 0007 §5/§6/§8).
 *
 * Valida a estrutura do XLSX (extensão, aba `data`, vazio, colunas), exige
 * `GRANT_FREE_PASS` quando a planilha concede livre acesso, salva o arquivo em
 * diretório temporário, cria o job `PENDING` e enfileira — o trabalho pesado
 * fica no `ImportVehiclesProcessor`.
 */
@Injectable()
export class ImportVehiclesUseCase {
  private readonly logger = new Logger(ImportVehiclesUseCase.name);

  constructor(
    @Inject(IMPORT_JOB_REPOSITORY)
    private readonly importJobRepository: ImportJobRepository,
    @InjectQueue(QUEUE_NAMES.IMPORT_VEHICLES)
    private readonly importQueue: Queue,
  ) {}

  /**
   * Valida o arquivo, cria o job e enfileira o processamento.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param file Arquivo multipart (nome original + buffer).
   * @returns `{ jobId, status: 'PENDING' }`.
   * @throws {BadRequestException} Extensão inválida, planilha vazia ou colunas
   * inválidas.
   * @throws {ForbiddenException} `freePass = true` sem `GRANT_FREE_PASS`.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    file: { originalname: string; buffer: Buffer },
  ): Promise<ImportVehiclesResult> {
    const companyId = actor.companyId;

    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.xlsx') {
      throw new BadRequestException(
        'Formato de arquivo inválido. Apenas XLSX é aceito.',
      );
    }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vehicles-import-'));
    const tempFilePath = path.join(tempDir, file.originalname);
    fs.writeFileSync(tempFilePath, file.buffer);

    try {
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

      const headers = Object.keys(records[0]);
      const missingColumns = REQUIRED_COLUMNS.filter(
        (col) => !headers.includes(col),
      );
      if (missingColumns.length > 0) {
        throw new BadRequestException(
          `Colunas obrigatórias ausentes na planilha: ${missingColumns.join(', ')}.`,
        );
      }

      const unknownColumns = headers.filter(
        (col) => !EXPECTED_COLUMNS.includes(col),
      );
      if (unknownColumns.length > 0) {
        throw new BadRequestException(
          `Colunas desconhecidas na planilha: ${unknownColumns.join(', ')}.`,
        );
      }

      // Concessão de livre acesso na planilha exige GRANT_FREE_PASS (ADR 0006 §4)
      const grantsFreePass = records.some(
        (record) => (record.freePass ?? '').trim().toLowerCase() === 'true',
      );
      this.ensureFreePassAllowed(actor, grantsFreePass);

      const job = await this.importJobRepository.create({
        companyId,
        createdByUserId: actor.id,
        type: ImportJobType.VEHICLE,
        fileName: file.originalname,
        totalRows: records.length,
      });

      const jobData: ImportVehiclesJobData = {
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
   * Valida a concessão de livre acesso na importação: `freePass = true` em
   * qualquer linha exige `GRANT_FREE_PASS` (ou `is_admin` — ADR 0004 §2).
   *
   * @param actor Ator autenticado.
   * @param grantsFreePass Se a planilha concede livre acesso.
   * @throws {ForbiddenException} Concessão sem a permissão específica.
   */
  private ensureFreePassAllowed(
    actor: AuthenticatedUserEntity,
    grantsFreePass: boolean,
  ): void {
    if (
      grantsFreePass &&
      !actor.isAdmin &&
      !actor.permissions.includes(PermissionCode.GRANT_FREE_PASS)
    ) {
      throw new ForbiddenException(
        'Conceder livre acesso exige permissão específica.',
      );
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

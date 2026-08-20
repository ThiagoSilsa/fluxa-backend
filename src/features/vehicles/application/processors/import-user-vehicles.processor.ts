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
import { normalizeEmail } from '../../../../shared/utils/email.util';
import { normalizePlate } from '../../../../shared/utils/plate.util';

// Auth (repositório do vínculo pessoa ↔ empresa)
import { USER_COMPANY_REPOSITORY } from '../../../auth/domain/repositories/user-company.repository';
import type { UserCompanyRepository } from '../../../auth/domain/repositories/user-company.repository';

// Vehicles
import { USER_VEHICLE_REPOSITORY } from '../../domain/repositories/user-vehicle.repository';
import { VEHICLE_REPOSITORY } from '../../domain/repositories/vehicle.repository';
import type { AssignDriverRepositoryData } from '../../domain/repositories/user-vehicle.repository';
import type { UserVehicleRepository } from '../../domain/repositories/user-vehicle.repository';
import type { VehicleRepository } from '../../domain/repositories/vehicle.repository';

// Imports (feature genérica)
import { IMPORT_JOB_REPOSITORY } from '../../../imports/domain/repositories/import-job.repository';
import { ImportJobStatus } from '../../../imports/domain/constants/import-job.constant';
import type { ImportJobRepository } from '../../../imports/domain/repositories/import-job.repository';

// DTOs
import type { ImportUserVehiclesJobData } from '../dto/import-user-vehicles-job-data';

/**
 * Worker de importação de vínculo usuário-veículo (ADR 0007 §2/§5/§8).
 *
 * Consome a fila `import-user-vehicles` com `concurrency: 1`, lê o arquivo do
 * disco, valida linha a linha (fail-fast: veículo por placa, usuário por
 * e-mail com vínculo ativo, vínculo duplicado, 1 primário por veículo) e
 * insere em lote (chunks de 500). `isPrimary = true` desmarca o primário
 * anterior do veículo na mesma transação (ADR 0006 §9).
 */
@Processor(QUEUE_NAMES.IMPORT_USER_VEHICLES, { concurrency: 1 })
@Injectable()
export class ImportUserVehiclesProcessor extends WorkerHost {
  private readonly logger = new Logger(ImportUserVehiclesProcessor.name);

  /** Tamanho do lote de inserção (ADR 0007 §8). */
  private readonly CHUNK_SIZE = 500;

  constructor(
    @Inject(IMPORT_JOB_REPOSITORY)
    private readonly importJobRepository: ImportJobRepository,
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: VehicleRepository,
    @Inject(USER_COMPANY_REPOSITORY)
    private readonly userCompanyRepository: UserCompanyRepository,
    @Inject(USER_VEHICLE_REPOSITORY)
    private readonly userVehicleRepository: UserVehicleRepository,
  ) {
    super();
  }

  /**
   * Processa um job de importação de vínculo usuário-veículo.
   *
   * @param job Job enfileirado (jobId, companyId, filePath, ...).
   */
  public async process(job: Job<ImportUserVehiclesJobData>): Promise<void> {
    const { jobId, companyId, filePath } = job.data;

    try {
      await this.importJobRepository.updateStatus(
        jobId,
        ImportJobStatus.PROCESSING,
        { startedAt: new Date() },
      );

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

      const inputs = await this.buildCreateInputs(records, companyId);

      let inserted = 0;
      for (let i = 0; i < inputs.length; i += this.CHUNK_SIZE) {
        const chunk = inputs.slice(i, i + this.CHUNK_SIZE);
        const created = await this.userVehicleRepository.createBatch(chunk);
        inserted += created.length;
      }

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
   * Valida todas as linhas (fail-fast) e prepara os inputs de criação.
   *
   * Regras por linha (ADR 0007 §8): veículo pela placa deve existir na
   * empresa; usuário pelo e-mail deve existir com vínculo `user_company`
   * **ativo**; vínculo duplicado (no banco ou no arquivo) → erro;
   * `isPrimary`/`canDrive` `true`/`false`; no máximo **1 primário por
   * veículo** dentro do arquivo (o primário anterior do banco é substituído
   * pelo `createBatch` — ADR 0006 §9).
   *
   * @param records Linhas da planilha (cabeçalho → texto).
   * @param companyId Empresa da sessão.
   * @returns Inputs de criação prontos para `createBatch`.
   * @throws {BadRequestException} Na primeira linha inválida (`Linha N: ...`).
   */
  private async buildCreateInputs(
    records: SheetRow[],
    companyId: string,
  ): Promise<AssignDriverRepositoryData[]> {
    const plates = records
      .map((record) => normalizePlate(record.vehiclePlate ?? ''))
      .filter((plate) => plate !== '');
    const vehicles = await this.vehicleRepository.findByPlatesAndCompanyId(
      plates,
      companyId,
    );
    const vehicleIdByPlate = new Map(
      vehicles.map((vehicle) => [vehicle.plate, vehicle.id]),
    );

    const emails = records
      .map((record) => normalizeEmail(record.userEmail ?? ''))
      .filter((email) => email !== '');
    const users = await Promise.all(
      emails.map((email) =>
        this.userCompanyRepository.findByEmailAndCompanyId(email, companyId),
      ),
    );
    const userIdByEmail = new Map<string, string>();
    for (const user of users) {
      if (user) {
        userIdByEmail.set(user.email, user.userId);
      }
    }

    const existingLinks =
      await this.userVehicleRepository.findByVehicleIdsAndCompanyId(
        [...new Set(vehicleIdByPlate.values())],
        companyId,
      );
    const existingPairs = new Set(
      existingLinks.map((link) => `${link.vehicleId}:${link.userId}`),
    );

    const seenPairs = new Set<string>();
    const primaryVehicleIds = new Set<string>();
    const inputs: AssignDriverRepositoryData[] = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const lineNumber = i + 2; // linha 1 é o cabeçalho

      const plate = normalizePlate(record.vehiclePlate ?? '');
      const vehicleId = vehicleIdByPlate.get(plate);
      if (!vehicleId) {
        throw new BadRequestException(
          `Linha ${lineNumber}: veículo não encontrado para a placa "${plate}".`,
        );
      }

      const email = normalizeEmail(record.userEmail ?? '');
      const userId = userIdByEmail.get(email);
      if (!userId) {
        throw new BadRequestException(
          `Linha ${lineNumber}: usuário "${email}" não encontrado ou sem vínculo ativo.`,
        );
      }

      const pair = `${vehicleId}:${userId}`;
      if (existingPairs.has(pair) || seenPairs.has(pair)) {
        throw new BadRequestException(
          `Linha ${lineNumber}: vínculo já existe.`,
        );
      }
      seenPairs.add(pair);

      const isPrimaryRaw = (record.isPrimary ?? '').trim().toLowerCase();
      let isPrimary = false;
      if (isPrimaryRaw === 'true') {
        isPrimary = true;
      } else if (isPrimaryRaw === 'false' || isPrimaryRaw === '') {
        isPrimary = false;
      } else {
        throw new BadRequestException(
          `Linha ${lineNumber}: isPrimary deve ser "true" ou "false".`,
        );
      }

      if (isPrimary) {
        if (primaryVehicleIds.has(vehicleId)) {
          throw new BadRequestException(
            `Linha ${lineNumber}: apenas um proprietário primário por veículo.`,
          );
        }
        primaryVehicleIds.add(vehicleId);
      }

      const canDriveRaw = (record.canDrive ?? '').trim().toLowerCase();
      let canDrive = true;
      if (canDriveRaw === 'true') {
        canDrive = true;
      } else if (canDriveRaw === 'false' || canDriveRaw === '') {
        canDrive = false;
      } else {
        throw new BadRequestException(
          `Linha ${lineNumber}: canDrive deve ser "true" ou "false".`,
        );
      }

      inputs.push({
        companyId,
        userId,
        vehicleId,
        isPrimary,
        canDrive,
      });
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

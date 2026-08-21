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
import {
  isValidBrazilianPlate,
  normalizePlate,
} from '../../../../shared/utils/plate.util';

// Departments (repositório exportado pelo módulo)
import { DEPARTMENT_REPOSITORY } from '../../../departments/domain/repositories/department.repository';
import type { DepartmentRepository } from '../../../departments/domain/repositories/department.repository';

// Vehicles
import { VEHICLE_DEPARTMENT_REPOSITORY } from '../../domain/repositories/vehicle-department.repository';
import { VEHICLE_REPOSITORY } from '../../domain/repositories/vehicle.repository';
import { VEHICLE_TYPE_REPOSITORY } from '../../domain/repositories/vehicle-type.repository';
import type { CreateVehicleRepositoryData } from '../../domain/repositories/vehicle.repository';
import type { VehicleRepository } from '../../domain/repositories/vehicle.repository';
import type { VehicleTypeRepository } from '../../domain/repositories/vehicle-type.repository';
import type { VehicleDepartmentRepository } from '../../domain/repositories/vehicle-department.repository';

// Imports (feature genérica)
import { IMPORT_JOB_REPOSITORY } from '../../../imports/domain/repositories/import-job.repository';
import { ImportJobStatus } from '../../../imports/domain/constants/import-job.constant';
import type { ImportJobRepository } from '../../../imports/domain/repositories/import-job.repository';

// DTOs
import type { ImportVehiclesJobData } from '../dto/import-vehicles-job-data';

/**
 * Worker de importação de veículos (ADR 0007 §2/§5/§8).
 *
 * Consome a fila `import-vehicles` com `concurrency: 1`, lê o arquivo do
 * disco, valida linha a linha (fail-fast: placa, tipo por código, livre
 * acesso, departamento padrão opcional) e insere em lote (chunks de 500).
 * Veículos com departamento informado recebem o departamento padrão
 * (`vehicle_department`). Atualiza o job: `PROCESSING` → `DONE`/`FAILED`.
 */
@Processor(QUEUE_NAMES.IMPORT_VEHICLES, { concurrency: 1 })
@Injectable()
export class ImportVehiclesProcessor extends WorkerHost {
  private readonly logger = new Logger(ImportVehiclesProcessor.name);

  /** Tamanho do lote de inserção (ADR 0007 §8). */
  private readonly CHUNK_SIZE = 500;

  constructor(
    @Inject(IMPORT_JOB_REPOSITORY)
    private readonly importJobRepository: ImportJobRepository,
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: VehicleRepository,
    @Inject(VEHICLE_TYPE_REPOSITORY)
    private readonly vehicleTypeRepository: VehicleTypeRepository,
    @Inject(VEHICLE_DEPARTMENT_REPOSITORY)
    private readonly vehicleDepartmentRepository: VehicleDepartmentRepository,
    @Inject(DEPARTMENT_REPOSITORY)
    private readonly departmentRepository: DepartmentRepository,
  ) {
    super();
  }

  /**
   * Processa um job de importação de veículos.
   *
   * @param job Job enfileirado (jobId, companyId, filePath, ...).
   */
  public async process(job: Job<ImportVehiclesJobData>): Promise<void> {
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

      // Resolve referências em lote (tipos por código, placas existentes,
      // departamentos por nome) e valida linha a linha (fail-fast).
      const prepared = await this.buildCreateInputs(records, companyId);

      // Insere veículos em lote (chunks de 500)
      let inserted = 0;
      for (let i = 0; i < prepared.inputs.length; i += this.CHUNK_SIZE) {
        const chunk = prepared.inputs.slice(i, i + this.CHUNK_SIZE);
        const created = await this.vehicleRepository.createBatch(chunk);
        inserted += created.length;
      }

      // Define o departamento padrão dos veículos que vieram com a coluna
      // `department` preenchida (upsert na linha única — ADR 0006 §8)
      const createdVehicles =
        await this.vehicleRepository.findByPlatesAndCompanyId(
          prepared.inputs.map((item) => item.plate),
          companyId,
        );
      const vehicleIdByPlate = new Map(
        createdVehicles.map((vehicle) => [vehicle.plate, vehicle.id]),
      );
      for (const item of prepared.inputs) {
        const vehicleId = vehicleIdByPlate.get(item.plate);
        const departmentId = prepared.departmentIdByPlate.get(item.plate);
        if (vehicleId && departmentId) {
          await this.vehicleDepartmentRepository.upsertByVehicleIdAndCompanyId(
            vehicleId,
            companyId,
            departmentId,
          );
        }
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
   * Regras por linha (ADR 0007 §8): placa normalizada + formato BR (sem
   * duplicado na empresa nem no arquivo); `vehicleType` (código) existente e
   * ativo na empresa; `model`/`color`/`observation` opcionais; `freePass`
   * `true`/`false`; `department` (nome) existente na empresa quando
   * preenchido.
   *
   * @param records Linhas da planilha (cabeçalho → texto).
   * @param companyId Empresa da sessão.
   * @returns Inputs de criação + mapa placa → departmentId.
   * @throws {BadRequestException} Na primeira linha inválida (`Linha N: ...`).
   */
  private async buildCreateInputs(
    records: SheetRow[],
    companyId: string,
  ): Promise<{
    inputs: CreateVehicleRepositoryData[];
    departmentIdByPlate: Map<string, string>;
  }> {
    const typeCodes = [
      ...new Set(
        records
          .map((record) => (record.vehicleType ?? '').trim().toUpperCase())
          .filter((code) => code !== ''),
      ),
    ];
    const types = await this.vehicleTypeRepository.findByCodesAndCompanyId(
      typeCodes,
      companyId,
    );
    const typeByCode = new Map(types.map((type) => [type.code, type]));

    const plates = records
      .map((record) => normalizePlate(record.plate ?? ''))
      .filter((plate) => plate !== '');
    const existingVehicles =
      await this.vehicleRepository.findByPlatesAndCompanyId(plates, companyId);
    const existingPlates = new Set(
      existingVehicles.map((vehicle) => vehicle.plate),
    );

    const departmentNames = [
      ...new Set(
        records
          .map((record) => (record.department ?? '').trim())
          .filter((name) => name !== ''),
      ),
    ];
    const departments = await this.departmentRepository.findByNamesAndCompanyId(
      departmentNames,
      companyId,
    );
    const departmentIdByName = new Map(
      departments.map((department) => [department.name, department.id]),
    );

    const seenPlates = new Set<string>();
    const inputs: CreateVehicleRepositoryData[] = [];
    const departmentIdByPlate = new Map<string, string>();

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const lineNumber = i + 2; // linha 1 é o cabeçalho

      const plate = normalizePlate(record.plate ?? '');
      if (!isValidBrazilianPlate(plate)) {
        throw new BadRequestException(
          `Linha ${lineNumber}: placa em formato inválido.`,
        );
      }
      if (existingPlates.has(plate) || seenPlates.has(plate)) {
        throw new BadRequestException(
          `Linha ${lineNumber}: placa "${plate}" já cadastrada.`,
        );
      }
      seenPlates.add(plate);

      const typeCode = (record.vehicleType ?? '').trim().toUpperCase();
      const type = typeByCode.get(typeCode);
      if (!type) {
        throw new BadRequestException(
          `Linha ${lineNumber}: tipo de veículo "${typeCode}" não encontrado.`,
        );
      }
      if (!type.isActive) {
        throw new BadRequestException(
          `Linha ${lineNumber}: tipo de veículo "${typeCode}" inativo.`,
        );
      }

      const freePassRaw = (record.freePass ?? '').trim().toLowerCase();
      let freePass = false;
      if (freePassRaw === 'true') {
        freePass = true;
      } else if (freePassRaw === 'false' || freePassRaw === '') {
        freePass = false;
      } else {
        throw new BadRequestException(
          `Linha ${lineNumber}: freePass deve ser "true" ou "false".`,
        );
      }

      const departmentName = (record.department ?? '').trim();
      if (departmentName !== '' && !departmentIdByName.has(departmentName)) {
        throw new BadRequestException(
          `Linha ${lineNumber}: departamento "${departmentName}" não encontrado.`,
        );
      }
      if (departmentName !== '') {
        departmentIdByPlate.set(plate, departmentIdByName.get(departmentName)!);
      }

      inputs.push({
        plate,
        companyId,
        model: (record.model ?? '').trim() || null,
        color: (record.color ?? '').trim() || null,
        observation: (record.observation ?? '').trim() || null,
        freePass,
        vehicleTypeId: type.id,
      });
    }

    return { inputs, departmentIdByPlate };
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

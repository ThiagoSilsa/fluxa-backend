// Node
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

// NestJS
import { Test } from '@nestjs/testing';
import { Job } from 'bullmq';

// Shared
import { DATA_SHEET } from '../../../../shared/spreadsheet/read-spreadsheet.util';

// Fixtures
import { writeXlsxFile } from '../../../../test/support/xlsx-fixture';

// Departments
import { DEPARTMENT_REPOSITORY } from '../../../departments/domain/repositories/department.repository';
import type { DepartmentRepository } from '../../../departments/domain/repositories/department.repository';

// Vehicles
import { VEHICLE_DEPARTMENT_REPOSITORY } from '../../domain/repositories/vehicle-department.repository';
import { VEHICLE_REPOSITORY } from '../../domain/repositories/vehicle.repository';
import { VEHICLE_TYPE_REPOSITORY } from '../../domain/repositories/vehicle-type.repository';
import type { VehicleDepartmentRepository } from '../../domain/repositories/vehicle-department.repository';
import type { VehicleRepository } from '../../domain/repositories/vehicle.repository';
import type { VehicleTypeRepository } from '../../domain/repositories/vehicle-type.repository';

// Imports
import { IMPORT_JOB_REPOSITORY } from '../../../imports/domain/repositories/import-job.repository';
import { ImportJobStatus } from '../../../imports/domain/constants/import-job.constant';
import type { ImportJobRepository } from '../../../imports/domain/repositories/import-job.repository';

// DTOs
import type { ImportVehiclesJobData } from '../../application/dto/import-vehicles-job-data';

// Processor
import { ImportVehiclesProcessor } from '../../application/processors/import-vehicles.processor';

describe('ImportVehiclesProcessor', () => {
  let processor: ImportVehiclesProcessor;
  let tempDir: string;

  const importJobRepoMock = {
    updateStatus: jest.fn(),
  } as jest.Mocked<Pick<ImportJobRepository, 'updateStatus'>>;

  const vehicleRepoMock = {
    findByPlatesAndCompanyId: jest.fn(),
    createBatch: jest.fn(),
  } as jest.Mocked<
    Pick<VehicleRepository, 'findByPlatesAndCompanyId' | 'createBatch'>
  >;

  const vehicleTypeRepoMock = {
    findByCodesAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<VehicleTypeRepository, 'findByCodesAndCompanyId'>>;

  const vehicleDepartmentRepoMock = {
    upsertByVehicleIdAndCompanyId: jest.fn(),
  } as jest.Mocked<
    Pick<VehicleDepartmentRepository, 'upsertByVehicleIdAndCompanyId'>
  >;

  const departmentRepoMock = {
    findByNamesAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<DepartmentRepository, 'findByNamesAndCompanyId'>>;

  const companyId = '10000000-0000-0000-0000-000000000001';
  const jobId = '50000000-0000-0000-0000-000000000001';

  const frotaType = {
    id: '40000000-0000-0000-0000-000000000001',
    companyId,
    code: 'FROTA',
    name: 'Frota',
    description: null,
    isFleet: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  async function buildJob(
    rows: unknown[][],
  ): Promise<Job<ImportVehiclesJobData>> {
    const filePath = path.join(tempDir, 'veiculos.xlsx');
    await writeXlsxFile(filePath, DATA_SHEET, rows);
    return {
      data: {
        jobId,
        companyId,
        createdByUserId: '30000000-0000-0000-0000-000000000001',
        filePath,
        totalRows: rows.length - 1,
      },
    } as Job<ImportVehiclesJobData>;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'import-vehicles-spec-'));

    const module = await Test.createTestingModule({
      providers: [
        ImportVehiclesProcessor,
        { provide: IMPORT_JOB_REPOSITORY, useValue: importJobRepoMock },
        { provide: VEHICLE_REPOSITORY, useValue: vehicleRepoMock },
        { provide: VEHICLE_TYPE_REPOSITORY, useValue: vehicleTypeRepoMock },
        {
          provide: VEHICLE_DEPARTMENT_REPOSITORY,
          useValue: vehicleDepartmentRepoMock,
        },
        { provide: DEPARTMENT_REPOSITORY, useValue: departmentRepoMock },
      ],
    }).compile();

    processor = module.get(ImportVehiclesProcessor);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('processa com sucesso: insere veículos e define departamento padrão', async () => {
    const job = await buildJob([
      ['plate', 'vehicleType', 'model', 'freePass', 'department'],
      ['ABC1234', 'FROTA', 'Gol', '', 'Recepção'],
      ['ABC1D23', 'FROTA', '', 'false', ''],
    ]);
    vehicleTypeRepoMock.findByCodesAndCompanyId.mockResolvedValue([frotaType]);
    vehicleRepoMock.findByPlatesAndCompanyId
      .mockResolvedValueOnce([]) // checagem de duplicados
      .mockResolvedValueOnce([
        {
          id: '60000000-0000-0000-0000-000000000001',
          plate: 'ABC1234',
          companyId,
          model: 'Gol',
          color: null,
          observation: null,
          isBlocked: false,
          freePass: false,
          vehicleTypeId: frotaType.id,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '60000000-0000-0000-0000-000000000002',
          plate: 'ABC1D23',
          companyId,
          model: null,
          color: null,
          observation: null,
          isBlocked: false,
          freePass: false,
          vehicleTypeId: frotaType.id,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]); // resolução de ids p/ departamento
    vehicleRepoMock.createBatch.mockResolvedValue([]);
    departmentRepoMock.findByNamesAndCompanyId.mockResolvedValue([
      {
        id: '40000000-0000-0000-0000-000000000099',
        companyId,
        name: 'Recepção',
        description: null,
        parkingSpace: 10,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await processor.process(job);

    expect(vehicleRepoMock.createBatch).toHaveBeenCalledWith([
      {
        plate: 'ABC1234',
        companyId,
        model: 'Gol',
        color: null,
        observation: null,
        freePass: false,
        vehicleTypeId: frotaType.id,
      },
      {
        plate: 'ABC1D23',
        companyId,
        model: null,
        color: null,
        observation: null,
        freePass: false,
        vehicleTypeId: frotaType.id,
      },
    ]);
    expect(
      vehicleDepartmentRepoMock.upsertByVehicleIdAndCompanyId,
    ).toHaveBeenCalledWith(
      '60000000-0000-0000-0000-000000000001',
      companyId,
      '40000000-0000-0000-0000-000000000099',
    );
    expect(importJobRepoMock.updateStatus).toHaveBeenNthCalledWith(
      2,
      jobId,
      ImportJobStatus.DONE,
      expect.objectContaining({
        processedRows: 2,
        successCount: 0,
        errorCount: 0,
        completedAt: expect.any(Date),
      }),
    );
  });

  it('falha (FAILED) com placa em formato inválido', async () => {
    const job = await buildJob([
      ['plate', 'vehicleType'],
      ['INVALIDA', 'FROTA'],
    ]);
    vehicleTypeRepoMock.findByCodesAndCompanyId.mockResolvedValue([frotaType]);
    vehicleRepoMock.findByPlatesAndCompanyId.mockResolvedValue([]);
    departmentRepoMock.findByNamesAndCompanyId.mockResolvedValue([]);

    await expect(processor.process(job)).rejects.toBeTruthy();

    expect(importJobRepoMock.updateStatus).toHaveBeenNthCalledWith(
      2,
      jobId,
      ImportJobStatus.FAILED,
      expect.objectContaining({
        errorMessage: 'Linha 2: placa em formato inválido.',
      }),
    );
    expect(vehicleRepoMock.createBatch).not.toHaveBeenCalled();
  });

  it('falha (FAILED) com placa duplicada no arquivo', async () => {
    const job = await buildJob([
      ['plate', 'vehicleType'],
      ['ABC1234', 'FROTA'],
      ['ABC1234', 'FROTA'],
    ]);
    vehicleTypeRepoMock.findByCodesAndCompanyId.mockResolvedValue([frotaType]);
    vehicleRepoMock.findByPlatesAndCompanyId.mockResolvedValue([]);
    departmentRepoMock.findByNamesAndCompanyId.mockResolvedValue([]);

    await expect(processor.process(job)).rejects.toBeTruthy();

    expect(importJobRepoMock.updateStatus).toHaveBeenNthCalledWith(
      2,
      jobId,
      ImportJobStatus.FAILED,
      expect.objectContaining({
        errorMessage: 'Linha 3: placa "ABC1234" já cadastrada.',
      }),
    );
  });

  it('falha (FAILED) com tipo de veículo não encontrado', async () => {
    const job = await buildJob([
      ['plate', 'vehicleType'],
      ['ABC1234', 'INEXISTENTE'],
    ]);
    vehicleTypeRepoMock.findByCodesAndCompanyId.mockResolvedValue([]);
    vehicleRepoMock.findByPlatesAndCompanyId.mockResolvedValue([]);
    departmentRepoMock.findByNamesAndCompanyId.mockResolvedValue([]);

    await expect(processor.process(job)).rejects.toBeTruthy();

    expect(importJobRepoMock.updateStatus).toHaveBeenNthCalledWith(
      2,
      jobId,
      ImportJobStatus.FAILED,
      expect.objectContaining({
        errorMessage: 'Linha 2: tipo de veículo "INEXISTENTE" não encontrado.',
      }),
    );
  });

  it('falha (FAILED) com departamento não encontrado', async () => {
    const job = await buildJob([
      ['plate', 'vehicleType', 'department'],
      ['ABC1234', 'FROTA', 'Inexistente'],
    ]);
    vehicleTypeRepoMock.findByCodesAndCompanyId.mockResolvedValue([frotaType]);
    vehicleRepoMock.findByPlatesAndCompanyId.mockResolvedValue([]);
    departmentRepoMock.findByNamesAndCompanyId.mockResolvedValue([]);

    await expect(processor.process(job)).rejects.toBeTruthy();

    expect(importJobRepoMock.updateStatus).toHaveBeenNthCalledWith(
      2,
      jobId,
      ImportJobStatus.FAILED,
      expect.objectContaining({
        errorMessage: 'Linha 2: departamento "Inexistente" não encontrado.',
      }),
    );
  });
});

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

// Auth
import { UserType } from '../../../auth/domain/constants/user-type.constant';
import { USER_COMPANY_REPOSITORY } from '../../../auth/domain/repositories/user-company.repository';
import type { UserCompanyRepository } from '../../../auth/domain/repositories/user-company.repository';

// Vehicles
import { USER_VEHICLE_REPOSITORY } from '../../domain/repositories/user-vehicle.repository';
import { VEHICLE_REPOSITORY } from '../../domain/repositories/vehicle.repository';
import type { UserVehicleRepository } from '../../domain/repositories/user-vehicle.repository';
import type { VehicleRepository } from '../../domain/repositories/vehicle.repository';

// Imports
import { IMPORT_JOB_REPOSITORY } from '../../../imports/domain/repositories/import-job.repository';
import { ImportJobStatus } from '../../../imports/domain/constants/import-job.constant';
import type { ImportJobRepository } from '../../../imports/domain/repositories/import-job.repository';

// DTOs
import type { ImportUserVehiclesJobData } from '../../application/dto/import-user-vehicles-job-data';

// Processor
import { ImportUserVehiclesProcessor } from '../../application/processors/import-user-vehicles.processor';

describe('ImportUserVehiclesProcessor', () => {
  let processor: ImportUserVehiclesProcessor;
  let tempDir: string;

  const importJobRepoMock = {
    updateStatus: jest.fn(),
  } as jest.Mocked<Pick<ImportJobRepository, 'updateStatus'>>;

  const vehicleRepoMock = {
    findByPlatesAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<VehicleRepository, 'findByPlatesAndCompanyId'>>;

  const userCompanyRepoMock = {
    findByEmailAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<UserCompanyRepository, 'findByEmailAndCompanyId'>>;

  const userVehicleRepoMock = {
    findByVehicleIdsAndCompanyId: jest.fn(),
    createBatch: jest.fn(),
  } as jest.Mocked<
    Pick<UserVehicleRepository, 'findByVehicleIdsAndCompanyId' | 'createBatch'>
  >;

  const companyId = '10000000-0000-0000-0000-000000000001';
  const jobId = '50000000-0000-0000-0000-000000000001';

  async function buildJob(
    rows: unknown[][],
  ): Promise<Job<ImportUserVehiclesJobData>> {
    const filePath = path.join(tempDir, 'vinculos.xlsx');
    await writeXlsxFile(filePath, DATA_SHEET, rows);
    return {
      data: {
        jobId,
        companyId,
        createdByUserId: '30000000-0000-0000-0000-000000000001',
        filePath,
        totalRows: rows.length - 1,
      },
    } as Job<ImportUserVehiclesJobData>;
  }

  function mockResolvedReferences(): void {
    vehicleRepoMock.findByPlatesAndCompanyId.mockResolvedValue([
      {
        id: '60000000-0000-0000-0000-000000000001',
        plate: 'ABC1234',
        companyId,
        model: null,
        color: null,
        observation: null,
        isBlocked: false,
        freePass: false,
        vehicleTypeId: '40000000-0000-0000-0000-000000000001',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    userCompanyRepoMock.findByEmailAndCompanyId.mockResolvedValue({
      linkId: '70000000-0000-0000-0000-000000000001',
      userId: '30000000-0000-0000-0000-000000000007',
      name: 'Motorista',
      email: 'motorista@somar.local',
      phone: null,
      document: null,
      photoUrl: null,
      type: UserType.EMPLOYEE,
      isActive: true,
    });
    userVehicleRepoMock.findByVehicleIdsAndCompanyId.mockResolvedValue([]);
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'import-user-vehicles-spec-'),
    );

    const module = await Test.createTestingModule({
      providers: [
        ImportUserVehiclesProcessor,
        { provide: IMPORT_JOB_REPOSITORY, useValue: importJobRepoMock },
        { provide: VEHICLE_REPOSITORY, useValue: vehicleRepoMock },
        { provide: USER_COMPANY_REPOSITORY, useValue: userCompanyRepoMock },
        { provide: USER_VEHICLE_REPOSITORY, useValue: userVehicleRepoMock },
      ],
    }).compile();

    processor = module.get(ImportUserVehiclesProcessor);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('processa com sucesso: cria os vínculos (primário e condutor)', async () => {
    const job = await buildJob([
      ['vehiclePlate', 'userEmail', 'isPrimary', 'canDrive'],
      ['ABC1234', 'motorista@somar.local', 'true', 'true'],
    ]);
    mockResolvedReferences();
    userVehicleRepoMock.createBatch.mockResolvedValue([]);

    await processor.process(job);

    expect(userVehicleRepoMock.createBatch).toHaveBeenCalledWith([
      {
        companyId,
        userId: '30000000-0000-0000-0000-000000000007',
        vehicleId: '60000000-0000-0000-0000-000000000001',
        isPrimary: true,
        canDrive: true,
      },
    ]);
    expect(importJobRepoMock.updateStatus).toHaveBeenNthCalledWith(
      2,
      jobId,
      ImportJobStatus.DONE,
      expect.objectContaining({
        processedRows: 1,
        successCount: 0,
        errorCount: 0,
        completedAt: expect.any(Date),
      }),
    );
  });

  it('falha (FAILED) com veículo não encontrado pela placa', async () => {
    const job = await buildJob([
      ['vehiclePlate', 'userEmail'],
      ['XYZ9999', 'motorista@somar.local'],
    ]);
    vehicleRepoMock.findByPlatesAndCompanyId.mockResolvedValue([]);
    userCompanyRepoMock.findByEmailAndCompanyId.mockResolvedValue(null);
    userVehicleRepoMock.findByVehicleIdsAndCompanyId.mockResolvedValue([]);

    await expect(processor.process(job)).rejects.toBeTruthy();

    expect(importJobRepoMock.updateStatus).toHaveBeenNthCalledWith(
      2,
      jobId,
      ImportJobStatus.FAILED,
      expect.objectContaining({
        errorMessage: 'Linha 2: veículo não encontrado para a placa "XYZ9999".',
      }),
    );
    expect(userVehicleRepoMock.createBatch).not.toHaveBeenCalled();
  });

  it('falha (FAILED) com usuário sem vínculo ativo', async () => {
    const job = await buildJob([
      ['vehiclePlate', 'userEmail'],
      ['ABC1234', 'desconhecido@somar.local'],
    ]);
    vehicleRepoMock.findByPlatesAndCompanyId.mockResolvedValue([
      {
        id: '60000000-0000-0000-0000-000000000001',
        plate: 'ABC1234',
        companyId,
        model: null,
        color: null,
        observation: null,
        isBlocked: false,
        freePass: false,
        vehicleTypeId: '40000000-0000-0000-0000-000000000001',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    userCompanyRepoMock.findByEmailAndCompanyId.mockResolvedValue(null);
    userVehicleRepoMock.findByVehicleIdsAndCompanyId.mockResolvedValue([]);

    await expect(processor.process(job)).rejects.toBeTruthy();

    expect(importJobRepoMock.updateStatus).toHaveBeenNthCalledWith(
      2,
      jobId,
      ImportJobStatus.FAILED,
      expect.objectContaining({
        errorMessage:
          'Linha 2: usuário "desconhecido@somar.local" não encontrado ou sem vínculo ativo.',
      }),
    );
  });

  it('falha (FAILED) com vínculo já existente', async () => {
    const job = await buildJob([
      ['vehiclePlate', 'userEmail'],
      ['ABC1234', 'motorista@somar.local'],
    ]);
    mockResolvedReferences();
    userVehicleRepoMock.findByVehicleIdsAndCompanyId.mockResolvedValue([
      {
        id: '80000000-0000-0000-0000-000000000001',
        companyId,
        userId: '30000000-0000-0000-0000-000000000007',
        vehicleId: '60000000-0000-0000-0000-000000000001',
        isPrimary: false,
        canDrive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await expect(processor.process(job)).rejects.toBeTruthy();

    expect(importJobRepoMock.updateStatus).toHaveBeenNthCalledWith(
      2,
      jobId,
      ImportJobStatus.FAILED,
      expect.objectContaining({
        errorMessage: 'Linha 2: vínculo já existe.',
      }),
    );
  });

  it('falha (FAILED) com dois primários para o mesmo veículo', async () => {
    const job = await buildJob([
      ['vehiclePlate', 'userEmail', 'isPrimary'],
      ['ABC1234', 'a@somar.local', 'true'],
      ['ABC1234', 'b@somar.local', 'true'],
    ]);
    vehicleRepoMock.findByPlatesAndCompanyId.mockResolvedValue([
      {
        id: '60000000-0000-0000-0000-000000000001',
        plate: 'ABC1234',
        companyId,
        model: null,
        color: null,
        observation: null,
        isBlocked: false,
        freePass: false,
        vehicleTypeId: '40000000-0000-0000-0000-000000000001',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    userCompanyRepoMock.findByEmailAndCompanyId
      .mockResolvedValueOnce({
        linkId: '70000000-0000-0000-0000-000000000001',
        userId: '30000000-0000-0000-0000-000000000007',
        name: 'A',
        email: 'a@somar.local',
        phone: null,
        document: null,
        photoUrl: null,
        type: UserType.EMPLOYEE,
        isActive: true,
      })
      .mockResolvedValueOnce({
        linkId: '70000000-0000-0000-0000-000000000002',
        userId: '30000000-0000-0000-0000-000000000008',
        name: 'B',
        email: 'b@somar.local',
        phone: null,
        document: null,
        photoUrl: null,
        type: UserType.EMPLOYEE,
        isActive: true,
      });
    userVehicleRepoMock.findByVehicleIdsAndCompanyId.mockResolvedValue([]);

    await expect(processor.process(job)).rejects.toBeTruthy();

    expect(importJobRepoMock.updateStatus).toHaveBeenNthCalledWith(
      2,
      jobId,
      ImportJobStatus.FAILED,
      expect.objectContaining({
        errorMessage: 'Linha 3: apenas um proprietário primário por veículo.',
      }),
    );
  });

  it('falha (FAILED) com isPrimary inválido', async () => {
    const job = await buildJob([
      ['vehiclePlate', 'userEmail', 'isPrimary'],
      ['ABC1234', 'motorista@somar.local', 'talvez'],
    ]);
    mockResolvedReferences();

    await expect(processor.process(job)).rejects.toBeTruthy();

    expect(importJobRepoMock.updateStatus).toHaveBeenNthCalledWith(
      2,
      jobId,
      ImportJobStatus.FAILED,
      expect.objectContaining({
        errorMessage: 'Linha 2: isPrimary deve ser "true" ou "false".',
      }),
    );
  });
});

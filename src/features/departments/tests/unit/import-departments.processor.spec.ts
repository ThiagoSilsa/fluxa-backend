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
import { DEPARTMENT_REPOSITORY } from '../../domain/repositories/department.repository';
import type { DepartmentRepository } from '../../domain/repositories/department.repository';

// Imports
import { IMPORT_JOB_REPOSITORY } from '../../../imports/domain/repositories/import-job.repository';
import { ImportJobStatus } from '../../../imports/domain/constants/import-job.constant';
import type { ImportJobRepository } from '../../../imports/domain/repositories/import-job.repository';

// DTOs
import type { ImportDepartmentsJobData } from '../../application/dto/import-departments-job-data';

// Processor
import { ImportDepartmentsProcessor } from '../../application/processors/import-departments.processor';

describe('ImportDepartmentsProcessor', () => {
  let processor: ImportDepartmentsProcessor;
  let tempDir: string;

  const importJobRepoMock = {
    updateStatus: jest.fn(),
  } as jest.Mocked<Pick<ImportJobRepository, 'updateStatus'>>;

  const departmentRepoMock = {
    findByNamesAndCompanyId: jest.fn(),
    createBatch: jest.fn(),
  } as jest.Mocked<
    Pick<DepartmentRepository, 'findByNamesAndCompanyId' | 'createBatch'>
  >;

  const companyId = '10000000-0000-0000-0000-000000000001';
  const jobId = '50000000-0000-0000-0000-000000000001';

  async function buildJob(
    rows: unknown[][],
  ): Promise<Job<ImportDepartmentsJobData>> {
    const filePath = path.join(tempDir, 'departamentos.xlsx');
    await writeXlsxFile(filePath, DATA_SHEET, rows);
    return {
      data: {
        jobId,
        companyId,
        createdByUserId: '30000000-0000-0000-0000-000000000001',
        filePath,
        totalRows: rows.length - 1,
      },
    } as Job<ImportDepartmentsJobData>;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'import-departments-spec-'),
    );

    const module = await Test.createTestingModule({
      providers: [
        ImportDepartmentsProcessor,
        { provide: IMPORT_JOB_REPOSITORY, useValue: importJobRepoMock },
        { provide: DEPARTMENT_REPOSITORY, useValue: departmentRepoMock },
      ],
    }).compile();

    processor = module.get(ImportDepartmentsProcessor);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('processa com sucesso: PROCESSING → DONE com contadores e createBatch', async () => {
    const job = await buildJob([
      ['name', 'parkingSpace', 'description'],
      ['Recepção', 10, 'Portaria principal'],
      ['Segurança', 5, ''],
    ]);
    departmentRepoMock.findByNamesAndCompanyId.mockResolvedValue([]);
    departmentRepoMock.createBatch.mockResolvedValue([
      {
        id: '40000000-0000-0000-0000-000000000010',
        companyId,
        name: 'Recepção',
        description: 'Portaria principal',
        parkingSpace: 10,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '40000000-0000-0000-0000-000000000011',
        companyId,
        name: 'Segurança',
        description: null,
        parkingSpace: 5,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await processor.process(job);

    expect(importJobRepoMock.updateStatus).toHaveBeenNthCalledWith(
      1,
      jobId,
      ImportJobStatus.PROCESSING,
      expect.objectContaining({ startedAt: expect.any(Date) }),
    );
    expect(departmentRepoMock.findByNamesAndCompanyId).toHaveBeenCalledWith(
      ['Recepção', 'Segurança'],
      companyId,
    );
    expect(departmentRepoMock.createBatch).toHaveBeenCalledWith([
      {
        companyId,
        name: 'Recepção',
        description: 'Portaria principal',
        parkingSpace: 10,
      },
      { companyId, name: 'Segurança', description: null, parkingSpace: 5 },
    ]);
    expect(importJobRepoMock.updateStatus).toHaveBeenNthCalledWith(
      2,
      jobId,
      ImportJobStatus.DONE,
      expect.objectContaining({
        processedRows: 2,
        successCount: 2,
        errorCount: 0,
        completedAt: expect.any(Date),
      }),
    );
  });

  it('falha (FAILED) com mensagem Linha N ao validar linha inválida', async () => {
    const job = await buildJob([
      ['name', 'parkingSpace'],
      ['A', 1], // name muito curto — linha 2
    ]);
    departmentRepoMock.findByNamesAndCompanyId.mockResolvedValue([]);

    await expect(processor.process(job)).rejects.toBeTruthy();

    expect(importJobRepoMock.updateStatus).toHaveBeenNthCalledWith(
      2,
      jobId,
      ImportJobStatus.FAILED,
      expect.objectContaining({
        errorMessage: 'Linha 2: name deve ter entre 2 e 255 caracteres.',
        errorCount: 1,
        completedAt: expect.any(Date),
      }),
    );
    expect(departmentRepoMock.createBatch).not.toHaveBeenCalled();
  });

  it('falha (FAILED) com departamento duplicado dentro do próprio arquivo', async () => {
    const job = await buildJob([
      ['name', 'parkingSpace'],
      ['Recepção', 10],
      ['Recepção', 20],
    ]);
    departmentRepoMock.findByNamesAndCompanyId.mockResolvedValue([]);

    await expect(processor.process(job)).rejects.toBeTruthy();

    expect(importJobRepoMock.updateStatus).toHaveBeenNthCalledWith(
      2,
      jobId,
      ImportJobStatus.FAILED,
      expect.objectContaining({
        errorMessage: 'Linha 3: departamento "Recepção" já existe.',
      }),
    );
  });

  it('falha (FAILED) com departamento já existente no banco', async () => {
    const job = await buildJob([
      ['name', 'parkingSpace'],
      ['Recepção', 10],
    ]);
    departmentRepoMock.findByNamesAndCompanyId.mockResolvedValue([
      {
        id: '40000000-0000-0000-0000-000000000001',
        companyId,
        name: 'Recepção',
        description: null,
        parkingSpace: 30,
        isActive: true,
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
        errorMessage: 'Linha 2: departamento "Recepção" já existe.',
      }),
    );
  });

  it('falha (FAILED) com parkingSpace inválido', async () => {
    const job = await buildJob([
      ['name', 'parkingSpace'],
      ['Recepção', 'dez'],
    ]);
    departmentRepoMock.findByNamesAndCompanyId.mockResolvedValue([]);

    await expect(processor.process(job)).rejects.toBeTruthy();

    expect(importJobRepoMock.updateStatus).toHaveBeenNthCalledWith(
      2,
      jobId,
      ImportJobStatus.FAILED,
      expect.objectContaining({
        errorMessage:
          'Linha 2: parkingSpace deve ser um inteiro maior ou igual a 0.',
      }),
    );
  });

  it('remove o arquivo temporário no finally', async () => {
    const job = await buildJob([
      ['name', 'parkingSpace'],
      ['Recepção', 10],
    ]);
    departmentRepoMock.findByNamesAndCompanyId.mockResolvedValue([]);
    departmentRepoMock.createBatch.mockResolvedValue([]);

    await processor.process(job);

    expect(fs.existsSync(path.dirname(job.data.filePath))).toBe(false);
  });
});

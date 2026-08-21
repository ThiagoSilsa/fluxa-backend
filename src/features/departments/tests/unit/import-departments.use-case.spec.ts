// NestJS
import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';
import { QUEUE_NAMES } from '../../../../shared/queue/queue.module';
import { DATA_SHEET } from '../../../../shared/spreadsheet/read-spreadsheet.util';

// Fixtures
import { buildXlsxBufferFromRows } from '../../../../test/support/xlsx-fixture';

// Constants
import { UserType } from '../../../auth/domain/constants/user-type.constant';
import {
  ImportJobStatus,
  ImportJobType,
} from '../../../imports/domain/constants/import-job.constant';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { ImportJobRepository } from '../../../imports/domain/repositories/import-job.repository';

// Repository
import { IMPORT_JOB_REPOSITORY } from '../../../imports/domain/repositories/import-job.repository';

// Use case
import { ImportDepartmentsUseCase } from '../../application/use-cases/import-departments.use-case';

describe('ImportDepartmentsUseCase', () => {
  let useCase: ImportDepartmentsUseCase;

  const importJobRepoMock = {
    create: jest.fn(),
  } as jest.Mocked<Pick<ImportJobRepository, 'create'>>;

  const queueMock = {
    add: jest.fn(),
  } as unknown as jest.Mocked<Pick<Queue, 'add'>>;

  const actor: AuthenticatedUserEntity = {
    id: '30000000-0000-0000-0000-000000000001',
    companyId: '10000000-0000-0000-0000-000000000001',
    email: 'admin@somar.local',
    name: 'Administrador',
    type: UserType.EMPLOYEE,
    isAdmin: true,
    roleCodes: ['Administração'],
    permissions: [PermissionCode.MANAGE_IMPORTS],
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ImportDepartmentsUseCase,
        { provide: IMPORT_JOB_REPOSITORY, useValue: importJobRepoMock },
        {
          provide: getQueueToken(QUEUE_NAMES.IMPORT_DEPARTMENTS),
          useValue: queueMock,
        },
      ],
    }).compile();

    useCase = module.get(ImportDepartmentsUseCase);
  });

  it('cria o job PENDING e enfileira quando a planilha é válida', async () => {
    const buffer = await buildXlsxBufferFromRows(DATA_SHEET, [
      ['name', 'parkingSpace', 'description'],
      ['Recepção', 10, 'Portaria principal'],
      ['Segurança', 5, ''],
    ]);
    importJobRepoMock.create.mockResolvedValue({
      id: '50000000-0000-0000-0000-000000000001',
      companyId: actor.companyId,
      createdByUserId: actor.id,
      type: ImportJobType.DEPARTMENT,
      fileName: 'departamentos.xlsx',
      totalRows: 2,
      processedRows: 0,
      successCount: 0,
      errorCount: 0,
      status: ImportJobStatus.PENDING,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
      createdAt: new Date('2026-08-20T10:00:00Z'),
    });
    queueMock.add.mockResolvedValue({} as never);

    const result = await useCase.execute(actor, {
      originalname: 'departamentos.xlsx',
      buffer,
    });

    expect(importJobRepoMock.create).toHaveBeenCalledWith({
      companyId: actor.companyId,
      createdByUserId: actor.id,
      type: ImportJobType.DEPARTMENT,
      fileName: 'departamentos.xlsx',
      totalRows: 2,
    });
    expect(queueMock.add).toHaveBeenCalledWith(
      'import',
      expect.objectContaining({
        jobId: '50000000-0000-0000-0000-000000000001',
        companyId: actor.companyId,
        createdByUserId: actor.id,
        totalRows: 2,
      }),
      expect.objectContaining({ removeOnComplete: 50, removeOnFail: 100 }),
    );
    expect(result).toEqual({
      jobId: '50000000-0000-0000-0000-000000000001',
      status: 'PENDING',
    });
  });

  it('rejeita extensão diferente de .xlsx', async () => {
    await expect(
      useCase.execute(actor, {
        originalname: 'departamentos.csv',
        buffer: Buffer.from('a,b\n1,2'),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(importJobRepoMock.create).not.toHaveBeenCalled();
    expect(queueMock.add).not.toHaveBeenCalled();
  });

  it('rejeita planilha vazia (sem linhas de dados)', async () => {
    const buffer = await buildXlsxBufferFromRows(DATA_SHEET, [
      ['name', 'parkingSpace'],
    ]);

    await expect(
      useCase.execute(actor, {
        originalname: 'vazia.xlsx',
        buffer,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(importJobRepoMock.create).not.toHaveBeenCalled();
  });

  it('rejeita colunas obrigatórias ausentes', async () => {
    const buffer = await buildXlsxBufferFromRows(DATA_SHEET, [
      ['name'],
      ['Recepção'],
    ]);

    await expect(
      useCase.execute(actor, {
        originalname: 'faltando.xlsx',
        buffer,
      }),
    ).rejects.toThrow('Colunas obrigatórias ausentes');

    expect(importJobRepoMock.create).not.toHaveBeenCalled();
  });

  it('rejeita colunas desconhecidas', async () => {
    const buffer = await buildXlsxBufferFromRows(DATA_SHEET, [
      ['name', 'parkingSpace', 'email'],
      ['Recepção', 10, 'x@y.com'],
    ]);

    await expect(
      useCase.execute(actor, {
        originalname: 'desconhecida.xlsx',
        buffer,
      }),
    ).rejects.toThrow('Colunas desconhecidas');

    expect(importJobRepoMock.create).not.toHaveBeenCalled();
  });

  it('rejeita quando a aba data não existe', async () => {
    const buffer = await buildXlsxBufferFromRows('outra-aba', [
      ['name', 'parkingSpace'],
      ['Recepção', 10],
    ]);

    await expect(
      useCase.execute(actor, {
        originalname: 'sem-data.xlsx',
        buffer,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(importJobRepoMock.create).not.toHaveBeenCalled();
  });
});

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
import { ImportUserVehiclesUseCase } from '../../application/use-cases/import-user-vehicles.use-case';

describe('ImportUserVehiclesUseCase', () => {
  let useCase: ImportUserVehiclesUseCase;

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
        ImportUserVehiclesUseCase,
        { provide: IMPORT_JOB_REPOSITORY, useValue: importJobRepoMock },
        {
          provide: getQueueToken(QUEUE_NAMES.IMPORT_USER_VEHICLES),
          useValue: queueMock,
        },
      ],
    }).compile();

    useCase = module.get(ImportUserVehiclesUseCase);
  });

  it('cria o job PENDING e enfileira quando a planilha é válida', async () => {
    const buffer = await buildXlsxBufferFromRows(DATA_SHEET, [
      ['vehiclePlate', 'userEmail'],
      ['ABC1234', 'motorista@somar.local'],
    ]);
    importJobRepoMock.create.mockResolvedValue({
      id: '50000000-0000-0000-0000-000000000001',
      companyId: actor.companyId,
      createdByUserId: actor.id,
      type: ImportJobType.USER_VEHICLE,
      fileName: 'vinculos.xlsx',
      totalRows: 1,
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
      originalname: 'vinculos.xlsx',
      buffer,
    });

    expect(importJobRepoMock.create).toHaveBeenCalledWith({
      companyId: actor.companyId,
      createdByUserId: actor.id,
      type: ImportJobType.USER_VEHICLE,
      fileName: 'vinculos.xlsx',
      totalRows: 1,
    });
    expect(result).toEqual({
      jobId: '50000000-0000-0000-0000-000000000001',
      status: 'PENDING',
    });
  });

  it('rejeita extensão diferente de .xlsx', async () => {
    await expect(
      useCase.execute(actor, {
        originalname: 'vinculos.csv',
        buffer: Buffer.from('a,b\n1,2'),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(importJobRepoMock.create).not.toHaveBeenCalled();
  });

  it('rejeita planilha vazia', async () => {
    const buffer = await buildXlsxBufferFromRows(DATA_SHEET, [
      ['vehiclePlate', 'userEmail'],
    ]);

    await expect(
      useCase.execute(actor, {
        originalname: 'vazia.xlsx',
        buffer,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejeita colunas obrigatórias ausentes', async () => {
    const buffer = await buildXlsxBufferFromRows(DATA_SHEET, [
      ['vehiclePlate'],
      ['ABC1234'],
    ]);

    await expect(
      useCase.execute(actor, {
        originalname: 'faltando.xlsx',
        buffer,
      }),
    ).rejects.toThrow('Colunas obrigatórias ausentes');
  });

  it('rejeita colunas desconhecidas', async () => {
    const buffer = await buildXlsxBufferFromRows(DATA_SHEET, [
      ['vehiclePlate', 'userEmail', 'setor'],
      ['ABC1234', 'x@y.com', 'recepção'],
    ]);

    await expect(
      useCase.execute(actor, {
        originalname: 'desconhecida.xlsx',
        buffer,
      }),
    ).rejects.toThrow('Colunas desconhecidas');
  });
});

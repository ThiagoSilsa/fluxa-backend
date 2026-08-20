// NestJS
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';

// Constants
import { UserType } from '../../../auth/domain/constants/user-type.constant';
import { ImportJobStatus, ImportJobType } from '../../domain/constants/import-job.constant';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { ImportJobEntity } from '../../domain/entities/import-job.entity';
import type { ImportJobRepository } from '../../domain/repositories/import-job.repository';

// Repository
import { IMPORT_JOB_REPOSITORY } from '../../domain/repositories/import-job.repository';

// Use case
import { GetImportJobStatusUseCase } from '../../application/use-cases/get-import-job-status.use-case';

describe('GetImportJobStatusUseCase', () => {
  let useCase: GetImportJobStatusUseCase;

  const importJobRepoMock = {
    findByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<ImportJobRepository, 'findByIdAndCompanyId'>>;

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

  const job: ImportJobEntity = {
    id: '50000000-0000-0000-0000-000000000001',
    companyId: actor.companyId,
    createdByUserId: actor.id,
    type: ImportJobType.USER,
    fileName: 'usuarios.xlsx',
    totalRows: 10,
    processedRows: 4,
    successCount: 4,
    errorCount: 0,
    status: ImportJobStatus.PROCESSING,
    errorMessage: null,
    startedAt: new Date('2026-08-20T10:00:00Z'),
    completedAt: null,
    createdAt: new Date('2026-08-20T10:00:00Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        GetImportJobStatusUseCase,
        { provide: IMPORT_JOB_REPOSITORY, useValue: importJobRepoMock },
      ],
    }).compile();

    useCase = module.get(GetImportJobStatusUseCase);
  });

  it('devolve o job quando encontrado na empresa da sessão', async () => {
    importJobRepoMock.findByIdAndCompanyId.mockResolvedValue(job);

    const result = await useCase.execute(actor, job.id);

    expect(importJobRepoMock.findByIdAndCompanyId).toHaveBeenCalledWith(
      job.id,
      actor.companyId,
    );
    expect(result).toEqual({
      id: job.id,
      type: ImportJobType.USER,
      status: ImportJobStatus.PROCESSING,
      totalRows: 10,
      processedRows: 4,
      successCount: 4,
      errorCount: 0,
      errorMessage: null,
      fileName: 'usuarios.xlsx',
      createdAt: '2026-08-20T10:00:00.000Z',
      startedAt: '2026-08-20T10:00:00.000Z',
      completedAt: null,
    });
  });

  it('lança NotFoundException quando o job não existe ou é de outro tenant', async () => {
    importJobRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(useCase.execute(actor, job.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

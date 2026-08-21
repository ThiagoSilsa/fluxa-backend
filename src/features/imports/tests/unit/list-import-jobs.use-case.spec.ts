// NestJS
import { Test } from '@nestjs/testing';

// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';

// Constants
import { UserType } from '../../../auth/domain/constants/user-type.constant';
import {
  ImportJobStatus,
  ImportJobType,
} from '../../domain/constants/import-job.constant';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { ImportJobEntity } from '../../domain/entities/import-job.entity';
import type { ImportJobRepository } from '../../domain/repositories/import-job.repository';

// Repository
import { IMPORT_JOB_REPOSITORY } from '../../domain/repositories/import-job.repository';

// DTO
import { ListImportJobsDto } from '../../application/dto/list-import-jobs.dto';

// Use case
import { ListImportJobsUseCase } from '../../application/use-cases/list-import-jobs.use-case';

describe('ListImportJobsUseCase', () => {
  let useCase: ListImportJobsUseCase;

  const importJobRepoMock = {
    findByCompanyIdPaginated: jest.fn(),
  } as jest.Mocked<Pick<ImportJobRepository, 'findByCompanyIdPaginated'>>;

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

  const jobs: ImportJobEntity[] = [
    {
      id: '50000000-0000-0000-0000-000000000001',
      companyId: actor.companyId,
      createdByUserId: actor.id,
      type: ImportJobType.DEPARTMENT,
      fileName: 'departamentos.xlsx',
      totalRows: 3,
      processedRows: 3,
      successCount: 3,
      errorCount: 0,
      status: ImportJobStatus.DONE,
      errorMessage: null,
      startedAt: new Date('2026-08-20T10:00:00Z'),
      completedAt: new Date('2026-08-20T10:00:05Z'),
      createdAt: new Date('2026-08-20T10:00:00Z'),
    },
    {
      id: '50000000-0000-0000-0000-000000000002',
      companyId: actor.companyId,
      createdByUserId: actor.id,
      type: ImportJobType.VEHICLE,
      fileName: 'veiculos.xlsx',
      totalRows: 5,
      processedRows: 0,
      successCount: 0,
      errorCount: 1,
      status: ImportJobStatus.FAILED,
      errorMessage: 'Linha 2: placa inválida.',
      startedAt: null,
      completedAt: new Date('2026-08-20T09:00:00Z'),
      createdAt: new Date('2026-08-20T09:00:00Z'),
    },
  ];

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ListImportJobsUseCase,
        { provide: IMPORT_JOB_REPOSITORY, useValue: importJobRepoMock },
      ],
    }).compile();

    useCase = module.get(ListImportJobsUseCase);
  });

  it('lista jobs da empresa no formato padrão, do mais recente para o mais antigo', async () => {
    importJobRepoMock.findByCompanyIdPaginated.mockResolvedValue({
      data: jobs,
      count: 2,
    });

    const result = await useCase.execute(
      actor,
      new ListImportJobsDto(undefined, 20, 0),
    );

    expect(importJobRepoMock.findByCompanyIdPaginated).toHaveBeenCalledWith({
      companyId: actor.companyId,
      type: undefined,
      limit: 20,
      offset: 0,
    });
    expect(result).toEqual({
      limit: 20,
      offset: 0,
      count: 2,
      data: [
        {
          id: jobs[0].id,
          type: ImportJobType.DEPARTMENT,
          status: ImportJobStatus.DONE,
          totalRows: 3,
          processedRows: 3,
          successCount: 3,
          errorCount: 0,
          errorMessage: null,
          fileName: 'departamentos.xlsx',
          createdAt: '2026-08-20T10:00:00.000Z',
          startedAt: '2026-08-20T10:00:00.000Z',
          completedAt: '2026-08-20T10:00:05.000Z',
        },
        {
          id: jobs[1].id,
          type: ImportJobType.VEHICLE,
          status: ImportJobStatus.FAILED,
          totalRows: 5,
          processedRows: 0,
          successCount: 0,
          errorCount: 1,
          errorMessage: 'Linha 2: placa inválida.',
          fileName: 'veiculos.xlsx',
          createdAt: '2026-08-20T09:00:00.000Z',
          startedAt: null,
          completedAt: '2026-08-20T09:00:00.000Z',
        },
      ],
    });
  });

  it('repassa o filtro por tipo para o repositório', async () => {
    importJobRepoMock.findByCompanyIdPaginated.mockResolvedValue({
      data: [jobs[1]],
      count: 1,
    });

    const result = await useCase.execute(
      actor,
      new ListImportJobsDto(ImportJobType.VEHICLE, 10, 0),
    );

    expect(importJobRepoMock.findByCompanyIdPaginated).toHaveBeenCalledWith({
      companyId: actor.companyId,
      type: ImportJobType.VEHICLE,
      limit: 10,
      offset: 0,
    });
    expect(result.count).toBe(1);
    expect(result.data).toHaveLength(1);
  });

  it('usa os defaults de paginação quando não informados', async () => {
    importJobRepoMock.findByCompanyIdPaginated.mockResolvedValue({
      data: [],
      count: 0,
    });

    await useCase.execute(actor, new ListImportJobsDto());

    expect(importJobRepoMock.findByCompanyIdPaginated).toHaveBeenCalledWith({
      companyId: actor.companyId,
      type: undefined,
      limit: 20,
      offset: 0,
    });
  });
});

// Node
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

// NestJS
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';

// Shared
import { DATA_SHEET } from '../../../../shared/spreadsheet/read-spreadsheet.util';

// Fixtures
import { writeXlsxFile } from '../../../../test/support/xlsx-fixture';

// Auth
import { PasswordHashUseCase } from '../../../../shared/security/password-hash.use-case';
import { UserType } from '../../../auth/domain/constants/user-type.constant';
import { USER_COMPANY_REPOSITORY } from '../../../auth/domain/repositories/user-company.repository';
import type { UserCompanyRepository } from '../../../auth/domain/repositories/user-company.repository';

// Roles
import { ROLE_REPOSITORY } from '../../../roles/domain/repositories/role.repository';
import type { RoleRepository } from '../../../roles/domain/repositories/role.repository';

// Users
import { USER_REPOSITORY } from '../../domain/repositories/user.repository';
import { USER_ROLE_REPOSITORY } from '../../domain/repositories/user-role.repository';
import type { UserRepository } from '../../domain/repositories/user.repository';
import type { UserRoleRepository } from '../../domain/repositories/user-role.repository';

// Imports
import { IMPORT_JOB_REPOSITORY } from '../../../imports/domain/repositories/import-job.repository';
import { ImportJobStatus } from '../../../imports/domain/constants/import-job.constant';
import type { ImportJobRepository } from '../../../imports/domain/repositories/import-job.repository';

// DTOs
import type { ImportUsersJobData } from '../../application/dto/import-users-job-data';

// Processor
import { ImportUsersProcessor } from '../../application/processors/import-users.processor';

describe('ImportUsersProcessor', () => {
  let processor: ImportUsersProcessor;
  let tempDir: string;

  const importJobRepoMock = {
    updateStatus: jest.fn(),
  } as jest.Mocked<Pick<ImportJobRepository, 'updateStatus'>>;

  const userRepoMock = {
    findByEmails: jest.fn(),
    findByDocument: jest.fn(),
    createBatch: jest.fn(),
  } as jest.Mocked<
    Pick<UserRepository, 'findByEmails' | 'findByDocument' | 'createBatch'>
  >;

  const userCompanyRepoMock = {
    findByEmailAndCompanyId: jest.fn(),
    create: jest.fn(),
  } as jest.Mocked<
    Pick<UserCompanyRepository, 'findByEmailAndCompanyId' | 'create'>
  >;

  const userRoleRepoMock = {
    create: jest.fn(),
  } as jest.Mocked<Pick<UserRoleRepository, 'create'>>;

  const roleRepoMock = {
    findByNamesAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<RoleRepository, 'findByNamesAndCompanyId'>>;

  const configMock = {
    get: jest.fn().mockReturnValue('Somar@123'),
  } as unknown as jest.Mocked<Pick<ConfigService, 'get'>>;

  const passwordHashMock = {
    execute: jest.fn().mockReturnValue('$2b$hashed'),
  } as unknown as PasswordHashUseCase;

  const companyId = '10000000-0000-0000-0000-000000000001';
  const jobId = '50000000-0000-0000-0000-000000000001';

  const porteiroRole = {
    id: '20000000-0000-0000-0000-000000000004',
    companyId,
    name: 'Porteiro',
    description: null,
    isAdmin: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  async function buildJob(rows: unknown[][]): Promise<Job<ImportUsersJobData>> {
    const filePath = path.join(tempDir, 'usuarios.xlsx');
    await writeXlsxFile(filePath, DATA_SHEET, rows);
    return {
      data: {
        jobId,
        companyId,
        createdByUserId: '30000000-0000-0000-0000-000000000001',
        filePath,
        totalRows: rows.length - 1,
      },
    } as Job<ImportUsersJobData>;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'import-users-spec-'));

    const module = await Test.createTestingModule({
      providers: [
        ImportUsersProcessor,
        { provide: IMPORT_JOB_REPOSITORY, useValue: importJobRepoMock },
        { provide: USER_REPOSITORY, useValue: userRepoMock },
        { provide: USER_COMPANY_REPOSITORY, useValue: userCompanyRepoMock },
        { provide: USER_ROLE_REPOSITORY, useValue: userRoleRepoMock },
        { provide: ROLE_REPOSITORY, useValue: roleRepoMock },
        { provide: ConfigService, useValue: configMock },
        { provide: PasswordHashUseCase, useValue: passwordHashMock },
      ],
    }).compile();

    processor = module.get(ImportUsersProcessor);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('cria pessoas novas (createBatch) com senha default e cargo', async () => {
    const job = await buildJob([
      ['email', 'name', 'type', 'password', 'role'],
      ['joao@somar.local', 'João', 'EMPLOYEE', '', 'Porteiro'],
    ]);
    userRepoMock.findByEmails.mockResolvedValue([]);
    userCompanyRepoMock.findByEmailAndCompanyId.mockResolvedValue(null);
    roleRepoMock.findByNamesAndCompanyId.mockResolvedValue([porteiroRole]);
    userRepoMock.createBatch.mockResolvedValue([
      {
        id: '30000000-0000-0000-0000-000000000100',
        name: 'João',
        email: 'joao@somar.local',
        passwordHash: '$2b$hashed',
        phone: null,
        document: null,
        photoUrl: null,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await processor.process(job);

    expect(passwordHashMock.execute).toHaveBeenCalledWith('Somar@123');
    expect(userRepoMock.createBatch).toHaveBeenCalledWith([
      expect.objectContaining({
        name: 'João',
        email: 'joao@somar.local',
        passwordHash: '$2b$hashed',
        phone: null,
        document: null,
        companyId,
        type: UserType.EMPLOYEE,
        isActive: true,
        roleId: porteiroRole.id,
      }),
    ]);
    expect(importJobRepoMock.updateStatus).toHaveBeenNthCalledWith(
      2,
      jobId,
      ImportJobStatus.DONE,
      expect.objectContaining({ successCount: 1 }),
    );
  });

  it('cria apenas o vínculo para pessoa já existente em outra empresa', async () => {
    const job = await buildJob([
      ['email', 'name', 'role'],
      ['existente@somar.local', '', 'Porteiro'],
    ]);
    userRepoMock.findByEmails.mockResolvedValue([
      {
        id: '30000000-0000-0000-0000-000000000099',
        name: 'Existente',
        email: 'existente@somar.local',
        passwordHash: 'x',
        phone: null,
        document: null,
        photoUrl: null,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    userCompanyRepoMock.findByEmailAndCompanyId.mockResolvedValue(null);
    roleRepoMock.findByNamesAndCompanyId.mockResolvedValue([porteiroRole]);
    userCompanyRepoMock.create.mockResolvedValue({} as never);
    userRoleRepoMock.create.mockResolvedValue();

    await processor.process(job);

    expect(userRepoMock.createBatch).not.toHaveBeenCalled();
    expect(userCompanyRepoMock.create).toHaveBeenCalledWith({
      userId: '30000000-0000-0000-0000-000000000099',
      companyId,
      type: UserType.EMPLOYEE,
      isActive: true,
    });
    expect(userRoleRepoMock.create).toHaveBeenCalledWith(
      '30000000-0000-0000-0000-000000000099',
      porteiroRole.id,
      companyId,
    );
    expect(importJobRepoMock.updateStatus).toHaveBeenNthCalledWith(
      2,
      jobId,
      ImportJobStatus.DONE,
      expect.objectContaining({ successCount: 1 }),
    );
  });

  it('falha (FAILED) com e-mail já vinculado na empresa', async () => {
    const job = await buildJob([
      ['email', 'name'],
      ['vinculado@somar.local', 'João'],
    ]);
    userRepoMock.findByEmails.mockResolvedValue([]);
    userCompanyRepoMock.findByEmailAndCompanyId.mockResolvedValue({
      linkId: '70000000-0000-0000-0000-000000000001',
      userId: '30000000-0000-0000-0000-000000000007',
      name: 'Vinculado',
      email: 'vinculado@somar.local',
      phone: null,
      document: null,
      photoUrl: null,
      type: UserType.EMPLOYEE,
      isActive: true,
    });

    await expect(processor.process(job)).rejects.toBeTruthy();

    expect(importJobRepoMock.updateStatus).toHaveBeenNthCalledWith(
      2,
      jobId,
      ImportJobStatus.FAILED,
      expect.objectContaining({
        errorMessage:
          'Linha 2: usuário com e-mail "vinculado@somar.local" já está vinculado.',
      }),
    );
  });

  it('falha (FAILED) com name muito curto', async () => {
    const job = await buildJob([
      ['email', 'name'],
      ['novo@somar.local', 'A'],
    ]);
    userRepoMock.findByEmails.mockResolvedValue([]);
    userCompanyRepoMock.findByEmailAndCompanyId.mockResolvedValue(null);
    roleRepoMock.findByNamesAndCompanyId.mockResolvedValue([]);

    await expect(processor.process(job)).rejects.toBeTruthy();

    expect(importJobRepoMock.updateStatus).toHaveBeenNthCalledWith(
      2,
      jobId,
      ImportJobStatus.FAILED,
      expect.objectContaining({
        errorMessage: 'Linha 2: name deve ter entre 2 e 255 caracteres.',
      }),
    );
  });

  it('falha (FAILED) com type inválido', async () => {
    const job = await buildJob([
      ['email', 'name', 'type'],
      ['novo@somar.local', 'João', 'CONVIDADO'],
    ]);
    userRepoMock.findByEmails.mockResolvedValue([]);
    userCompanyRepoMock.findByEmailAndCompanyId.mockResolvedValue(null);
    roleRepoMock.findByNamesAndCompanyId.mockResolvedValue([]);

    await expect(processor.process(job)).rejects.toBeTruthy();

    expect(importJobRepoMock.updateStatus).toHaveBeenNthCalledWith(
      2,
      jobId,
      ImportJobStatus.FAILED,
      expect.objectContaining({
        errorMessage: 'Linha 2: type deve ser "EMPLOYEE" ou "VISITOR".',
      }),
    );
  });

  it('falha (FAILED) com cargo não encontrado', async () => {
    const job = await buildJob([
      ['email', 'name', 'role'],
      ['novo@somar.local', 'João', 'Inexistente'],
    ]);
    userRepoMock.findByEmails.mockResolvedValue([]);
    userCompanyRepoMock.findByEmailAndCompanyId.mockResolvedValue(null);
    roleRepoMock.findByNamesAndCompanyId.mockResolvedValue([]);

    await expect(processor.process(job)).rejects.toBeTruthy();

    expect(importJobRepoMock.updateStatus).toHaveBeenNthCalledWith(
      2,
      jobId,
      ImportJobStatus.FAILED,
      expect.objectContaining({
        errorMessage: 'Linha 2: cargo "Inexistente" não encontrado.',
      }),
    );
  });

  it('falha (FAILED) com documento já cadastrado', async () => {
    const job = await buildJob([
      ['email', 'name', 'document'],
      ['novo@somar.local', 'João', '123456789'],
    ]);
    userRepoMock.findByEmails.mockResolvedValue([]);
    userCompanyRepoMock.findByEmailAndCompanyId.mockResolvedValue(null);
    roleRepoMock.findByNamesAndCompanyId.mockResolvedValue([]);
    userRepoMock.findByDocument.mockResolvedValue({
      id: '30000000-0000-0000-0000-000000000077',
      name: 'Outra',
      email: 'outra@somar.local',
      passwordHash: 'x',
      phone: null,
      document: '123456789',
      photoUrl: null,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(processor.process(job)).rejects.toBeTruthy();

    expect(importJobRepoMock.updateStatus).toHaveBeenNthCalledWith(
      2,
      jobId,
      ImportJobStatus.FAILED,
      expect.objectContaining({
        errorMessage: 'Linha 2: documento já cadastrado.',
      }),
    );
  });
});

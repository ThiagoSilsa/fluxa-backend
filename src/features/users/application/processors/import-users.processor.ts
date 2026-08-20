// Node
import * as fs from 'node:fs';

// NestJS
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

// Shared
import { QUEUE_NAMES } from '../../../../shared/queue/queue.module';
import { readSheetAsRows } from '../../../../shared/spreadsheet/read-spreadsheet.util';
import type { SheetRow } from '../../../../shared/spreadsheet/read-spreadsheet.util';
import { normalizeEmail } from '../../../../shared/utils/email.util';

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
import type { CreateUserRepositoryData } from '../../domain/repositories/user.repository';
import type { UserRepository } from '../../domain/repositories/user.repository';
import type { UserRoleRepository } from '../../domain/repositories/user-role.repository';

// Imports (feature genérica)
import { IMPORT_JOB_REPOSITORY } from '../../../imports/domain/repositories/import-job.repository';
import { ImportJobStatus } from '../../../imports/domain/constants/import-job.constant';
import type { ImportJobRepository } from '../../../imports/domain/repositories/import-job.repository';

// DTOs
import type { ImportUsersJobData } from '../dto/import-users-job-data';

/** Dados de uma pessoa já existente (vínculo apenas — ADR 0005 §2/regra 26). */
interface LinkOnlyInput {
  userId: string;
  companyId: string;
  type: UserType;
  roleId?: string;
}

/**
 * Worker de importação de usuários (ADR 0007 §2/§5/§8).
 *
 * Consome a fila `import-users` com `concurrency: 1`, lê o arquivo do disco e
 * valida linha a linha (fail-fast): e-mail normalizado (sem duplicado na
 * empresa nem no arquivo), `name` obrigatório para pessoa nova, `type`
 * válido, `document` único, `role` (nome) existente/ativo. Pessoas novas
 * entram via `createBatch` (pessoa + vínculo + cargo); pessoas já existentes
 * em outra empresa viram apenas `user_company`. Senha em branco usa a default
 * (`IMPORT_DEFAULT_PASSWORD`), sempre com hash.
 */
@Processor(QUEUE_NAMES.IMPORT_USERS, { concurrency: 1 })
@Injectable()
export class ImportUsersProcessor extends WorkerHost {
  private readonly logger = new Logger(ImportUsersProcessor.name);

  /** Tamanho do lote de inserção (ADR 0007 §8). */
  private readonly CHUNK_SIZE = 500;

  constructor(
    @Inject(IMPORT_JOB_REPOSITORY)
    private readonly importJobRepository: ImportJobRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(USER_COMPANY_REPOSITORY)
    private readonly userCompanyRepository: UserCompanyRepository,
    @Inject(USER_ROLE_REPOSITORY)
    private readonly userRoleRepository: UserRoleRepository,
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: RoleRepository,
    private readonly passwordHash: PasswordHashUseCase,
    private readonly config: ConfigService,
  ) {
    super();
  }

  /**
   * Processa um job de importação de usuários.
   *
   * @param job Job enfileirado (jobId, companyId, filePath, ...).
   */
  public async process(job: Job<ImportUsersJobData>): Promise<void> {
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

      const prepared = await this.buildCreateInputs(records, companyId);

      // Pessoas novas: createBatch em chunks (pessoa + vínculo + cargo)
      let inserted = 0;
      for (let i = 0; i < prepared.newPersons.length; i += this.CHUNK_SIZE) {
        const chunk = prepared.newPersons.slice(i, i + this.CHUNK_SIZE);
        const created = await this.userRepository.createBatch(chunk);
        inserted += created.length;
      }

      // Pessoas existentes: vínculo (e cargo) apenas
      for (const item of prepared.linkOnly) {
        await this.userCompanyRepository.create({
          userId: item.userId,
          companyId: item.companyId,
          type: item.type,
          isActive: true,
        });
        if (item.roleId) {
          await this.userRoleRepository.create(
            item.userId,
            item.roleId,
            item.companyId,
          );
        }
        inserted += 1;
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
   * Regras por linha (ADR 0007 §8/regra 23–26): e-mail normalizado; pessoa
   * com vínculo ativo na empresa → erro; `name` 2–255 (pessoa nova); `type`
   * `EMPLOYEE`/`VISITOR`; `document` único (pessoa nova); `role` (nome)
   * existente/ativo; senha em branco usa a default. Pessoa já existente em
   * outra empresa vira apenas `user_company`.
   *
   * @param records Linhas da planilha (cabeçalho → texto).
   * @param companyId Empresa da sessão.
   * @returns Inputs de criação (novas pessoas + vínculos apenas).
   * @throws {BadRequestException} Na primeira linha inválida (`Linha N: ...`).
   */
  private async buildCreateInputs(
    records: SheetRow[],
    companyId: string,
  ): Promise<{
    newPersons: CreateUserRepositoryData[];
    linkOnly: LinkOnlyInput[];
  }> {
    const emails = records
      .map((record) => normalizeEmail(record.email ?? ''))
      .filter((email) => email !== '');
    const persons = await this.userRepository.findByEmails(emails);
    const personsByEmail = new Map(
      persons.map((person) => [person.email, person]),
    );

    const linksByEmail = new Map<
      string,
      { userId: string; isActive: boolean }
    >();
    for (const email of [...new Set(emails)]) {
      const link = await this.userCompanyRepository.findByEmailAndCompanyId(
        email,
        companyId,
      );
      if (link) {
        linksByEmail.set(email, {
          userId: link.userId,
          isActive: link.isActive,
        });
      }
    }

    const roleNames = [
      ...new Set(
        records
          .map((record) => (record.role ?? '').trim())
          .filter((name) => name !== ''),
      ),
    ];
    const roles = await this.roleRepository.findByNamesAndCompanyId(
      roleNames,
      companyId,
    );
    const roleByName = new Map(roles.map((role) => [role.name, role]));

    const defaultPassword =
      this.config.get<string>('IMPORT_DEFAULT_PASSWORD') ?? 'Somar@123';

    const seenEmails = new Set<string>();
    const seenDocuments = new Set<string>();
    const newPersons: CreateUserRepositoryData[] = [];
    const linkOnly: LinkOnlyInput[] = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const lineNumber = i + 2; // linha 1 é o cabeçalho

      const email = normalizeEmail(record.email ?? '');
      if (email === '') {
        throw new BadRequestException(
          `Linha ${lineNumber}: e-mail é obrigatório.`,
        );
      }
      if (seenEmails.has(email)) {
        throw new BadRequestException(
          `Linha ${lineNumber}: usuário com e-mail "${email}" já está vinculado.`,
        );
      }
      seenEmails.add(email);

      const link = linksByEmail.get(email);
      if (link) {
        throw new BadRequestException(
          `Linha ${lineNumber}: usuário com e-mail "${email}" já está vinculado.`,
        );
      }

      const typeRaw = (record.type ?? '').trim().toUpperCase();
      let type = UserType.EMPLOYEE;
      if (typeRaw === '' || typeRaw === 'EMPLOYEE') {
        type = UserType.EMPLOYEE;
      } else if (typeRaw === 'VISITOR') {
        type = UserType.VISITOR;
      } else {
        throw new BadRequestException(
          `Linha ${lineNumber}: type deve ser "EMPLOYEE" ou "VISITOR".`,
        );
      }

      const roleName = (record.role ?? '').trim();
      let roleId: string | undefined;
      if (roleName !== '') {
        const role = roleByName.get(roleName);
        if (!role) {
          throw new BadRequestException(
            `Linha ${lineNumber}: cargo "${roleName}" não encontrado.`,
          );
        }
        if (!role.isActive) {
          throw new BadRequestException(
            `Linha ${lineNumber}: cargo "${roleName}" inativo.`,
          );
        }
        roleId = role.id;
      }

      const person = personsByEmail.get(email);
      if (person) {
        // Pessoa já existe (outra empresa): vínculo apenas — ADR 0005 §2
        linkOnly.push({ userId: person.id, companyId, type, roleId });
        continue;
      }

      const name = (record.name ?? '').trim();
      if (name.length < 2 || name.length > 255) {
        throw new BadRequestException(
          `Linha ${lineNumber}: name deve ter entre 2 e 255 caracteres.`,
        );
      }

      const document = (record.document ?? '').trim() || null;
      if (document) {
        if (seenDocuments.has(document)) {
          throw new BadRequestException(
            `Linha ${lineNumber}: documento já cadastrado.`,
          );
        }
        const byDocument = await this.userRepository.findByDocument(document);
        if (byDocument) {
          throw new BadRequestException(
            `Linha ${lineNumber}: documento já cadastrado.`,
          );
        }
        seenDocuments.add(document);
      }

      const passwordRaw = (record.password ?? '').trim();
      const password = passwordRaw || defaultPassword;
      const passwordHash = this.passwordHash.execute(password);

      newPersons.push({
        name,
        email,
        passwordHash,
        phone: (record.phone ?? '').trim() || null,
        document,
        companyId,
        type,
        isActive: true,
        roleId,
      });
    }

    return { newPersons, linkOnly };
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

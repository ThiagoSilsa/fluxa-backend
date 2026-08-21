// NestJS
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

// TypeORM
import { Repository } from 'typeorm';

// Domain
import { ImportJobEntity } from '../../../domain/entities/import-job.entity';
import { ImportJobStatus } from '../../../domain/constants/import-job.constant';
import {
  CreateImportJobInput,
  FindImportJobsRepositoryInput,
  ImportJobRepository,
  UpdateImportJobData,
} from '../../../domain/repositories/import-job.repository';

// Infra
import { ImportJobOrmEntity } from './import-job.orm-entity';

/**
 * Implementação TypeORM do `ImportJobRepository` — tabela `import_job`
 * (ADR 0007 §3).
 */
@Injectable()
export class ImportsTypeormRepository implements ImportJobRepository {
  constructor(
    @InjectRepository(ImportJobOrmEntity)
    private readonly repository: Repository<ImportJobOrmEntity>,
  ) {}

  /**
   * Cria um job com status inicial `PENDING` e contadores zerados.
   *
   * @param input Dados de criação (inclui `companyId` e `createdByUserId`).
   * @returns O job criado (entidade de domínio).
   */
  public async create(input: CreateImportJobInput): Promise<ImportJobEntity> {
    const entity = this.repository.create({
      companyId: input.companyId,
      createdBy: input.createdByUserId,
      type: input.type,
      fileName: input.fileName,
      totalRows: input.totalRows,
      processedRows: 0,
      successCount: 0,
      errorCount: 0,
      status: ImportJobStatus.PENDING,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
    });

    const saved = await this.repository.save(entity);
    return this.toDomain(saved);
  }

  /**
   * Busca um job pelo id dentro da empresa da sessão.
   *
   * @param id Id do job.
   * @param companyId Empresa da sessão.
   * @returns O job ou `null` se não existir/não pertencer à empresa.
   */
  public async findByIdAndCompanyId(
    id: string,
    companyId: string,
  ): Promise<ImportJobEntity | null> {
    const entity = await this.repository.findOne({ where: { id, companyId } });
    return entity ? this.toDomain(entity) : null;
  }

  /**
   * Lista jobs da empresa com paginação e filtro opcional por tipo, do mais
   * recente para o mais antigo.
   *
   * @param input Filtros, paginação e empresa.
   * @returns Dados da página e total sem paginação.
   */
  public async findByCompanyIdPaginated(
    input: FindImportJobsRepositoryInput,
  ): Promise<{ data: ImportJobEntity[]; count: number }> {
    const where: Record<string, unknown> = { companyId: input.companyId };
    if (input.type) {
      where.type = input.type;
    }

    const [entities, count] = await this.repository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: input.limit,
      skip: input.offset,
    });

    return {
      data: entities.map((entity) => this.toDomain(entity)),
      count,
    };
  }

  /**
   * Atualiza o status e os dados opcionais de um job (apenas campos presentes).
   *
   * @param id Id do job.
   * @param status Novo status.
   * @param data Dados adicionais opcionais.
   */
  public async updateStatus(
    id: string,
    status: ImportJobStatus,
    data?: UpdateImportJobData,
  ): Promise<void> {
    const updateData: Record<string, unknown> = { status };

    if (data?.totalRows !== undefined) updateData.totalRows = data.totalRows;
    if (data?.processedRows !== undefined)
      updateData.processedRows = data.processedRows;
    if (data?.successCount !== undefined)
      updateData.successCount = data.successCount;
    if (data?.errorCount !== undefined) updateData.errorCount = data.errorCount;
    if (data?.errorMessage !== undefined)
      updateData.errorMessage = data.errorMessage;
    if (data?.startedAt !== undefined) updateData.startedAt = data.startedAt;
    if (data?.completedAt !== undefined)
      updateData.completedAt = data.completedAt;

    await this.repository.update(id, updateData);
  }

  /**
   * Converte a ORM entity na entidade de domínio (nunca expõe a ORM crua).
   *
   * @param entity ORM entity do job.
   * @returns Entidade de domínio.
   */
  private toDomain(entity: ImportJobOrmEntity): ImportJobEntity {
    const result = new ImportJobEntity();
    result.id = entity.id;
    result.companyId = entity.companyId;
    result.createdByUserId = entity.createdBy;
    result.type = entity.type;
    result.fileName = entity.fileName;
    result.totalRows = entity.totalRows;
    result.processedRows = entity.processedRows;
    result.successCount = entity.successCount;
    result.errorCount = entity.errorCount;
    result.status = entity.status;
    result.errorMessage = entity.errorMessage;
    result.startedAt = entity.startedAt;
    result.completedAt = entity.completedAt;
    result.createdAt = entity.createdAt;
    return result;
  }
}

// NestJS
import { Inject, Injectable, Logger } from '@nestjs/common';

// Repository
import { DEPARTMENT_REPOSITORY } from '../../domain/repositories/department.repository';

// Mapper
import { toDepartmentResponse } from '../utils/department-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { CreateDepartmentInputDto } from '../dto/create-department-input.dto';
import type { DepartmentResponse } from '../dto/department-response';
import type { DepartmentRepository } from '../../domain/repositories/department.repository';

/**
 * Cria um departamento na empresa da sessão.
 *
 * A quantidade de vagas (`parkingSpace`) é obrigatória no cadastro (ADR 0006
 * §7 — o controller valida a presença); o use case persiste com a empresa da
 * sessão.
 */
@Injectable()
export class CreateDepartmentUseCase {
  private readonly logger = new Logger(CreateDepartmentUseCase.name);

  constructor(
    @Inject(DEPARTMENT_REPOSITORY)
    private readonly departmentRepository: DepartmentRepository,
  ) {}

  /**
   * Cria o departamento com `companyId` da sessão.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Dados de criação (nome, vagas, descrição opcional).
   * @returns Departamento criado.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: CreateDepartmentInputDto,
  ): Promise<DepartmentResponse> {
    const department = await this.departmentRepository.create({
      companyId: actor.companyId,
      name: input.name,
      description: input.description ?? null,
      parkingSpace: input.parkingSpace,
    });

    return toDepartmentResponse(department);
  }
}

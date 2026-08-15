// NestJS
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

// Repository
import { DEPARTMENT_REPOSITORY } from '../../domain/repositories/department.repository';

// Mapper
import { toDepartmentResponse } from '../utils/department-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { GetDepartmentInputDto } from '../dto/get-department-input.dto';
import type { DepartmentResponse } from '../dto/department-response';
import type { DepartmentRepository } from '../../domain/repositories/department.repository';

/**
 * Busca um departamento por id na empresa da sessão.
 */
@Injectable()
export class GetDepartmentUseCase {
  private readonly logger = new Logger(GetDepartmentUseCase.name);

  constructor(
    @Inject(DEPARTMENT_REPOSITORY)
    private readonly departmentRepository: DepartmentRepository,
  ) {}

  /**
   * Detalha um departamento da empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Id do departamento.
   * @returns Departamento da empresa.
   * @throws {NotFoundException} Quando o departamento não existe na empresa
   * (cross-tenant não é revelado — mesma resposta, ADR 0006 §1).
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: GetDepartmentInputDto,
  ): Promise<DepartmentResponse> {
    const department = await this.departmentRepository.findByIdAndCompanyId(
      input.id,
      actor.companyId,
    );
    if (!department) {
      throw new NotFoundException('Departamento não encontrado.');
    }
    return toDepartmentResponse(department);
  }
}

// NestJS
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

// Repository
import { DEPARTMENT_REPOSITORY } from '../../domain/repositories/department.repository';

// Mapper
import { toDepartmentResponse } from '../utils/department-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { DepartmentResponse } from '../dto/department-response';
import type { UpdateDepartmentInputDto } from '../dto/update-department-input.dto';
import type { DepartmentRepository } from '../../domain/repositories/department.repository';

/**
 * Atualiza nome/descrição/vagas de um departamento da empresa da sessão
 * (PATCH parcial — só os campos enviados mudam).
 */
@Injectable()
export class UpdateDepartmentUseCase {
  private readonly logger = new Logger(UpdateDepartmentUseCase.name);

  constructor(
    @Inject(DEPARTMENT_REPOSITORY)
    private readonly departmentRepository: DepartmentRepository,
  ) {}

  /**
   * Atualiza o departamento (nome/descrição/vagas) da empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Id e campos a atualizar.
   * @returns Departamento atualizado.
   * @throws {NotFoundException} Quando o departamento não existe na empresa.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: UpdateDepartmentInputDto,
  ): Promise<DepartmentResponse> {
    const existing = await this.departmentRepository.findByIdAndCompanyId(
      input.id,
      actor.companyId,
    );
    if (!existing) {
      throw new NotFoundException('Departamento não encontrado.');
    }

    const updated = await this.departmentRepository.updateByIdAndCompanyId(
      input.id,
      actor.companyId,
      {
        name: input.name,
        description: input.description,
        parkingSpace: input.parkingSpace,
        isActive: input.isActive,
      },
    );
    if (!updated) {
      throw new NotFoundException('Departamento não encontrado.');
    }
    return toDepartmentResponse(updated);
  }
}

// NestJS
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

// Repository
import { DEPARTMENT_REPOSITORY } from '../../domain/repositories/department.repository';

// Mapper
import { toDepartmentResponse } from '../utils/department-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { DepartmentResponse } from '../dto/department-response';
import type { GetDepartmentInputDto } from '../dto/get-department-input.dto';
import type { DepartmentRepository } from '../../domain/repositories/department.repository';

/**
 * Desativa um departamento da empresa da sessão (soft: `is_active = false`).
 *
 * A desativação **não** remove vínculos em `vehicle_department` nem acessos
 * históricos (ADR 0006 §10) — apenas impede novos usos (seleção na portaria,
 * novo departamento padrão).
 */
@Injectable()
export class DeactivateDepartmentUseCase {
  private readonly logger = new Logger(DeactivateDepartmentUseCase.name);

  constructor(
    @Inject(DEPARTMENT_REPOSITORY)
    private readonly departmentRepository: DepartmentRepository,
  ) {}

  /**
   * Desativa o departamento da empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Id do departamento.
   * @returns Departamento desativado.
   * @throws {NotFoundException} Quando o departamento não existe na empresa.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: GetDepartmentInputDto,
  ): Promise<DepartmentResponse> {
    const existing = await this.departmentRepository.findByIdAndCompanyId(
      input.id,
      actor.companyId,
    );
    if (!existing) {
      throw new NotFoundException('Departamento não encontrado.');
    }

    const updated = await this.departmentRepository.deactivateByIdAndCompanyId(
      input.id,
      actor.companyId,
    );
    if (!updated) {
      throw new NotFoundException('Departamento não encontrado.');
    }
    return toDepartmentResponse(updated);
  }
}

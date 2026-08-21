// NestJS
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

// Repository
import { DEPARTMENT_REPOSITORY } from '../../domain/repositories/department.repository';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { GetDepartmentInputDto } from '../dto/get-department-input.dto';
import type { DepartmentRepository } from '../../domain/repositories/department.repository';

/**
 * Exclui fisicamente um departamento da empresa da sessão.
 *
 * A exclusão é **bloqueada (409)** quando há veículos da empresa vinculados ao
 * departamento via `vehicle_department` (departamento padrão — ADR 0006 §7);
 * sem vínculos, o registro é removido de vez. A suspensão reversível continua
 * disponível via `PATCH` com `isActive: false`.
 */
@Injectable()
export class DeleteDepartmentUseCase {
  private readonly logger = new Logger(DeleteDepartmentUseCase.name);

  constructor(
    @Inject(DEPARTMENT_REPOSITORY)
    private readonly departmentRepository: DepartmentRepository,
  ) {}

  /**
   * Exclui o departamento da empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Id do departamento.
   * @throws {NotFoundException} Quando o departamento não existe na empresa.
   * @throws {ConflictException} Quando há veículos da empresa vinculados ao
   * departamento (vehicle_department).
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: GetDepartmentInputDto,
  ): Promise<void> {
    const existing = await this.departmentRepository.findByIdAndCompanyId(
      input.id,
      actor.companyId,
    );
    if (!existing) {
      throw new NotFoundException('Departamento não encontrado.');
    }

    const vehiclesUsing =
      await this.departmentRepository.countVehicleDepartmentsByDepartmentIdAndCompanyId(
        input.id,
        actor.companyId,
      );
    if (vehiclesUsing > 0) {
      throw new ConflictException(
        'Departamento em uso por veículos e não pode ser excluído.',
      );
    }

    const deleted = await this.departmentRepository.deleteByIdAndCompanyId(
      input.id,
      actor.companyId,
    );
    if (!deleted) {
      throw new NotFoundException('Departamento não encontrado.');
    }
  }
}

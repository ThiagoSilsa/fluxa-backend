import { PermissionCode } from '../../../../shared/constants/access-control.constant';
import { UserType } from '../../domain/constants/user-type.constant';
import type { AuthenticatedUserEntity } from '../../domain/entities/authenticated-user.entity';
import { ValidateSessionUseCase } from '../../application/use-cases/validate-session.use-case';

/**
 * Testes unitários do `ValidateSessionUseCase` (ADR 0003).
 *
 * O guard já resolveu o ator — o use case só mapeia para a resposta estável.
 */
describe('ValidateSessionUseCase', () => {
  let useCase: ValidateSessionUseCase;

  const actor: AuthenticatedUserEntity = {
    id: '30000000-0000-0000-0000-000000000001',
    companyId: '10000000-0000-0000-0000-000000000001',
    email: 'admin@somar.local',
    name: 'Administrador',
    type: UserType.EMPLOYEE,
    roleCodes: ['Administração'],
    permissions: [PermissionCode.MANAGE_COMPANY, PermissionCode.REGISTER_ENTRY],
  };

  beforeEach(() => {
    useCase = new ValidateSessionUseCase();
  });

  it('devolve os dados da sessão do ator autenticado', () => {
    const result = useCase.execute(actor);

    expect(result).toEqual({
      id: actor.id,
      companyId: actor.companyId,
      email: actor.email,
      name: actor.name,
      type: actor.type,
      roleCodes: actor.roleCodes,
      permissions: actor.permissions,
    });
  });

  it('devolve arrays vazios quando o ator não tem cargos/permissões', () => {
    const result = useCase.execute({
      ...actor,
      roleCodes: [],
      permissions: [],
    });

    expect(result.roleCodes).toEqual([]);
    expect(result.permissions).toEqual([]);
  });
});

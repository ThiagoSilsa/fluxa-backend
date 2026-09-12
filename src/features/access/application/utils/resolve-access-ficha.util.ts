// Types
import type { VehicleAccessEntity } from '../../domain/entities/vehicle-access.entity';
import type { VehicleRepository } from '../../../vehicles/domain/repositories/vehicle.repository';
import type { DepartmentRepository } from '../../../departments/domain/repositories/department.repository';
import type { UserRepository } from '../../../users/domain/repositories/user.repository';
import type { VehicleTypeSummary } from '../../../vehicles/application/dto/vehicle-response';

/**
 * Veículo da ficha de conferência (dados que o porteiro confere no balcão).
 */
export interface AccessFichaVehicle {
  /** Id do veículo. */
  id: string;
  /** Placa normalizada. */
  plate: string;
  /** Modelo (opcional). */
  model: string | null;
  /** Cor (opcional). */
  color: string | null;
  /** Tipo de veículo agregado. */
  vehicleType: VehicleTypeSummary | null;
  /** Livre acesso (regra 3). */
  freePass: boolean;
}

/**
 * Ficha de um acesso: condutor, setor e veículo resolvidos.
 *
 * Usada na **conferência de saída** (regra 8: mostrar quem entrou com o
 * veículo) e no resultado do registro de saída — as duas telas mostram a mesma
 * ficha, resolvida pelo mesmo código.
 */
export interface AccessFicha {
  /** Condutor identificado (nome/telefone) ou temporário. */
  driver: { id: string | null; name: string | null; phone: string | null };
  /** Nome do setor confirmado na entrada. */
  departmentName: string | null;
  /** Veículo cadastrado (ou `null` quando a entrada é de placa temporária). */
  vehicle: AccessFichaVehicle | null;
}

/**
 * Fontes de dados da ficha (injetadas — mantém o util testável).
 */
export interface AccessFichaSources {
  /** Veículo por id (o acesso guarda `vehicle_id`). */
  vehicleRepository: Pick<VehicleRepository, 'findByIdAndCompanyId'>;
  /** Setor por id (nome do setor confirmado). */
  departmentRepository: Pick<DepartmentRepository, 'findByIdAndCompanyId'>;
  /** Pessoa (nome e telefone do condutor). */
  userRepository: Pick<UserRepository, 'findById'>;
}

/**
 * Resolve a ficha de um acesso (condutor + setor + veículo).
 *
 * Nunca lança por dado ausente: o acesso pode ter condutor temporário (nome
 * sem pessoa), placa não cadastrada (sem veículo) ou nenhum setor (vagas
 * livres) — a ficha reflete o que existe. As três consultas rodam em paralelo.
 *
 * @param access Acesso (aberto ou encerrado).
 * @param companyId Empresa da sessão.
 * @param sources Repositórios de veículo/setor/pessoa.
 * @returns Ficha do acesso.
 */
export async function resolveAccessFicha(
  access: VehicleAccessEntity,
  companyId: string,
  sources: AccessFichaSources,
): Promise<AccessFicha> {
  const [driver, departmentName, vehicle] = await Promise.all([
    resolveDriver(access, sources.userRepository),
    resolveDepartmentName(access.departmentId, companyId, sources),
    resolveVehicle(access.vehicleId, companyId, sources),
  ]);

  return { driver, departmentName, vehicle };
}

/**
 * Resolve o condutor do acesso (pessoa identificada ou nome temporário).
 *
 * @param access Acesso.
 * @param userRepository Repositório de pessoas.
 * @returns Condutor (id + nome + telefone) ou vazio.
 */
async function resolveDriver(
  access: VehicleAccessEntity,
  userRepository: Pick<UserRepository, 'findById'>,
): Promise<AccessFicha['driver']> {
  if (access.driverUserId) {
    const user = await userRepository.findById(access.driverUserId);
    return {
      id: access.driverUserId,
      name: user?.name ?? null,
      phone: user?.phone ?? null,
    };
  }
  if (access.temporaryDriverName) {
    return { id: null, name: access.temporaryDriverName, phone: null };
  }
  return { id: null, name: null, phone: null };
}

/**
 * Resolve o nome do setor confirmado na entrada.
 *
 * @param departmentId Setor do acesso (ou `null`).
 * @param companyId Empresa da sessão.
 * @param sources Repositórios.
 * @returns Nome do setor ou `null`.
 */
async function resolveDepartmentName(
  departmentId: string | null,
  companyId: string,
  sources: AccessFichaSources,
): Promise<string | null> {
  if (!departmentId) {
    return null;
  }
  const department = await sources.departmentRepository.findByIdAndCompanyId(
    departmentId,
    companyId,
  );
  return department?.name ?? null;
}

/**
 * Resolve o veículo cadastrado do acesso.
 *
 * @param vehicleId Veículo do acesso (ou `null` — placa temporária).
 * @param companyId Empresa da sessão.
 * @param sources Repositórios.
 * @returns Veículo da ficha ou `null`.
 */
async function resolveVehicle(
  vehicleId: string | null,
  companyId: string,
  sources: AccessFichaSources,
): Promise<AccessFichaVehicle | null> {
  if (!vehicleId) {
    return null;
  }
  const vehicle = await sources.vehicleRepository.findByIdAndCompanyId(
    vehicleId,
    companyId,
  );
  if (!vehicle) {
    return null;
  }
  return {
    id: vehicle.id,
    plate: vehicle.plate,
    model: vehicle.model,
    color: vehicle.color,
    vehicleType: vehicle.vehicleType,
    freePass: vehicle.freePass,
  };
}

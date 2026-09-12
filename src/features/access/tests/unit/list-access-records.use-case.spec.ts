// NestJS
import { Test } from '@nestjs/testing';

// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';

// Constants
import { UserType } from '../../../auth/domain/constants/user-type.constant';
import { AccessRecordKind } from '../../domain/constants/access.constant';
import { EntryDenialReason } from '../../../blocks/domain/constants/block.constant';

// DTOs
import { ListAccessRecordsInputDto } from '../../application/dto/list-access-records-input.dto';

// Use case
import { ListAccessRecordsUseCase } from '../../application/use-cases/list-access-records.use-case';

// Repositories (tokens)
import { ACCESS_RECORD_REPOSITORY } from '../../domain/repositories/access-record.repository';
import { ENTRANCE_REPOSITORY } from '../../../entrances/domain/repositories/entrance.repository';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { AccessRecordEntity } from '../../domain/entities/access-record.entity';
import type { EntranceEntity } from '../../../entrances/domain/entities/entrance.entity';
import type { AccessRecordRepository } from '../../domain/repositories/access-record.repository';
import type { EntranceRepository } from '../../../entrances/domain/repositories/entrance.repository';

describe('ListAccessRecordsUseCase', () => {
  let useCase: ListAccessRecordsUseCase;

  const accessRecordRepoMock = {
    list: jest.fn(),
  } as jest.Mocked<Pick<AccessRecordRepository, 'list'>>;

  const entranceRepoMock = {
    list: jest.fn(),
  } as jest.Mocked<Pick<EntranceRepository, 'list'>>;

  const actor: AuthenticatedUserEntity = {
    id: '30000000-0000-0000-0000-000000000002',
    companyId: '10000000-0000-0000-0000-000000000001',
    email: 'porteiro@somar.local',
    name: 'Porteiro Silva',
    type: UserType.EMPLOYEE,
    isAdmin: false,
    roleCodes: ['Portaria'],
    permissions: [PermissionCode.REGISTER_ENTRY],
  };

  const entrance: EntranceEntity = {
    id: '60000000-0000-0000-0000-000000000001',
    companyId: actor.companyId,
    name: 'Portaria Principal',
    isActive: true,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  };

  const entryRecord: AccessRecordEntity = {
    id: '70000000-0000-0000-0000-000000000001',
    kind: AccessRecordKind.ENTRY,
    plate: 'ABC1D23',
    driverName: 'Ana Motorista',
    vehicleModel: 'Onix',
    departmentName: 'Recepção',
    entranceName: 'Portaria Principal',
    doormanName: 'Porteiro Silva',
    reason: null,
    observation: null,
    occurredAt: new Date('2026-09-12T10:00:00.000Z'),
    accessId: '70000000-0000-0000-0000-000000000010',
  };

  const denialRecord: AccessRecordEntity = {
    id: '80000000-0000-0000-0000-000000000001',
    kind: AccessRecordKind.DENIAL,
    plate: 'XYZ9A99',
    driverName: null,
    vehicleModel: null,
    departmentName: null,
    entranceName: 'Portaria Principal',
    doormanName: 'Porteiro Silva',
    reason: EntryDenialReason.UNREGISTERED,
    observation: 'Placa desconhecida',
    occurredAt: new Date('2026-09-12T09:00:00.000Z'),
    accessId: null,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    accessRecordRepoMock.list.mockResolvedValue({
      data: [entryRecord, denialRecord],
      count: 2,
    });
    entranceRepoMock.list.mockResolvedValue({ data: [entrance], count: 1 });

    const module = await Test.createTestingModule({
      providers: [
        ListAccessRecordsUseCase,
        { provide: ACCESS_RECORD_REPOSITORY, useValue: accessRecordRepoMock },
        { provide: ENTRANCE_REPOSITORY, useValue: entranceRepoMock },
      ],
    }).compile();
    useCase = module.get(ListAccessRecordsUseCase);
  });

  it('devolve o feed no envelope padrão com os registros mapeados', async () => {
    const result = await useCase.execute(
      actor,
      new ListAccessRecordsInputDto(undefined, 'ABC1D23'),
    );

    expect(accessRecordRepoMock.list).toHaveBeenCalledWith(actor.companyId, {
      kind: undefined,
      plate: 'ABC1D23',
      dateFrom: undefined,
      dateTo: undefined,
      entranceId: undefined,
      doormanId: undefined,
      limit: 20,
      offset: 0,
    });
    expect(result).toMatchObject({ limit: 20, offset: 0, count: 2 });
    expect(result.data[0]).toMatchObject({
      id: entryRecord.id,
      kind: 'ENTRY',
      plate: 'ABC1D23',
      driverName: 'Ana Motorista',
      vehicleModel: 'Onix',
      departmentName: 'Recepção',
      entranceName: 'Portaria Principal',
      doormanName: 'Porteiro Silva',
      reason: null,
      occurredAt: '2026-09-12T10:00:00.000Z',
      accessId: entryRecord.accessId,
    });
    expect(result.data[1]).toMatchObject({
      kind: 'DENIAL',
      reason: EntryDenialReason.UNREGISTERED,
      observation: 'Placa desconhecida',
      accessId: null,
      occurredAt: '2026-09-12T09:00:00.000Z',
    });
  });

  it('normaliza a placa do filtro', async () => {
    await useCase.execute(
      actor,
      new ListAccessRecordsInputDto(undefined, ' abc-1d23 '),
    );

    expect(accessRecordRepoMock.list).toHaveBeenCalledWith(
      actor.companyId,
      expect.objectContaining({ plate: 'ABC1D23' }),
    );
  });

  it('não filtra por placa quando o termo é vazio', async () => {
    await useCase.execute(
      actor,
      new ListAccessRecordsInputDto(undefined, '   '),
    );

    expect(accessRecordRepoMock.list).toHaveBeenCalledWith(
      actor.companyId,
      expect.objectContaining({ plate: undefined }),
    );
  });

  it('repassa os filtros de tipo, período, portaria e porteiro', async () => {
    const dateFrom = new Date('2026-09-01T00:00:00.000Z');
    const dateTo = new Date('2026-09-30T23:59:59.000Z');

    await useCase.execute(
      actor,
      new ListAccessRecordsInputDto(
        AccessRecordKind.DENIAL,
        undefined,
        dateFrom,
        dateTo,
        entrance.id,
        actor.id,
        50,
        10,
      ),
    );

    expect(accessRecordRepoMock.list).toHaveBeenCalledWith(actor.companyId, {
      kind: AccessRecordKind.DENIAL,
      plate: undefined,
      dateFrom,
      dateTo,
      entranceId: entrance.id,
      doormanId: actor.id,
      limit: 50,
      offset: 10,
    });
  });

  it('devolve as portarias ativas como parâmetro de filtro', async () => {
    const result = await useCase.execute(
      actor,
      new ListAccessRecordsInputDto(),
    );

    expect(entranceRepoMock.list).toHaveBeenCalledWith(actor.companyId, {
      isActive: true,
      limit: 100,
      offset: 0,
    });
    expect(result.parameters).toEqual([
      {
        key: 'entrance_id',
        label: 'Portaria',
        allowed_values: [{ id: entrance.id, name: entrance.name }],
      },
    ]);
  });

  it('mantém o envelope quando não há registros', async () => {
    accessRecordRepoMock.list.mockResolvedValue({ data: [], count: 0 });

    const result = await useCase.execute(
      actor,
      new ListAccessRecordsInputDto(),
    );

    expect(result.data).toEqual([]);
    expect(result.count).toBe(0);
  });

  it('não expõe a entidade crua (ocorrido em vira ISO e o motivo é o enum)', async () => {
    const result = await useCase.execute(
      actor,
      new ListAccessRecordsInputDto(),
    );

    expect(typeof result.data[0].occurredAt).toBe('string');
    expect(Object.keys(result.data[0]).sort()).toEqual(
      [
        'accessId',
        'departmentName',
        'doormanName',
        'driverName',
        'entranceName',
        'id',
        'kind',
        'observation',
        'occurredAt',
        'plate',
        'reason',
        'vehicleModel',
      ].sort(),
    );
  });
});

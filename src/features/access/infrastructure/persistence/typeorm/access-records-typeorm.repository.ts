// NestJS
import { Injectable } from '@nestjs/common';

// TypeORM
import { DataSource } from 'typeorm';

// Constants
import { AccessRecordKind } from '../../../domain/constants/access.constant';

// Types
import type { EntryDenialReason } from '../../../../blocks/domain/constants/block.constant';
import type { AccessRecordEntity } from '../../../domain/entities/access-record.entity';
import type {
  AccessRecordRepository,
  ListAccessRecordsRepositoryFilters,
} from '../../../domain/repositories/access-record.repository';

/**
 * União dos dois ledgers da portaria (`vehicle_movement` + `entry_denial`) —
 * ADR 0015. A linha do tempo nasce pronta para a tela: os nomes (veículo,
 * departamento, portaria, porteiro e condutor) são resolvidos por `LEFT JOIN`,
 * porque o feed é operacional e não deve exigir N chamadas do cliente.
 *
 * Colunas em camelCase (`AS "driverName"`) para o mapeamento ser direto; o
 * `$1` é sempre o `company_id` (todas as condições entram depois dele).
 */
const ACCESS_RECORDS_UNION_SQL = `
  SELECT
    m."id" AS "id",
    m."type"::text AS "kind",
    m."plate_snapshot" AS "plate",
    COALESCE(mu."name", au."name", va."temporary_driver_name") AS "driverName",
    v."model" AS "vehicleModel",
    d."name" AS "departmentName",
    en."name" AS "entranceName",
    dm."name" AS "doormanName",
    NULL::text AS "reason",
    NULL::text AS "observation",
    m."occurred_at" AS "occurredAt",
    m."access_id" AS "accessId",
    m."entrance_id" AS "entranceId",
    m."doorman_id" AS "doormanId"
  FROM "vehicle_movement" m
  LEFT JOIN "vehicle" v ON v."id" = m."vehicle_id"
  LEFT JOIN "department" d ON d."id" = m."department_id"
  LEFT JOIN "entrance" en ON en."id" = m."entrance_id"
  LEFT JOIN "user" dm ON dm."id" = m."doorman_id"
  LEFT JOIN "vehicle_access" va ON va."id" = m."access_id"
  LEFT JOIN "user" mu ON mu."id" = m."driver_user_id"
  LEFT JOIN "user" au ON au."id" = va."driver_user_id"
  WHERE m."company_id" = $1

  UNION ALL

  SELECT
    ed."id" AS "id",
    '${AccessRecordKind.DENIAL}' AS "kind",
    ed."plate_snapshot" AS "plate",
    NULL::text AS "driverName",
    NULL::text AS "vehicleModel",
    NULL::text AS "departmentName",
    en."name" AS "entranceName",
    dm."name" AS "doormanName",
    ed."reason"::text AS "reason",
    ed."observation" AS "observation",
    ed."occurred_at" AS "occurredAt",
    NULL::uuid AS "accessId",
    ed."entrance_id" AS "entranceId",
    ed."doorman_id" AS "doormanId"
  FROM "entry_denial" ed
  LEFT JOIN "entrance" en ON en."id" = ed."entrance_id"
  LEFT JOIN "user" dm ON dm."id" = ed."doorman_id"
  WHERE ed."company_id" = $1
`;

/**
 * Implementação TypeORM do feed de registros (ADR 0015).
 *
 * Usa SQL cru porque a operação é uma **união de dois ledgers** com filtros
 * aplicados sobre o resultado da união (e não em cada lado isoladamente) — o
 * que não se expressa bem no query builder.
 */
@Injectable()
export class AccessRecordsTypeormRepository implements AccessRecordRepository {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Lista os registros da empresa, mais recente primeiro.
   *
   * @param companyId Empresa da sessão.
   * @param filters Filtros e paginação.
   * @returns Dados da página e total sem paginação.
   */
  public async list(
    companyId: string,
    filters: ListAccessRecordsRepositoryFilters,
  ): Promise<{ data: AccessRecordEntity[]; count: number }> {
    const params: unknown[] = [companyId];
    const conditions: string[] = [];

    if (filters.kind) {
      params.push(filters.kind);
      conditions.push(`"kind" = $${params.length}`);
    }
    if (filters.plate) {
      params.push(`%${filters.plate}%`);
      conditions.push(`"plate" ILIKE $${params.length}`);
    }
    if (filters.dateFrom) {
      params.push(filters.dateFrom);
      conditions.push(`"occurredAt" >= $${params.length}`);
    }
    if (filters.dateTo) {
      params.push(filters.dateTo);
      conditions.push(`"occurredAt" <= $${params.length}`);
    }
    if (filters.entranceId) {
      params.push(filters.entranceId);
      conditions.push(`"entranceId" = $${params.length}`);
    }
    if (filters.doormanId) {
      params.push(filters.doormanId);
      conditions.push(`"doormanId" = $${params.length}`);
    }

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRows = await this.dataSource.query<{ count: number }[]>(
      `WITH records AS (${ACCESS_RECORDS_UNION_SQL})
       SELECT COUNT(*)::int AS "count" FROM records ${where}`,
      params,
    );

    const rows = await this.dataSource.query<Record<string, unknown>[]>(
      `WITH records AS (${ACCESS_RECORDS_UNION_SQL})
       SELECT * FROM records ${where}
       ORDER BY "occurredAt" DESC, "id" DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, filters.limit, filters.offset],
    );

    return {
      data: rows.map((row) => this.toDomain(row)),
      count: countRows[0]?.count ?? 0,
    };
  }

  /**
   * Mapeia a linha da consulta para a entidade de domínio.
   *
   * @param row Linha crua da união.
   * @returns Registro do feed.
   */
  private toDomain(row: Record<string, unknown>): AccessRecordEntity {
    return {
      id: String(row.id),
      kind: row.kind as AccessRecordKind,
      plate: String(row.plate),
      driverName: (row.driverName as string | null) ?? null,
      vehicleModel: (row.vehicleModel as string | null) ?? null,
      departmentName: (row.departmentName as string | null) ?? null,
      entranceName: (row.entranceName as string | null) ?? null,
      doormanName: (row.doormanName as string | null) ?? null,
      reason: (row.reason as EntryDenialReason | null) ?? null,
      observation: (row.observation as string | null) ?? null,
      occurredAt:
        row.occurredAt instanceof Date
          ? row.occurredAt
          : new Date(String(row.occurredAt)),
      accessId: (row.accessId as string | null) ?? null,
    };
  }
}

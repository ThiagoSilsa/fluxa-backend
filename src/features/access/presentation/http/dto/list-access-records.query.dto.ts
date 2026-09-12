// class-transformer
import { Transform, Type } from 'class-transformer';

// class-validator
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

// Constants
import { AccessRecordKind } from '../../../domain/constants/access.constant';

// Shared
import { UUID_ANY_VERSION_PATTERN } from '../../../../../shared/validators/uuid.pattern';

/**
 * Query do feed de registros da portaria (apresentação — ADR 0015).
 */
export class ListAccessRecordsQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(AccessRecordKind)
  kind?: AccessRecordKind;

  /** Placa (parcial — normalizada na aplicação). */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  plate?: string;

  /** Início do período (ISO) sobre o momento do evento. */
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  /** Fim do período (ISO) sobre o momento do evento. */
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  /** Portaria do device. */
  @IsOptional()
  @Matches(UUID_ANY_VERSION_PATTERN)
  entranceId?: string;

  /** Porteiro que registrou. */
  @IsOptional()
  @Matches(UUID_ANY_VERSION_PATTERN)
  doormanId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset: number = 0;
}

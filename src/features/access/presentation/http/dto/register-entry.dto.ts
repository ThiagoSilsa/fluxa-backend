// class-validator
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

// class-transformer
import { Transform, Type } from 'class-transformer';

// Constants
import { AccessRequestType } from '../../../../access-requests/domain/constants/access-request.constant';
import { UserType } from '../../../../auth/domain/constants/user-type.constant';
import { MovementSource } from '../../../domain/constants/access.constant';

// DTOs (outra feature — o bloco `request` espelha o create de solicitação)
import { AccessRequestPayloadDto } from '../../../../access-requests/presentation/http/dto/create-access-request.dto';

// Shared
import { UUID_ANY_VERSION_PATTERN } from '../../../../../shared/validators/uuid.pattern';

/**
 * Bloco `request` da entrada (ADR 0014 §5): cria a solicitação **na mesma
 * operação**, quando a liberação é uma exceção (falta cadastro ou vínculo).
 *
 * O `vehicleId`/`userId` da solicitação são preenchidos pelo servidor (veículo
 * da placa + `driverUserId` informado); o cenário é validado pelas regras da
 * própria solicitação.
 */
export class RegisterEntryRequestDto {
  @IsEnum(AccessRequestType)
  type!: AccessRequestType;

  @IsOptional()
  @IsEnum(UserType)
  userType?: UserType;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AccessRequestPayloadDto)
  payload?: AccessRequestPayloadDto;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  contactPhone?: string;

  @IsOptional()
  @Matches(UUID_ANY_VERSION_PATTERN)
  departmentId?: string;
}

/**
 * Body de registro de entrada (apresentação).
 */
export class RegisterEntryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  plate!: string;

  @IsOptional()
  @Matches(UUID_ANY_VERSION_PATTERN)
  driverUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  temporaryDriverName?: string;

  @IsOptional()
  @Matches(UUID_ANY_VERSION_PATTERN)
  departmentId?: string;

  @IsOptional()
  @Matches(UUID_ANY_VERSION_PATTERN)
  accessRequestId?: string;

  @IsOptional()
  @IsBoolean()
  overCapacity?: boolean;

  @IsOptional()
  @Matches(UUID_ANY_VERSION_PATTERN)
  idempotencyKey?: string;

  /** Origem do registro (QRCODE/APP/MANUAL; default PLATE — M4). */
  @IsOptional()
  @IsEnum(MovementSource)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? (value.toUpperCase() as MovementSource)
      : (value as MovementSource | undefined),
  )
  source?: MovementSource;

  /** Portaria do device (validada ativa na empresa — M4). */
  @IsOptional()
  @Matches(UUID_ANY_VERSION_PATTERN)
  entranceId?: string;

  /**
   * Solicitação a criar **junto** com a entrada (exceção de cadastro/vínculo —
   * ADR 0014 §5). Mutuamente exclusivo com `accessRequestId`.
   */
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => RegisterEntryRequestDto)
  request?: RegisterEntryRequestDto;
}

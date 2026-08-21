// class-transformer
import { Type } from 'class-transformer';

// class-validator
import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

// Shared
import { UUID_ANY_VERSION_PATTERN } from '../../../../../shared/validators/uuid.pattern';

// Constants
import {
  AccessRequestType,
  ContactChannel,
} from '../../../domain/constants/access-request.constant';

/** Dados do motorista no payload (usado quando será criado). */
class DriverPayloadDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  document?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;
}

/** Dados do veículo no payload (usado quando será criado). */
class VehiclePayloadDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  color?: string;
}

/** Payload da solicitação (dados para criar o que falta). */
class AccessRequestPayloadDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => DriverPayloadDto)
  driver?: DriverPayloadDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => VehiclePayloadDto)
  vehicle?: VehiclePayloadDto;
}

/**
 * Body de criação de solicitação de acesso (apresentação).
 */
export class CreateAccessRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  plate!: string;

  @IsEnum(AccessRequestType)
  type!: AccessRequestType;

  @IsOptional()
  @Matches(UUID_ANY_VERSION_PATTERN)
  vehicleId?: string;

  @IsOptional()
  @Matches(UUID_ANY_VERSION_PATTERN)
  userId?: string;

  @IsOptional()
  @IsEnum(ContactChannel)
  contactChannel?: ContactChannel;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  contactPhone?: string;

  @IsOptional()
  @Matches(UUID_ANY_VERSION_PATTERN)
  departmentId?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AccessRequestPayloadDto)
  payload?: AccessRequestPayloadDto;
}

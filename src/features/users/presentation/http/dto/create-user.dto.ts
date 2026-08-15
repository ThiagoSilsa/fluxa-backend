// class-validator
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

// Constants
import { UserType } from '../../../../auth/domain/constants/user-type.constant';

/**
 * Body de criação de usuário (apresentação).
 *
 * `name`/`password` são opcionais aqui porque o use case decide: pessoa nova
 * exige ambos; pessoa já existente **proíbe** ambos (e também
 * `phone`/`document`/`observation`) — ADR 0005 §2.
 */
export class CreateUserDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  document?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observation?: string;

  @IsEnum(UserType)
  type!: UserType;
}

// class-validator
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

// Constants
import { EntryDenialReason } from '../../../domain/constants/block.constant';

/**
 * Body de registro de impedimento (apresentação).
 */
export class RegisterEntryDenialDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  plate!: string;

  @IsEnum(EntryDenialReason)
  reason!: EntryDenialReason;

  @IsOptional()
  @IsString()
  observation?: string;
}

// class-validator
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Body de criação de bloqueio (apresentação).
 */
export class CreateBlockDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  plate!: string;

  @IsString()
  @IsNotEmpty()
  reason!: string;
}

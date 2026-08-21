// class-validator
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Body de criação de solicitação de bloqueio (apresentação — porteiro).
 */
export class CreateBlockRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  plate!: string;

  @IsString()
  @IsNotEmpty()
  reason!: string;
}

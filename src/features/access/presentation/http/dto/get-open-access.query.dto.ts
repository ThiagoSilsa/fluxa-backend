// class-validator
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Query de consulta de acesso aberto (conferência na saída).
 */
export class GetOpenAccessQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  plate!: string;
}

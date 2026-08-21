// class-validator
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Body de criação de portaria (apresentação).
 */
export class CreateEntranceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;
}

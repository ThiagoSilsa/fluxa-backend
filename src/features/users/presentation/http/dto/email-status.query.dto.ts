// class-validator
import { IsEmail } from 'class-validator';

/**
 * Query de consulta de existência de e-mail (apresentação).
 */
export class EmailStatusQueryDto {
  @IsEmail()
  email!: string;
}

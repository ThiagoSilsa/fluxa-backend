// class-validator
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Body de atualização de cargo (apresentação).
 *
 * `isAdmin` não é alterável pelo CRUD (ADR 0004) — não há campo para ele.
 */
export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

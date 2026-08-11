import { Injectable } from '@nestjs/common';
import { hashSync } from 'bcrypt';

/**
 * Gera o hash bcrypt de uma senha (nunca texto puro no banco).
 *
 * Use case de responsabilidade única (AGENTS.md): `execute()` apenas hasheia.
 */
@Injectable()
export class PasswordHashUseCase {
  private readonly saltRounds = 10;

  /**
   * Hasheia a senha em texto puro.
   *
   * @param plain Senha em texto puro.
   * @returns Hash bcrypt (`$2b$...`).
   */
  public execute(plain: string): string {
    return hashSync(plain, this.saltRounds);
  }
}

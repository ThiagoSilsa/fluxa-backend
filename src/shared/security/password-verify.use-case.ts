import { Injectable } from '@nestjs/common';
import { compareSync } from 'bcrypt';

/**
 * Compara uma senha em texto puro com um hash bcrypt (comparação constante
 * em tempo pelo bcrypt, resistente a timing attack).
 *
 * Use case de responsabilidade única (AGENTS.md): `execute()` apenas verifica.
 */
@Injectable()
export class PasswordVerifyUseCase {
  /**
   * Verifica se a senha confere com o hash armazenado.
   *
   * @param plain Senha em texto puro.
   * @param hash Hash bcrypt armazenado.
   * @returns `true` se a senha confere.
   */
  public execute(plain: string, hash: string): boolean {
    return compareSync(plain, hash);
  }
}

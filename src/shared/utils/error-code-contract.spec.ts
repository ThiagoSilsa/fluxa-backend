// Node
import { readdirSync, readFileSync, relative, statSync } from 'node:fs';
import { join } from 'node:path';

// TypeScript
import ts from 'typescript';

/**
 * Arquivo onde montar o corpo da exceção é legítimo: é a fábrica que carrega
 * `code` e `details` para o cliente (ADR 0016 §4).
 */
const EXCEPTION_FACTORY_FILE = 'validation-exception.factory.ts';

/** Raiz da varredura (o teste mora em `src/shared/utils`). */
const SOURCE_ROOT = join(__dirname, '..', '..');

/**
 * Todos os `.ts` de produção sob `src`.
 *
 * @param dir Diretório da varredura.
 * @returns Caminhos absolutos dos arquivos.
 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);

    if (statSync(path).isDirectory()) {
      return sourceFiles(path);
    }

    const isProductionFile =
      entry.endsWith('.ts') && !entry.endsWith('.spec.ts');

    return isProductionFile ? [path] : [];
  });
}

/**
 * Contrato do código derivado da mensagem (ADR 0016 §2).
 *
 * O gerador do catálogo do cliente (`npm run errors:sync` no `fluxa-frontend`)
 * deriva o código varrendo `new XxxException('<literal>')`. Uma mensagem que
 * chega por constante, variável ou template com interpolação passa despercebida
 * — o código existe em tempo de execução e chega à tela sem tradução.
 *
 * Texto que precisa de dado da requisição **não** se resolve interpolando a
 * mensagem: declare a violação com `declaredValidationException(message,
 * details)` e deixe o dado em `details`.
 */
describe('contrato do código derivado da mensagem (ADR 0016 §2)', () => {
  it('todo `new XxxException(...)` fora da fábrica recebe mensagem literal', () => {
    const offenders: string[] = [];

    for (const file of sourceFiles(SOURCE_ROOT)) {
      if (file.endsWith(EXCEPTION_FACTORY_FILE)) {
        continue;
      }

      const source = ts.createSourceFile(
        file,
        readFileSync(file, 'utf8'),
        ts.ScriptTarget.ES2022,
        true,
      );

      const visit = (node: ts.Node): void => {
        if (ts.isNewExpression(node) && node.arguments !== undefined) {
          const callee = node.expression.getText(source);
          const first = node.arguments[0];

          if (
            callee.endsWith('Exception') &&
            first !== undefined &&
            !ts.isStringLiteral(first) &&
            !ts.isNoSubstitutionTemplateLiteral(first)
          ) {
            const line =
              source.getLineAndCharacterOfPosition(first.getStart()).line + 1;

            offenders.push(`${relative(SOURCE_ROOT, file)}:${line}`);
          }
        }

        node.forEachChild(visit);
      };

      visit(source);
    }

    // A explicação do que fazer mora no nome do teste: o jest não aceita
    // mensagem no `expect` (o vitest aceita), e o diff já lista os arquivos.
    expect(offenders).toEqual([]);
  });
});

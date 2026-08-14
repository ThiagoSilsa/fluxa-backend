// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  {
    // `scripts/` é JavaScript solto de linha de comando, fora do tsconfig: sem
    // isto, apontar o eslint para lá devolve "not found by the project
    // service", que se lê como defeito de configuração e não é.
    ignores: ['eslint.config.mjs', 'dist/**', 'scripts/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      "prettier/prettier": ["error", { endOfLine: "auto" }],
    },
  },
  {
    // Acesso direto ao banco a partir de `application/` é proibido (AGENTS.md,
    // seção 3): a camada só conversa com o banco por interface de repositório
    // injetada por Symbol. A regra existe porque o padrão se espalhava por
    // cópia e nada no CI reclamava.
    files: ['src/modules/**/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'typeorm',
              message:
                'Camada de aplicação não acessa o banco: use a interface do repositório em domain/repositories, injetada por Symbol (AGENTS.md, seção 3).',
            },
            {
              name: '@nestjs/typeorm',
              message:
                'Camada de aplicação não acessa o banco: nada de @InjectRepository/@InjectDataSource aqui — injete o repositório por Symbol (AGENTS.md, seção 3).',
            },
          ],
          patterns: [
            {
              group: ['**/infrastructure/persistence/typeorm/**'],
              message:
                'Entidade ORM não entra na camada de aplicação: use a entidade de domínio devolvida pelo repositório (AGENTS.md, seção 3).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.test.ts', '**/tests/**/*.ts'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },
);

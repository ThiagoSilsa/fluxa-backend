# AGENTS.md

## 1. Stack e ambiente do projeto

- Framework: **NestJS**
- Linguagem: **TypeScript**
- Banco principal: **PostgreSQL** (ORM: TypeORM)
- Fila/cache: **Redis** (BullMQ) + Socket.IO
- Gerenciador de pacotes: **npm** (sempre rode `npm run lint` antes de terminar)
- Testes: rode `npm run test:unit -- --testPathPatterns="<feature>"` com o padrão do módulo alterado (ex.: `auth`, `access-control`, `vehicles`, `access`). **Nunca** rode o `npm test` completo sem que seja explicitamente pedido.

## 2. Arquitetura NestJS e convenções

- **Modularidade**: mantenha os módulos encapsulados. Exporte explicitamente via `exports`. Nunca use módulos globais sem necessidade.
- **Injeção de dependência**: sempre por construtor. Nunca use `ModuleRef` ou service locator para resolver dependências dinamicamente.
- **Fluxo de dados**: controllers aceitam exclusivamente DTOs e repassam para **Use Cases**. Controllers não podem conter lógica de negócio.
- **Estrutura de módulo (arquitetura em camadas)**: cada feature segue 4 camadas:
  ```
  src/features/<feature>/
  ├── application/          # Use cases, DTOs de aplicação, processors
  │   ├── dto/
  │   ├── use-cases/
  │   ├── processors/       # Handlers de jobs em background (BullMQ) + schedulers
  │   ├── events/           # Eventos (EventEmitter2)
  │   └── utils/            # Helpers puros da feature
  ├── decorators/           # Decorators Swagger da feature (api-<feature>.decorator.ts)
  ├── domain/               # Entidades de domínio e interfaces de repositório
  │   ├── constants/
  │   ├── entities/
  │   ├── ports/            # Portas para serviços externos
  │   └── repositories/     # Interfaces + Symbol tokens
  ├── infrastructure/       # Implementações TypeORM e providers DI
  │   ├── listeners/
  │   └── persistence/
  │       ├── typeorm/      # ORM entities + implementações
  │       └── providers/    # { provide: TOKEN, useExisting: Implementacao }
  ├── presentation/         # Controllers HTTP e DTOs de apresentação
  │   └── http/
  │       ├── controllers/
  │       └── dto/
  ├── tests/
  │   ├── unit/
  │   └── integration/
  └── <feature>.module.ts
  ```
- **Um controller por arquivo**: cada arquivo deve conter **exatamente 1 classe de controller**. Nunca defina múltiplos controllers no mesmo arquivo. Crie um arquivo por controller (ex.: `vehicle.controller.ts`, `access.controller.ts`).
- **Use Cases, não Services**: **não crie `@Injectable()` Services**. Lógica de negócio é implementada como **Use Cases** — classes stateless, de responsabilidade única, com um único método público (`execute()` ou `handle()`). Cada use case resolve exatamente uma operação de negócio. Nunca acumule responsabilidades em uma classe; divida em use cases distintos (ex.: `RegisterEntryUseCase`, `RegisterExitUseCase`, `ApproveAccessRequestUseCase`).
- **Nomenclatura de Use Cases**: arquivos com sufixo `.use-case.ts` (ex.: `register-entry.use-case.ts`).
- **Registro de Use Cases**: registre cada use case como provider no módulo — uma entrada de provider por use case. Não faça barrel-export de muitos use cases a partir de um único arquivo de módulo.
- **Camadas de DTO (separação de responsabilidades)**:
  - **DTOs de apresentação** (`src/features/<feature>/presentation/dto/`): usados pelos **Controllers**. Decorados com `class-validator` e `class-transformer` para validação e serialização. Acoplados ao contrato HTTP (query params, body, route params).
  - **DTOs de aplicação** (`src/features/<feature>/application/dto/`): usados pelos **Use Cases**. Classes puras (não interfaces), **sem** decorators de validação. Representam os dados tipados e já validados que o use case recebe depois que o controller validou e transformou a entrada. Definem o contrato de aplicação, independente da camada de transporte.
- **Regra**: controllers validam a entrada HTTP via DTO de apresentação → mapeiam para DTO de aplicação → chamam o use case. **Use Cases nunca referenciam DTOs de apresentação**.
- **Orquestração de Use Cases**: use cases podem injetar e chamar outros use cases para fluxos complexos (ex.: `RegisterEntryUseCase` chama `CheckVehicleBlockUseCase`, `EnforceAutoBlockUseCase`). Mantenha cada use case focado em uma única responsabilidade mesmo ao orquestrar.
- **Código transversal** vai para `src/shared/` (não pertence a nenhuma feature): `constants/`, `database/`, `decorators/`, `dto/`, `filters/`, `guards/`, `interceptors/`, `pipes/`, `queue/`, `spreadsheet/`, `throttler/`, `types/`, `utils/`, `validators/`.

## 3. Estilo de código e regras

- **Nomenclatura de arquivos**: minúsculas, kebab-case separado por pontos (ex.: `register-entry.use-case.ts`, `auth.controller.ts`).
- **Estrutura de resposta**: nunca retorne entidades cruas do banco. Use serialização ou mapeamentos explícitos para a forma de resposta desejada.
- **Mapeamento `toDomain()` do repositório**: nunca retorne ORM entities cruas do repositório. Implemente um método privado `toDomain()` para mapear registros ORM para entidades de domínio (ex.: `private toDomain(orm: OrmEntity): DomainEntity`). Isso mantém as entidades de domínio limpas de imports de ORM.
- **Segurança de tipos**: é proibido usar `any`. Tipifique explicitamente todas as respostas de use cases e retornos de repositórios com Interfaces ou Types.
- **Acesso direto a banco a partir de Use Cases é proibido**: use cases **nunca** injetam `DataSource`, usam `@InjectDataSource()` ou rodam SQL direto via `this.dataSource.query()`. Toda interação com banco deve passar exclusivamente pelos **repositórios** injetados via `@Inject(REPOSITORY_TOKEN)`. Isso mantém a camada de domínio independente da infraestrutura e facilita os testes unitários com mocks.
- **Tratamento de erros**: sempre lance exceções HTTP nativas do NestJS (ex.: `NotFoundException`, `BadRequestException`) em vez de `Error` genérico do Node.
- **Padrão de logger**: cada use case instancia um logger no nível da classe: `private readonly logger = new Logger(RegisterEntryUseCase.name)`.
- **Assinatura do Use Case**: o primeiro parâmetro de `execute()` é sempre o ator autenticado (`actor: AuthenticatedUserEntity`), seguido do DTO de entrada tipado.
- **É proibido definir tipos/classes de entrada e saída dentro do Use Case**: DTOs, inputs e results não podem ser definidos dentro do arquivo do use case. Cada DTO tem seu arquivo em `application/dto/`. Isso preserva a responsabilidade única, facilita testes unitários e evita duplicação.
- **Funções soltas em arquivos que contêm classe são proibidas**: um arquivo que declara uma classe deve conter apenas essa classe. Lógica auxiliar pertence à classe como método `private`; se o helper for genuinamente reutilizável, vai para seu próprio arquivo em `utils/` (ou `src/shared/utils/`) e é importado.

  ```ts
  // Proibido — função solta ao lado da classe
  function isScopeError(body: string): boolean { … }

  @Injectable()
  export class GoogleProvider { … }

  // Correto — método privado
  @Injectable()
  export class GoogleProvider {
    private isScopeError(body: string): boolean { … }
  }
  ```
- **Re-exportar símbolo de outro módulo é proibido**: nunca escreva `export { x } from '<outro caminho>'` para manter um caminho de import antigo vivo após mover código. Mova o símbolo e corrija todos os importadores para apontar para o novo local — incluindo testes, que se movem junto com o código que cobrem.

  Um re-export esconde onde o código realmente vive: quem segue o import chega a um arquivo que não o define, e o grep pelo símbolo encontra duas respostas. Ele também mantém silenciosamente a aresta de dependência antiga — o módulo continua parecendo depender do que não é mais seu — então o acoplamento que a movimentação pretendia remover sobrevive.

  ```ts
  // Proibido — o arquivo antigo encaminha para o novo
  // google.provider.ts
  export { sanitizeHeaderValue } from 'src/shared/utils/gmail-mime.util';

  // Correto — o símbolo tem uma casa, e os importadores apontam para ela
  // google.provider.ts importa; nada re-exporta
  import { sanitizeHeaderValue } from 'src/shared/utils/gmail-mime.util';
  ```

  Isso é sobre **encaminhar o símbolo de outro módulo**. Um barrel do próprio módulo (`src/shared/utils/index.ts`, `application/use-cases/index.ts`) que coleciona símbolos que o próprio módulo define **não** é re-export nesse sentido e continua permitido.
- **Documentação JSDoc**: todo método público de toda classe (use cases, controllers, repositórios, processors, listeners, validators, utils) **deve** ter um comentário JSDoc documentando:
  - O propósito do método;
  - `@param` para cada parâmetro (tipo e descrição);
  - `@returns` com o tipo de retorno e descrição;
  - `@throws` quando aplicável;
  - Métodos privados auxiliares e `toDomain()` também devem ser documentados para manutenibilidade;
  - Use cases **devem** documentar o método `execute()` com JSDoc completo descrevendo o fluxo, a delegação e os casos de borda.
- **Documentação Swagger**: todo método de controller **deve** ter um decorator customizado usando `applyDecorators` do `@nestjs/common` para documentar o endpoint via `@nestjs/swagger` (`@ApiOperation`, `@ApiBody`, `@ApiResponse`, `@ApiParam`, `@ApiQuery`, etc.).
  - **Onde**: crie um arquivo de decorator dedicado por módulo (ex.: `src/features/<feature>/decorators/api-<feature>.decorator.ts`).
  - **Nomenclatura**: prefixo `Api` + ação em PascalCase (ex.: `@ApiRegisterEntry()`, `@ApiListAccessRequests()`).
  - **Exemplos**:
    - `src/features/access/decorators/api-access.decorator.ts`
    - `src/features/vehicles/decorators/api-vehicles.decorator.ts`
  - **Proibido: decorators Swagger fora de controllers**. Decorators Swagger (`@ApiProperty`, `@ApiPropertyOptional`, `@ApiOperation`, `@ApiResponse`, etc.) **nunca** devem ser declarados fora de um controller — em particular, **nunca** em DTOs (de apresentação ou de aplicação) ou em suas propriedades. DTOs carregam apenas decorators `class-validator`/`class-transformer`. Toda documentação de endpoint/schema vive exclusivamente nos arquivos `api-<feature>.decorator.ts` por módulo, aplicados aos métodos dos controllers.

- **Estrutura de resposta (endpoints de listagem)**: endpoints de listagem paginada devem seguir o formato padrão:
  ```ts
  {
    limit: number;                // Quantidade de registros retornados
    offset: number;               // Offset da página
    data: T[];                    // Array dos dados da listagem
    count: number;                // Total de registros (sem paginação)
    parameters?: ParameterDto[];  // Metadados opcionais de filtros
  }
  ```
  - `limit`, `offset`, `data` e `count` no nível raiz — sem objeto `meta` aninhado.
  - `parameters` é opcional e inclui `allowed_values` com objetos completos para filtros de entidade (ex.: departamentos como `[{ id, name }]`).
  - Ver `ParameterDto` em `src/shared/dto/parameter.dto.ts` e exemplos em `buildListParameters()` dos use cases de regras.

## 4. Padrão de repositório (Domain-Driven)

- **Interface + Symbol token**: defina a interface do repositório em `domain/repositories/` e exporte um `Symbol` para injeção de DI (ex.: `export const VEHICLES_REPOSITORY = Symbol('VEHICLES_REPOSITORY')`).
- **Implementação**: a implementação TypeORM fica em `infrastructure/persistence/typeorm/` e é registrada via `useExisting` em `infrastructure/persistence/providers/`.
- **`toDomain()`**: nunca retorne ORM entities cruas. Implemente um método privado `toDomain()` para mapear registros ORM para entidades de domínio.
- **Transações**: use `this.dataSource.transaction()` para operações de escrita em múltiplas etapas (ex.: registrar ENTRY — `vehicle_movement` + `vehicle_access`).
- **Nomenclatura de métodos**: sufixo `AndCompanyId` para escopo multi-tenant (ex.: `findByIdAndCompanyId`, `updateByIdAndCompanyId`).
- **Acesso a banco pertence aos repositórios — um util NÃO deve tocar `DataSource`.** Arquivos em `application/utils/` (e qualquer outro módulo auxiliar) são funções puras sobre os dados que recebem. Nunca injetam, recebem ou importam `DataSource`, `EntityManager`, `QueryRunner` ou repositório TypeORM, e nunca escrevem SQL. Se um helper precisar de dados para decidir algo, o chamador busca via repositório e passa o dado.
- **Multi-tenant**: toda tabela tem `company_id` (exceto catálogos globais). Toda referência (`user_id`, `vehicle_id`, `role_id`, `department_id` etc.) deve pertencer ao **mesmo** `company_id` da linha — validação em nível de aplicação (use cases/repositórios), pois não é expressável em SQL puro.

## 5. Requisitos de teste

- **Testes unitários**: todo use case deve ter um `.spec.ts` correspondente cobrindo o método público e todos os casos de borda (sucesso, validação, not-found, etc.).
- **Mocks de repositório**: use `jest.fn()` e `jest.Mocked<>` com os Symbol tokens dos repositórios: `{ provide: VEHICLES_REPOSITORY, useValue: mockRepo }`.
- **Setup de teste**: use `Test.createTestingModule()` do `@nestjs/testing` para criar o módulo de teste.
- **Nunca** bata no banco em testes unitários.
- **Testes de integração**: use `supertest` para chamadas HTTP, `createIntegrationContext()` para seed e **Testcontainers** para um PostgreSQL real. Configure `jest.setTimeout(120000)` para testes de integração longos.
- **Comando**: rode `npm run test:unit -- --testPathPatterns="<feature>"` para verificar conformidade. Não rode o `npm test` completo sem ser explicitamente pedido.

## 6. Guards e permissões

- **JwtAuthGuard**: aplicado por controller com `@UseGuards(JwtAuthGuard)`. Extrai o Bearer token, verifica o JWT e popula `request.user`.
- **PermissionsGuard**: usado junto com `@RequirePermissions(PermissionCode.ACTION)` para validar permissões granulares.
- **Strings hardcoded em `@RequirePermissions()` são proibidas**: sempre use o enum `PermissionCode` importado de `src/shared/constants/access-control.constant.ts`. Nunca passe literais de string (ex.: `'MANAGE_VEHICLES'`). O enum garante type-safety, facilita refactors e evita inconsistências entre módulos.
- **Role guard**: `@RequireRoles()` para controle de acesso por papel (ex.: SUPER_ADMIN, ADMIN, PORTEIRO).
- **SUPER_ADMIN bypass**: SUPER_ADMIN ignora as verificações de permissão em rotas não-admin.
- Aplique sempre os guards no nível da classe: `@UseGuards(JwtAuthGuard, PermissionsGuard)`.

## 7. Segurança e restrições

- **Variáveis de ambiente**: nunca hardcode segredos. Injete configurações de ambiente exclusivamente via o módulo `@nestjs/config`.
- **Ações proibidas**: não modifique `main.ts` a menos que seja explicitamente orientado. Não delete arquivos de configuração existentes (`tsconfig.json`, `nest-cli.json`).

## 8. Documentação (ADRs e regras de negócio)

- **Docs antes do código**: uma feature não trivial recebe seu ADR e seu documento de regras de negócio **antes** da implementação, não depois.
- **Onde os docs vivem**:
  - ADRs: `docs/arquitetura/adr/NNNN-<slug-em-kebab-case>.md` — `NNNN` com zero à esquerda, estritamente sequencial, nunca reutilizado ou pulado.
  - Regras de negócio: `docs/produto/regras-negocio-<slug>.md`, com link de volta para o ADR.
  - Issues **nunca** são escritas dentro deste repositório — vão para o repositório de issues, sob uma pasta `<YYYY-MM-DD>/`.
- **Idioma**: os próprios documentos (ADRs, regras de negócio, issues) são escritos em português. Seus nomes de arquivo, cabeçalhos e rótulos de campo são, portanto, literais em português — reproduza-os exatamente como mostrados abaixo; fazem parte do formato, não prosa a traduzir.
- **Cabeçalho de ADR — obrigatório e idêntico em todos os ADRs**. O arquivo abre com um H1, depois um bloco de quatro linhas em texto puro e, em seguida, o cabeçalho `## Contexto`:
  ```md
  # ADR 0001 — Título curto da decisão

  Número do ADR: 0001
  Título: Título completo, mais longo e preciso que o H1
  Data: 2026-08-11
  Responsável: <nome>

  ## Contexto
  ```
  - O H1 separa o número do título curto com um travessão eme (`—`).
  - `Número do ADR` repete o número do arquivo. `Título` pode ser mais longo e específico que o H1. `Data` é a data da decisão (`YYYY-MM-DD`). `Responsável` é quem responde por ela.
  - **Texto puro: sem negrito, sem bullets, sem YAML front matter.** Não invente campos de cabeçalho — `**Status:**`, `**Relacionado:**`, `**Autor:**` e afins são proibidos. ADRs relacionados são linkados **inline na seção `## Contexto`**, nunca no cabeçalho.
  - Antes de escrever um novo ADR, abra o mais recente e copie o formato do cabeçalho verbatim.
- **Seções do corpo do ADR**, nesta ordem: `## Contexto`, `## Decisão` (com subseções `###` numeradas, uma por decisão), `## Consequências` e `## Alternativas consideradas` quando opções foram rejeitadas.

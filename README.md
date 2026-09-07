<p align="center">
  <img src="https://img.shields.io/badge/Status-Em%20desenvolvimento-FFB020?style=flat-square" alt="Status">
</p>

# Fluxa — Backend (API)

API do sistema **Fluxa** para **controle de acesso de veículos**: gestão de entradas e saídas por portaria, com suporte multi-empresa, cargos e permissões, cadastros base, dispositivos (tablet do porteiro), emissão de QR code e importação em lote por planilha.

> Este repositório contém **apenas o backend** do Fluxa. Documentação do produto (ADRs, regras de negócio e modelagem) em [`docs/arquitetura/`](#-documentação-do-projeto).

---

## 🧰 Stack e tecnologias

![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Swagger](https://img.shields.io/badge/Swagger-85EA2D?style=for-the-badge&logo=swagger&logoColor=white)
![Jest](https://img.shields.io/badge/Jest-C21325?style=for-the-badge&logo=jest&logoColor=white)

| Tecnologia | Versão | Finalidade |
|---|---|---|
| **NestJS** | ^11 | Framework HTTP (controllers + injeção de dependência) |
| **TypeScript** | ^5.7 | Linguagem (modo estrito) |
| **PostgreSQL** | 16 (Docker) | Banco de dados relacional |
| **TypeORM** | — | ORM, migrações e seeds |
| **Redis** | 7 (Docker) | Fila BullMQ e cache |
| **BullMQ** | ^6 | Processamento assíncrono (importações por planilha) |
| **Socket.IO** | — | Comunicação em tempo real |
| **JWT** (`@nestjs/jwt`) | ^11 | Autenticação de sessão (Bearer) |
| **bcrypt** | ^6 | Hash de senhas |
| **class-validator / class-transformer** | — | Validação e transformação de DTOs |
| **exceljs** | ^4 | Leitura de planilhas (XLSX) na importação |
| **@nestjs/swagger** | ^11 | Documentação OpenAPI em `/api` |
| **Jest + Testcontainers** | — | Testes unitários, de integração e e2e |
| **npm** | — | Gerenciador de pacotes |

---

## ✨ O que este projeto faz

O backend expõe uma **API REST multi-empresa** organizada em features independentes:

| Feature | Responsabilidade |
|---|---|
| `auth` | Login JWT, troca de empresa e validação de sessão (multi-tenant) |
| `users` | Gestão de usuários (identidade + vínculo com empresa + cargos) |
| `roles` | Cargos e permissões (RBAC) |
| `departments` | Cadastro base de departamentos |
| `entrances` | Cadastro base de portarias |
| `vehicles` | Veículos, tipos de veículo, motoristas e **QR code** por veículo |
| `devices` | Dispositivos do porteiro (token de acesso, suspensão) |
| `blocks` | Bloqueios de veículos, impedimentos e solicitações de bloqueio |
| `access-requests` | Solicitações de acesso de veículos/motoristas não cadastrados |
| `access` | Registro de **entrada/saída** e ocupação (fluxo central do produto) |
| `imports` | Histórico e status dos jobs de importação por planilha |

Os fluxos de negócio e decisões que definem cada feature estão documentados em [`docs/arquitetura/`](#-documentação-do-projeto).

---

## 📁 Estrutura do projeto

```
src/
├── main.ts                       # Bootstrap: Nest + Swagger (/api) + CORS
├── app.module.ts                 # Módulo raiz
├── features/                     # Um diretório por feature/domínio
│   └── <feature>/
│       ├── application/          # Use cases, DTOs de aplicação, processors (BullMQ)
│       ├── decorators/           # Decorators Swagger da feature
│       ├── domain/               # Entidades de domínio, ports e repositórios (Symbol tokens)
│       ├── infrastructure/       # Implementação TypeORM + providers de DI
│       ├── presentation/http/    # Controllers e DTOs HTTP
│       ├── tests/unit|integration/
│       └── <feature>.module.ts
├── shared/                       # Código transversal (database, guards, queue, security…)
│   └── database/typeorm/
│       ├── migrations/           # Migrações versionadas (TypeORM)
│       ├── seeds/                # Seeds idempotentes (permissões, cargos padrão)
│       └── config/               # Datasources (typeorm / seed)
└── test/                         # Testes e2e e suporte
```

**Convenções de arquitetura** (use cases, DDD com repositórios por `Symbol`, multi-tenant por `company_id`, padrões de teste, ADR antes do código) estão descritas no [`AGENTS.md`](./AGENTS.md) — leia antes de contribuir.

---

## 🚀 Como rodar o projeto

### Pré-requisitos

- **Node.js** LTS e **npm**
- **Docker** e **Docker Compose** (para o banco de dados e o Redis)

### 1. Instale as dependências

```bash
npm install
```

### 2. Suba a infraestrutura (PostgreSQL + Redis)

```bash
docker compose up -d
```

Os contêineres (`postgres:16-alpine` e `redis:7-alpine`) sobem nas portas padrão definidas no `.env`. Para derrubar: `docker compose down`.

### 3. Configure as variáveis de ambiente

```bash
cp .env.example .env
```

Principais variáveis: `PORT`, `DB_HOST`/`DB_PORT`/`DB_USERNAME`/`DB_PASSWORD`/`DB_NAME`, `REDIS_HOST`/`REDIS_PORT`, `JWT_SECRET`/`JWT_EXPIRES_IN` e as credenciais do administrador inicial (`ADMIN_DEFAULT_EMAIL`/`ADMIN_DEFAULT_PASSWORD`).

### 4. Aplique as migrações e as seeds

```bash
npm run db:migration:run   # cria o schema no banco
npm run db:seed:run        # dados iniciais (permissões, cargos padrão, admin)
```

> Veja a seção [Migrações e seeds](#-migrações-e-seeds) para detalhes.

### 5. Inicie a API em modo desenvolvimento

```bash
npm run start:dev
```

A API sobe em `http://localhost:3000` (ou na `PORT` definida). A documentação **Swagger/OpenAPI** fica em `http://localhost:3000/api` (autenticação Bearer).

---

## 🗄️ Migrações e seeds

O schema é versionado por **migrações TypeORM** (SQL versionado), localizadas em `src/shared/database/typeorm/migrations/`. As **seeds** (dados iniciais) ficam em `src/shared/database/typeorm/seeds/` e são idempotentes.

| Comando | Descrição |
|---|---|
| `npm run db:migration:run` | Aplica as migrações pendentes |
| `npm run db:migration:revert` | Desfaz a última migração aplicada |
| `npm run db:migration:show` | Lista as migrações aplicadas/pendentes |
| `npm run db:seed:run` | Executa as seeds (permissões, cargos padrão, admin inicial) |
| `npm run db:seed:revert` | Desfaz a última seed executada |

> **Como funcionam os comandos:** eles usam o datasource **compilado** (`dist/…/typeorm.datasource.js`) quando o projeto já foi buildado; caso contrário, executam automaticamente o datasource em TypeScript via `ts-node`. Para forçar o caminho compilado, rode `npm run build` antes.

> **Antes de rodar migrações/seeds** o banco precisa estar no ar (`docker compose up -d`).

---

## 🧪 Testes

| Camada | Comando | Observação |
|---|---|---|
| Unitários | `npm run test:unit` | Por feature: `npm run test:unit -- --testPathPatterns="<feature>"` |
| Integração | `npm run test:integration` | Requer Docker (Postgres via Testcontainers + migrations/seeds reais) |
| E2E | `npm run test:e2e` | — |
| Cobertura | `npm run test:cov` | — |

Outros comandos: `npm run lint`, `npm run format`, `npm run typecheck`, `npm run build`, `npm run start:prod`.

---

## 📚 Documentação do projeto

Todo o conhecimento do produto e da arquitetura vive em [`docs/arquitetura/`](./docs/arquitetura), organizado em três camadas:

### 1. ADRs — decisões de arquitetura (`docs/arquitetura/adr/`)

Registro das decisões arquiteturais e dos contratos do sistema, numerados sequencialmente (`NNNN-<slug>.md`), cada um com **Contexto → Decisão → Consequências**

### 2. Regras de negócio (`docs/arquitetura/produto/`)

Regras de produto por domínio (`regras-negocio-<slug>.md`), cada uma com link de volta ao ADR correspondente

### 3. Modelagem (`docs/arquitetura/modelagem/`)

Modelo de dados com **diagramas ER (Mermaid)**:

### Padrão de trabalho

Features não triviais nascem com **ADR + regras de negócio antes da implementação** ("docs antes do código"). As convenções de contribuição estão no [`AGENTS.md`](./AGENTS.md).

---

## 📄 Licença

Distribuído sob a licença **MIT** — veja o arquivo [`LICENSE`](./LICENSE).

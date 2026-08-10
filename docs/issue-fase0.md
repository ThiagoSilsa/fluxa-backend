---
name: Feature Request
description: Solicite uma nova funcionalidade com foco em valor, escopo e validação
title: "[Feature] Fase 0 — Fundação do back-end (somar-backend)"
labels: ["feature"]
type: "Feature"
---

Use este formulário para descrever uma nova funcionalidade de forma clara, testável e orientada a valor.

### Título resumido

Fundação do back-end: ambiente de desenvolvimento, banco + fila, autenticação e RBAC base.

### Contexto

O sistema SOMAR (controle de acesso de veículos) está iniciando. O back-end precisa de uma base sólida e multi-tenant antes de qualquer feature de negócio: repositório configurado, ambiente de desenvolvimento (Postgres + Redis), camada de persistência e autenticação. Hoje o repositório `fluxa-backend` tem apenas o scaffold inicial do NestJS, sem banco conectado, sem autenticação e sem CI.

### Objetivo

O objetivo é estabelecer a fundação do back-end (NestJS + TypeScript + PostgreSQL/TypeORM + Redis/BullMQ) com autenticação JWT e RBAC base, para que as próximas fases (cadastros, fluxo de acesso, sync) sejam construídas sobre uma base consistente, testável e multi-tenant — começando pela SOMAR, mas escalável para outro órgão.

### User Story

Como desenvolvedor do back-end,
quero uma base configurada (ambiente, banco, fila, autenticação e RBAC),
para construir as features de negócio de forma consistente e multi-tenant, sem retrabalho de infraestrutura.

### Situação atual

Atualmente o repositório `fluxa-backend` possui apenas o scaffold inicial do NestJS: sem banco de dados configurado, sem fila (Redis/BullMQ), sem autenticação, sem seeds, sem validação de ambiente e sem CI — não é possível iniciar nenhuma feature de negócio.

### Comportamento esperado

Ao final da fase 0, o back-end deve:
- Subir localmente com **Postgres + Redis** via `docker-compose`;
- Validar variáveis de ambiente no bootstrap (falha explícita se faltar algo);
- Expor **Swagger/OpenAPI** como contrato (base para o cliente tipado de web/app);
- Ter **TypeORM** conectado com **migração inicial (`0001`)** aplicada;
- Ter **seeds**: company padrão, roles/permissões iniciais e usuário **admin inicial**;
- Autenticar por **e-mail e senha** gerando **JWT**;
- Proteger rotas com **`JwtAuthGuard` + `PermissionsGuard`** usando `PermissionCode` (nunca string literal);
- Ter **CI básico** (lint + typecheck + testes) rodando no repositório.

### Critérios de aceitação

- [ ] Repositório com estrutura NestJS + TypeScript; `eslint`, `prettier` e `tsconfig` configurados e rodando (`npm run lint`, `npm run test`)
- [ ] `docker-compose` com Postgres + Redis; `.env` e `.env.example` documentados
- [ ] Validação de variáveis de ambiente no bootstrap (falha clara se ausente/errada)
- [ ] TypeORM conectado e migração `0001` aplicada (comandos de migração documentados)
- [ ] Seeds executáveis: `company` padrão, roles/permissões iniciais e usuário `admin` inicial
- [ ] `POST /auth/login` (email/senha) retorna JWT válido; senha armazenada apenas como hash (bcrypt/argon2)
- [ ] Rota de exemplo protegida com `JwtAuthGuard` + `PermissionsGuard` + `@RequirePermissions(PermissionCode.X)`
- [ ] Swagger/OpenAPI acessível e descrevendo os endpoints existentes
- [ ] CI básico (lint + typecheck + testes) verde no push
- [ ] Testes unitários de auth: login com sucesso, senha inválida, token inválido, guard negando sem permissão

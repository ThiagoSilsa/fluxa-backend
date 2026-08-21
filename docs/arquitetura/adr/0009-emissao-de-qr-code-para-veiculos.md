# ADR 0009 — Emissão de QR code para veículos

Número do ADR: 0009
Título: Emissão e resolução de QR code permanente por veículo: feature dentro de vehicles usando a tabela vehicle_qr_code existente (sem migration), fluxo emitir/reimprimir/reemitir/revogar com PRINT_QRCODE e resolução pelo código (REGISTER_ENTRY, 410 para QR expirado)
Data: 2026-08-21
Responsável: Thiago

## Contexto

O SOMAR exige **QR code permanente por veículo cadastrado** (requisito do [planejamento-geral](../../../../../../planejamento/planejamento-geral.md)): o QR é impresso e colado no veículo, permite que o porteiro recupere os dados do veículo de forma simples e rápida (app ainda em desenvolvimento), e deve continuar válido mesmo quando placa/modelo/cor/proprietário mudam — o QR identifica o **veículo**, não os seus dados. A reimpressão deve ser sempre possível (a imagem não é salva; é regenerada do código).

A tabela **`vehicle_qr_code` já existe** (migration `0002` — [modelagem-controle-veiculos.md](../modelagem/modelagem-controle-veiculos.md)): `company_id`, `vehicle_id` (FK, obrigatória), `code` (varchar 64, único por empresa), `is_active` (default true), `issued_by` (FK user, auditoria), `printed_at`, timestamps; unique parcial `(company_id, vehicle_id) WHERE is_active = true` — **apenas 1 QR ativo por veículo**. As regras de negócio do QR já estão documentadas ([regras-negocio-controle-veiculos.md](../produto/regras-negocio-controle-veiculos.md) §4): QR revogado (`is_active = false`) não resolve (o app mostra "QR expirado"), reemitir gera **novo** `code` (adesivo novo), e a geração/impressão é feita pela **web** com a permissão **`PRINT_QRCODE`** (já seedada e no papel Administração — [ADR 0004](./0004-sistema-de-cargos-e-permissoes.md)). O enum `movement_source` já contém `QRCODE` (migration `0004`). O ADR 0006 §11 previa essa feature para a semana 3+; com a web pronta, decidiu-se **antecipar** a emissão/impressão (a leitura no app segue na fase do app).

Em discussão em 21/08 ficaram definidos: **usar a tabela existente** (o `code` é o token permanente — sem migration nova), implementar **dentro da feature `vehicles`** (como `user_vehicle`), fluxo **emitir / reimprimir / reemitir / revogar** (com revogação isolada além da reemissão), e o endpoint de **resolução pelo código** exigindo `REGISTER_ENTRY` (permissão do porteiro), com **410** para QR revogado (expirado) e **404** para código desconhecido/outro tenant.

Este ADR define o contrato da API de QR, o fluxo de ciclo de vida e a resolução pelo código.

## Decisão

### 1. Estrutura — dentro da feature `vehicles`

A emissão de QR vive **dentro de `src/features/vehicles/`** (afinidade de domínio, mesmo padrão de `user_vehicle`): novos use cases (`EmitVehicleQrUseCase`, `GetVehicleQrUseCase`, `ReissueVehicleQrUseCase`, `RevokeVehicleQrUseCase`, `ResolveVehicleQrUseCase`), repositório `VEHICLE_QR_REPOSITORY` (ORM entity `vehicle_qr_code` + implementação TypeORM), controller próprio (`VehicleQrController`) e DTOs. **Sem migration nova** — a tabela `vehicle_qr_code` da migration `0002` já atende integralmente.

### 2. Ciclo de vida do QR (emitir / reimprimir / reemitir / revogar)

| Ação           | Endpoint                        | Efeito                                                                                                                                                                                                             |
| -------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Emitir**     | `POST /vehicles/:id/qr`         | Gera `code` (uuid v4) + cria QR `is_active = true` com `issued_by` = ator → **201**. **409** se já houver QR ativo para o veículo (use `GET` para reimprimir o mesmo adesivo).                                     |
| **Reimprimir** | `GET /vehicles/:id/qr`          | Devolve o QR **ativo** (o mesmo `code` — a imagem é regenerada no client) → **200**; **404** se o veículo não existir/for de outro tenant; **404** se não houver QR ativo (nunca houve ou foi revogado/reemitido). |
| **Reemitir**   | `POST /vehicles/:id/qr/reissue` | **Revoga** o QR ativo atual (`is_active = false`) e cria **novo** `code` ativo (adesivo novo) → **201**.                                                                                                           |
| **Revogar**    | `POST /vehicles/:id/qr/revoke`  | Desativa o QR ativo (`is_active = false`) **sem** criar outro (ex.: adesivo comprometido) → **200**. **409** se não houver QR ativo.                                                                               |

- Todos exigem **`PRINT_QRCODE`** (`JwtAuthGuard` + `PermissionsGuard`; bypass de `is_admin` — ADR 0004 §2). Escopo pela **empresa da sessão**; veículo de outro tenant → **404** (padrão ADR 0005 §1).
- `issued_by` registra o ator autenticado em toda emissão/reemissão; `printed_at` permanece **null** (a web não informa impressão — impressão é local; auditoria futura pode usar `audit_log` com `PRINT_QRCODE`).
- Veículo **desativado** (`is_active = false`) continua podendo ter QR (a emissão não é bloqueada); a interação "revogar QR ao desativar veículo" fica como `TODO` (a desativação não revoga QR — ADR 0006 §10).

### 3. O código é o token permanente

- O `code` (uuid v4) é o **`qrToken`** do documento de referência: único por empresa, **permanente** (não muda ao editar placa/modelo/cor/proprietário), gerado de forma segura (`randomUUID`), e **revogável** (`is_active = false`).
- **Reimpressão**: o client regenera o SVG/PNG a partir do `code` (biblioteca `qrcode`) — **nenhuma imagem é salva** no banco nem em disco; o mesmo adesivo é reimprimível enquanto o QR estiver ativo.
- **Reemissão**: gera **novo** `code` (adesivo novo) e o anterior passa a "expirado" — respeitando o unique parcial de 1 QR ativo por veículo (concorrência cai no unique parcial → erro traduzido).

### 4. Resolução pelo código (consumida pelo app)

`GET /qr-codes/:code` resolve o veículo a partir do `code` lido pelo scanner — é o que o app do porteiro vai chamar ao escanear o adesivo (leitura no app é da fase do app; o contrato já fica pronto).

- Permissão: **`REGISTER_ENTRY`** (permissão do porteiro — papel Porteiro já seedado; o app usará a autenticação de device na fase do app).
- Resposta (veículo resolvido): `{ id, plate, model, color, vehicleType (resumo), freePass, isBlocked, isActive, department (resumo ou null), drivers (resumo, com canDrive) }` — os dados que o porteiro precisa para o fluxo de entrada.
- QR **revogado** (`is_active = false`, expirado) → **410 Gone** com mensagem/código que o app traduz para "**QR expirado**" (regra 28).
- `code` **desconhecido** ou de **outra empresa** → **404** (não revela existência — padrão ADR 0005 §1).

### 5. Geração da imagem no client

A imagem é gerada **no client** (web) com a biblioteca `qrcode` (SVG preferencialmente — qualidade em qualquer tamanho de impressão). O backend entrega apenas o `code`; o SVG/PNG é renderizado no dialog de QR e impresso via janela de impressão limpa (QR + placa). Nenhum endpoint serve imagem.

### 6. Fora do escopo (evolução futura)

- **Geração em lote** dos QR pós-importação de planilhas (regra 45 de usuários-empresas-permissoes; ADR 0007 §11) — evolução futura, marcada com `TODO`.
- **Leitura no app** (scanner + registro de entrada por QR com `movement_source = QRCODE`) — fase do app (semana 3+); o endpoint de resolução já fica pronto.
- Auditoria fina de impressões (`audit_log`) — versão completa.

## Consequências

- Cada veículo passa a ter um **QR permanente e reimprimível** (adesivo físico), com ciclo de vida auditado (`issued_by`) e seguro (código uuid único por empresa, revogação pontual).
- **Sem migration e sem alteração de schema**: a tabela e as regras já existiam — a feature é implementação do que estava modelado.
- A página de veículos (web) ganha a emissão/impressão no **detalhe do veículo**, restrita a `PRINT_QRCODE`.
- O contrato de resolução (`GET /qr-codes/:code`) fica pronto para o app: QR ativo resolve o veículo; revogado sinaliza "QR expirado" (410); desconhecido/outro tenant → 404.

## Alternativas consideradas

### 1. Coluna `qrToken` na tabela `vehicle` (proposta inicial)

Rejeitada: exigiria migration nova, flag de revogação e abriria mão da auditoria/reemissão já modeladas. A tabela `vehicle_qr_code` entrega exatamente o mesmo token (a coluna `code`) com revogação (`is_active`), reemissão (novo `code`) e auditoria (`issued_by`/`printed_at`) — além de já existir e estar documentada.

### 2. Feature separada `vehicle-qr-codes`

Rejeitada: o QR é fortemente acoplado ao veículo (id, dados para o fluxo de entrada) e segue o mesmo padrão de `user_vehicle` — vínculo que vive em `vehicles`. A permissão própria (`PRINT_QRCODE`) já isola o controle de acesso, sem precisar de módulo separado.

### 3. Geração/armazenamento da imagem no backend

Rejeitada: a regra já define geração/impressão pela **web** com `PRINT_QRCODE`; gerar no client (SVG) evita armazenar imagem e mantém a reimpressão instantânea (o QR é determinístico a partir do `code`).

# ADR 0016 — Código de erro como contrato da API e tradução no cliente

Número do ADR: 0016
Título: Código de erro derivado da mensagem como contrato da API, com a tradução no cliente
Data: 2026-09-17
Responsável: Thiago

## Contexto

O cliente traduz erro por **código**: `payload.code` vira chave de tradução no idioma ativo. O §7 do [ADR 0007](./0007-sistema-de-importacao-por-planilha.md) criou o `HttpErrorCodeFilter` para dar um identificador estável às respostas de erro — derivado da mensagem em runtime. O mecanismo funciona, mas tem buracos:

- **O código é subproduto do texto.** Corrigir uma frase em português muda o código e quebra a tradução sem ninguém perceber — e o código não tem cobertura de integração: a única garantia é o unit spec do filtro, enquanto 47 pontos de toast no cliente dependem dele.
- **Erro de validação de DTO não tem código.** Nenhum DTO declara `message:` e não existe `exceptionFactory`: o `class-validator` devolve `message: string[]` com as frases default **em inglês**, sem campo e sem código. O cliente cai numa mensagem genérica ("Erro de validação") em qualquer idioma, mesmo quando o problema é um campo obrigatório.
- **Resultado da portaria viaja como texto.** A resposta de entrada devolve `message` em português ("Entrada registrada.", "Entrada já registrada.", "VEÍCULO PROIBIDO DE ENTRAR") e o impedimento devolve `blockRequestError` cru. Não é erro HTTP, então o filtro não passa por ali: o cliente **adivinha** a tradução pelo texto (espelhando o algoritmo do filtro) e, quando não bate, mostra o genérico.

O cliente é quem conhece o idioma ativo e o rótulo dos campos: o texto que o usuário lê é responsabilidade dele, e o servidor precisa entregar o **identificador** e os **dados** que o texto exige. O lado do cliente está registrado no ADR 0001 do `fluxa-frontend`.

## Decisão

### 1. O código continua derivado da mensagem — e passa a ser obrigatório onde o texto varia

O `code` segue derivado da mensagem pelo mesmo algoritmo (NFD → `_` → maiúsculas), agora em **todas** as respostas cujo texto pode variar, não só nas de erro: erro de exceção, resposta de resultado de operação e erro de validação de DTO.

A consequência aceita é que a mensagem passa a fazer parte do contrato: renomear um texto existente muda o código que o cliente traduz. A convenção no `AGENTS.md` fecha o cerco — quem reescreve uma mensagem ressincroniza o catálogo do cliente.

### 2. A derivação sai do filtro e vira util compartilhado

`src/shared/utils/error-code.util.ts` concentra a derivação, usada pelo `HttpErrorCodeFilter` e pelos use cases que devolvem resultado com texto variável. O filtro continua sendo o único lugar que monta o corpo de erro.

### 3. Resposta de resultado devolve o código junto do texto

`AccessEntryResponse` ganha `code` e `RegisterDenialResponse` ganha `blockRequestErrorCode`. O `message` continua na resposta, como texto de desenvolvimento e log — o cliente para de adivinhar pelo texto e passa a ler o código.

### 4. Validação de DTO devolve campo, regra e parâmetros

`exceptionFactory` no `ValidationPipe` (registrado em `app.module.ts`), produzindo:

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": ["email must be an email"],
  "details": [
    { "field": "email", "code": "INVALID_EMAIL", "params": {} },
    { "field": "roleId", "code": "REQUIRED", "params": {} }
  ]
}
```

- `details[].field` é o **caminho pontuado** da propriedade (`payload.email` em DTO aninhado);
- `details[].code` é o **código de regra**, por superfície e não por constraint do `class-validator` — `INVALID_TYPE` cobre `IsString`, `IsInt`, `IsBoolean` e `IsObject` (o usuário lê "Valor inválido", não "deve ser string");
- `details[].params` carrega o que o texto precisa (`{ "max": 100 }`, `{ "min": 2 }`);
- o `message` original de cada violação é mantido **apenas** como texto de desenvolvimento.

Catálogo de regras: `REQUIRED`, `MAX_LENGTH`, `MIN_LENGTH`, `INVALID_EMAIL`, `INVALID_FORMAT`, `MIN_VALUE`, `MAX_VALUE`, `INVALID_TYPE`, `INVALID_VALUE`, `INVALID_DATE`.

### 5. Três pares de mensagem duplicada são consolidados

`CARGO_E_OBRIGATORIO_PARA_COLABORADOR` × `..._PARA_CRIAR_UM_COLABORADOR`, `E_MAIL_E_OBRIGATORIO_PARA_COLABORADOR` × `..._PARA_CRIAR_UM_COLABORADOR` e `APENAS_ADMINISTRADORES_PODEM_ATRIBUIR_CARGOS_DE_ADMINISTRACAO` × `..._ATRIBUIR_UM_CARGO_DE_ADMINISTRACAO` diziam o mesmo erro com textos diferentes: viram uma mensagem cada. Os 42 pares de texto parecido que descrevem erros **diferentes** ficam intactos.

### 6. A importação por planilha fica fora deste ciclo

O erro por linha é persistido em `job.errorMessage` como texto em português e renderizado cru no diálogo do job. Resolver exige `error_code` e `error_params` no job (migration, worker, mapper e diálogo) e entra como ticket próprio do mesmo plano.

Exceção ao mecanismo deste ADR: como esse texto é **persistido** (não passa pelo filtro), o código da linha é **declarado** pelo worker numa lista exportada e estável, que o gerador do cliente também varre — a derivação continua valendo só para texto que passa pelo filtro.

## Consequências

- **A mensagem de exceção passa a ser contrato.** Renomear um texto existente muda o código, quebra a tradução e deixa o usuário com a mensagem genérica. A convenção no `AGENTS.md` do backend obriga a ressincronizar o catálogo do front junto.
- **Mensagem do servidor nunca é exibida.** Em nenhum idioma: o que chega à tela é a tradução do código, com o genérico traduzido como rede quando o código ainda não tiver texto.
- **Código novo não quebra nada, mas exige tradução.** O gerador encontra a mensagem nova sozinho; sem chave nos três idiomas o teste de paridade fica vermelho (o comportamento em produção é o genérico).
- **Validação de DTO deixa de ser muda.** O cliente passa a saber _qual_ campo e _o que_ ele violou — informação que hoje se perde no array sem código.
- **O diálogo do job de importação continua em português** até o ticket da importação (limite registrado).
- **Envelope de erro documentado aqui**; os decorators `api-<feature>.decorator.ts` seguem documentando só o caminho feliz — documentar erro por endpoint não entra neste ciclo.
- **Enquanto os dois lados não subirem juntos**, o cliente novo sem o servidor novo mostra o genérico traduzido (não mostra português, não quebra): é a mesma degradação de um código ainda sem tradução.

## Alternativas consideradas

- **Código declarado (`ErrorCode` enum + exceção própria)** — rejeitada. Não exigiria tocar nos 115 pontos que lançam exceção, manteria os 126 códigos já traduzidos válidos e deixaria o código num único lugar. Declarar código significaria migrar todas as exceções e ainda assim manter o mesmo catálogo de tradução, sem ganho de UX. O preço aceito é a mensagem virar contrato.
- **Manter como está e melhorar só o mapa do cliente** — rejeitada. Não resolve o buraco maior: validação sem código e resultado de operação como texto cru, onde o cliente adivinha a tradução.
- **Código de validação genérico, sem `details`** — rejeitada. Um `VALIDATION_ERROR` sem campo nem regra mantém a mensagem genérica que motivou a mudança.
- **Código por constraint do `class-validator`** (`MUST_BE_STRING`, `MUST_BE_INT`) — rejeitada. É fiel ao backend, mas transfere o vocabulário do validador para a interface.

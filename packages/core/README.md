# @nerdlms/core

Regras de domínio da plataforma. **Sem framework**: nada aqui sabe o que é
React, Next, requisição HTTP ou banco de dados.

O teste disso não é uma promessa no README — é o `package.json`, que não declara
nenhuma dependência de runtime. Se um dia precisar de uma, vale a pergunta antes
de instalar: a regra está no lugar certo?

## O que mora aqui

| Pasta | O que é |
|---|---|
| `courses/` | progresso, catálogo, trilhas, aulas, gamificação, social, auditoria, calendário, engajamento, recomendações |
| `auth/permissions.ts` | quem pode o quê (`can`), papéis e atores |
| `validation/` | validação de entrada compartilhada entre cliente e servidor |
| `store/learner-store.js` | estado do aluno — JavaScript puro de propósito |
| `landing.ts` | conteúdo estático da landing |

## O que **não** mora aqui, e por quê

- **`session.ts`** — é `server-only`, lê variável de ambiente e devolve usuário
  do seed. Infraestrutura da aplicação, não regra de domínio.
- **`use-learner-store.ts`** — é React (`useSyncExternalStore`). A store está
  aqui; a ligação com o React fica no app.
- **`mocks/`** — existe para ser apagado quando o banco entrar.
- **Dois testes** (`catalog.test.ts` e `learner-store.test.ts`) ficaram no app:
  eles rodam sobre o catálogo fictício inteiro, e é daí que vem a garantia.
  Testar contra fixture sintético a enfraqueceria.

## Como importar

Subcaminho com extensão explícita, igual ao que o app já fazia com `@/lib/...`:

```ts
import { courseProgress } from "@nerdlms/core/courses/progress.ts";
import { can } from "@nerdlms/core/auth/permissions.ts";
```

Não há barril (`index.ts`) de propósito: importar de barril arrasta o módulo
inteiro e esconde o que cada tela realmente usa.

## Rodar

```bash
npm run typecheck --workspace @nerdlms/core
npm run test --workspace @nerdlms/core      # 200 testes, sem rede
```

O `tsconfig.json` repete as mesmas regras do app — `strict`,
`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. Regra que se afrouxa
ao mudar de pasta não é a mesma regra.

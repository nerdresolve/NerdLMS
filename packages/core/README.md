# @nerdlms/core

Regras de domínio da plataforma. **Sem framework**: nada aqui sabe o que é
React, Next, requisição HTTP ou banco de dados.

O teste disso não é uma promessa no README — é o `package.json`, que não declara
nenhuma dependência de runtime. Se um dia precisar de uma, vale a pergunta antes
de instalar: a regra está no lugar certo?

## O que mora aqui

| Pasta | O que é |
|---|---|
| `courses/` | progresso, catálogo, trilhas, aulas, conclusão, trava do player, gamificação, social, auditoria, calendário, engajamento, recomendações |
| `assessment/` | nota de 0 a 10, aprovação em 8,0, o que o aluno pode fazer com a prova, validação da decisão de reteste |
| `auth/permissions.ts` | quem pode o quê (`can`), papéis e atores |
| `ldap/` | BER, montagem de filtro, leitura das respostas do diretório, mapa de grupo para papel |
| `saml/` `sso/` | asserção SAML e assinatura, OIDC, vínculo de conta |
| `scorm/` `xapi/` `cmi5/` `lti/` `imports/` | os formatos que a plataforma importa e exporta |
| `reports/` | certificado em PDF e decodificador de PNG, escritos aqui |
| `tenancy/` | recorte por cliente e quais recursos ficam ligados |
| `validation/` | validação de entrada compartilhada entre cliente e servidor |
| `store/learner-store.js` | estado do aluno, JavaScript puro de propósito (DEC-031) |

### Por que protocolo mora no domínio

`ldap/`, `saml/` e `reports/certificate.ts` parecem infraestrutura, e não são:
não abrem conexão nem tocam disco. Eles montam e leem **bytes** — uma
`SearchRequest` em BER, uma asserção assinada, um PDF. Quem fala com a rede é o
backend; a gramática do que trafega é regra, e é testável sem nada ligado.

O ganho aparece no teste: o filtro LDAP é uma árvore BER, e por construção um
valor com parêntese **não vira estrutura**. A categoria inteira de injeção de
filtro não existe, e há teste que prova isso contra o RFC 4511, não contra o
nosso próprio codificador.

## O que **não** mora aqui, e por quê

- **`session.ts`** — é `server-only`, lê variável de ambiente e cookie.
  Infraestrutura da aplicação, não regra de domínio.
- **`use-learner-store.ts`** — é React (`useSyncExternalStore`). A store está
  aqui; a ligação com o React fica no app.
- **Dois testes** (`catalog.test.ts` e `learner-store.test.ts`) ficaram no app:
  eles rodam sobre o catálogo fictício inteiro, e essa é a garantia que o
  DEC-031 descreve. Testar contra fixture sintético enfraqueceria a garantia.

## Como importar

Subcaminho com extensão explícita:

```ts
import { courseProgress } from "@nerdlms/core/courses/progress.ts";
import { estadoDoCurso } from "@nerdlms/core/courses/completion.ts";
import { aprovado, notaFormatada } from "@nerdlms/core/assessment/retake.ts";
import { can } from "@nerdlms/core/auth/permissions.ts";
```

Não há barril (`index.ts`) de propósito: importar de barril arrasta o módulo
inteiro e esconde o que cada tela realmente usa.

## Rodar

```bash
npm run typecheck --workspace @nerdlms/core
npm run test --workspace @nerdlms/core      # 1.127 testes, sem rede
```

O `tsconfig.json` repete as mesmas regras do app — `strict`,
`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. Regra que se afrouxa
ao mudar de pasta não é a mesma regra.

# `@nerdlms/backend` — camada de servidor

Tudo que fala com o PostgreSQL e decide sessão. **Não conhece React nem Next**:
recebe dados, devolve dados.

Antes deste ciclo esta pasta tinha só um README dizendo "ainda não existe". A
autenticação mudou isso: existe banco, existe sessão, existe senha com hash.

## Estrutura

```
src/db/pool.ts                 conexão e query parametrizada
src/auth/users-repository.ts   consultas de usuário
src/auth/sessions-repository.ts sessões e tentativas de login
src/auth/login-use-case.ts     a sequência inteira do login
```

A divisão segue o que o SCE API faz entre `Service` e `Models/DTOs`: o caso de
uso concentra a regra, o repositório concentra o SQL, e o contrato (o que entra
e o que sai) mora em `@nerdlms/core/auth/login.ts`, sem saber que existe banco.

## Por que as rotas HTTP não estão aqui

Os `route.ts` continuam em `apps/frontend/src/app/api/`, e não por comodismo:
no Next a rota **é** o arquivo. Movê-los para cá faria o endpoint deixar de
existir.

Eles são cascas finas — leem o corpo, chamam o caso de uso, montam a resposta:

```ts
// apps/frontend/src/app/api/auth/login/route.ts
const outcome = await loginUseCase({ identifier, password, remember, ip, userAgent });
```

Toda a regra está deste lado. Se um dia a API sair do Next para um processo
próprio, é o `route.ts` que se joga fora, não este pacote.

## Por que não há Fastify nem Express

Quem serve HTTP hoje é o Next. Acrescentar um servidor próprio significaria
segunda imagem, segundo deploy, CORS e uma porta a mais exposta — custo real
por um ganho que ainda não existe. Este pacote é a camada **abaixo** do HTTP, e
continua válido se essa decisão mudar.

## O que ainda falta

| Área | Situação |
|---|---|
| Autenticação | **feita** — senha com scrypt, sessão no banco, bloqueio por IP |
| Progresso | pendente — a gravação de segundos assistidos ainda não existe |
| Matrícula | pendente |
| Comentários | pendente |
| Conteúdo | pendente — upload e URL assinada |
| Usuários | pendente — convite, edição, desativação |
| Relatórios | pendente |
| Auditoria | pendente — a leitura já tem tela |

**As telas ainda leem do mock.** O login vem do banco; o catálogo e o
progresso, não. `mockIdOf` em `apps/frontend/src/mocks/repository.ts` faz a
ponte enquanto os dois coexistem, e some junto com o mock.

## Regras de domínio

Não são reescritas aqui — este pacote as chama:

```
packages/core/src/courses/   progresso, catálogo, trilhas, gamificação…
packages/core/src/auth/      permissões, senha, contrato do login
```

São 215 testes, nenhum dependendo de banco, rede ou framework.

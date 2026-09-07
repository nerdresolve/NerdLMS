# Dados fictícios

Tudo que é inventado no projeto está nesta pasta.

**O papel mudou.** Enquanto o banco não existia, estes arquivos eram a fonte das
telas, e `repository.ts` era a costura que seria trocada. As telas hoje leem do
PostgreSQL — nenhuma página em `src/features/` ou `src/app/` importa daqui.

O que sobrou tem três usos, e só três:

| Arquivo | Quem usa | Para quê |
|---|---|---|
| `data.ts`, `quizzes.ts`, `seed-ids.ts` | `infra/tools/build-seed.mjs` | gerar `infra/db/seeds/hml.sql` |
| `repository.ts` | `src/lib/auth/session.ts` | resolver `NERD_DEV_ROLE` em desenvolvimento |
| `data.ts` | `catalog.test.ts`, `learner-store.test.ts` | catálogo inteiro como fixture (DEC-031) |

## O seed que sai daqui carrega cursos inventados

`build-seed.mjs` transforma este catálogo em SQL, e o SQL entra com
`ON CONFLICT DO UPDATE`. Isso significa que **`npm run seed` num banco que já
tem o conteúdo real da organização traz os cursos fictícios de volta** — sete
cursos, vinte módulos, oitenta e quatro aulas.

Num banco vazio é o caminho mais rápido para ter com quem entrar. Num banco em
uso, não rode. O conteúdo real entra por `infra/tools/import-cursos.mjs`, que é
outro caminho de propósito.

## O que é fictício aqui

| Dado | Situação |
|---|---|
| 7 cursos de operação industrial, com módulos, aulas e provas | Inventado. Os cursos reais estão em `infra/db/content/cursos.json` |
| 5 contas de papel (`user.mock`, `admin.mock`…) | Contas de demonstração, e são elas que se quer do seed |
| 8 pessoas com nome próprio, sem senha | Inventado. Existem para as telas de gestão terem gente |
| Progresso, matrículas, comentários e votos | Inventado |
| `public/media/aula-demo.mp4` | Vídeo gerado por ffmpeg, 45s |

## Se um dia isto sair

Separar as contas do conteúdo resolveria o conflito com o catálogo real: o seed
passaria a criar só gente, e `import-cursos.mjs` seguiria sendo o único caminho
de curso. É uma mudança em `build-seed.mjs`, não aqui.

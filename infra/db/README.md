# Banco de dados e ambiente

O que existe aqui e por que existe.

> **Já rodou em máquina limpa.** Os quatro defeitos que a primeira execução
> encontrou estão corrigidos: extensão `citext` faltando, variáveis de ambiente
> ausentes no serviço `migrate`, papel `lms_app` criado sem senha e a
> dependência `server-only` não declarada.

## Subir o ambiente

```bash
cp .env.example .env          # a partir de infra/
openssl rand -base64 48       # para SESSION_SECRET e senhas

npm run up        # da raiz do repositório
npm run migrate
```

A migração 002 cria o papel `lms_app` **já com a senha** de `APP_DB_PASSWORD`.
Não há passo manual de `ALTER ROLE` — se você precisou de um, é bug.

Verificar:

```bash
docker compose -f infra/docker-compose.yml ps
docker compose -f infra/docker-compose.yml exec db psql -U lms_migrator -d nerdlms -c '\dt'
```

## Por que o banco não publica porta

Nem PostgreSQL nem MinIO têm `ports:`. Só o proxy fala com a internet, e há
duas redes: `edge` (proxy ↔ app) e `internal`, marcada como `internal: true`, o
que impede saída para a internet. Banco acessível de fora é o erro mais caro e
mais comum em implantação de container.

Para inspecionar em desenvolvimento, `docker compose exec db psql` entra pela
rede interna sem abrir nada.

## Dois papéis no banco

| Papel | Usado por | Pode |
|---|---|---|
| `lms_migrator` | migração, no deploy | tudo — é o dono do schema |
| `lms_app` | a aplicação | SELECT/INSERT/UPDATE/DELETE, e nada de DDL |

A aplicação **não** usa o dono do schema. Se houver SQL injection, o estrago
fica limitado: não dá para criar, alterar ou remover tabela. E `audit_log` tem
UPDATE e DELETE revogados até para `lms_app`, com um gatilho que recusa
mesmo se alguém reconceder por engano.

## Como o schema se relaciona com o código

As regras de negócio já existem, testadas, e **não mudam** quando o banco
entrar. O que muda é de onde os dados vêm.

| Módulo de domínio | Tabelas |
|---|---|
| `progress.ts`, `outline.ts`, `lesson.ts` | `enrollments`, `lesson_progress`, `lessons` |
| `catalog.ts`, `tracks.ts` | `courses`, `modules`, `tracks`, `track_courses` |
| `engagement.ts`, `active-users.ts` | `enrollments`, `lesson_progress`, `users` |
| `social.ts` | `comments`, `comment_votes` |
| `gamification.ts` | derivado + `coin_spends` |
| `calendar.ts` | `events`, `notifications` |
| `audit.ts` | `audit_log` |
| `auth/permissions.ts` | `users.role`, `users.project`, `courses.author_id` |

A troca acontece em **um arquivo**: `apps/frontend/src/mocks/repository.ts`. É para isso que
a costura já existe.

## O que é derivado e o que é gravado

Esta é a decisão que mais protege o sistema a longo prazo.

**Derivado por consulta** — progresso de curso, percentual de trilha, moedas
ganhas, contagem de votos, orçamento semanal de votos, usuários ativos no
período. Contador gravado sai de sincronia e ninguém percebe até o relatório
sair errado.

**Gravado, porque é evento** — moedas gastas (`coin_spends`), voto dado
(`comment_votes`), progresso assistido (`lesson_progress`), tudo em
`audit_log`.

O orçamento semanal de votos, por exemplo, é `COUNT(*)` sobre `comment_votes`
na semana ISO corrente. Não há tabela de saldo — saldo gravado permite gastar
duas vezes numa corrida entre requisições.

## Convenções

- **Chave primária é UUID.** Id sequencial em URL permite enumerar; já
  respondemos 404 em vez de 403 justamente para não confirmar existência.
- **Enum é `text` + `CHECK`.** Acrescentar um papel a um ENUM nativo exige
  `ALTER TYPE` e trava a migração.
- **Instante é `timestamptz`; data de evento é `date`.** Um treinamento no dia
  26 é no dia 26 em qualquer fuso.
- **Não se apaga dado com histórico.** Usuário é desativado, curso é arquivado.
  `audit_log.actor_id` é `ON DELETE SET NULL` e guarda `actor_name` à parte: a
  saída de um funcionário não pode apagar o registro do que ele fez.
- **Toda chave estrangeira tem índice.** Não é só por consulta: `ON DELETE SET
  NULL` varre a tabela filha inteira sem ele. O verificador reprova se faltar.

## O que ainda não existe

- **Migração de rollback.** Cada arquivo aplica; nenhum desfaz. Antes de
  produção, ou há `down`, ou há política de restaurar backup — decidir qual.
- **Seed de produção.** `src/mocks/data.ts` é ficção; o catálogo real tem ~70
  cursos sociais e 6 para terceiros.
- **Importação da base atual** — origem a confirmar.
- **Particionamento de `audit_log`.** Com 27 mil pessoas a tabela cresce rápido.
  Não é problema no primeiro ano; é problema no terceiro. Anotado, não feito.

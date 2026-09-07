# Banco de dados

81 tabelas, 38 migrações aplicadas em ordem. Este arquivo explica as convenções
e as decisões que o schema sozinho não conta.

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
docker exec nerdlms-local-db-1 sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\dt"'
```

As migrações são **reaplicáveis**: rodar de novo sobre um banco já migrado não
quebra nem duplica. Foi preciso consertar isso em duas delas — `ADD CONSTRAINT`
sem `DROP CONSTRAINT IF EXISTS` antes falha na segunda execução, e falha depois
de já ter aplicado metade do arquivo.

## Por que o banco não publica porta

Nem PostgreSQL nem MinIO têm `ports:`. Só o proxy fala com a internet, e há
duas redes: `edge` (proxy ↔ app) e `internal`, marcada como `internal: true`, o
que impede saída para a internet. Banco acessível de fora é o erro mais caro e
mais comum em implantação de container.

Para inspecionar em desenvolvimento, `docker exec` entra pela rede interna sem
abrir nada.

## Dois papéis no banco

| Papel | Usado por | Pode |
|---|---|---|
| `lms_migrator` | migração, no deploy | tudo — é o dono do schema |
| `lms_app` | a aplicação | SELECT/INSERT/UPDATE/DELETE, e nada de DDL |

Os nomes vêm do cliente para quem o produto foi especificado antes desta
implantação. Continuam porque renomear papel e base é migração de
infraestrutura sem ganho nenhum para quem usa a plataforma — e com risco real
de deixar a aplicação sem conectar no meio do caminho.

A aplicação **não** usa o dono do schema. Se houver SQL injection, o estrago
fica limitado: não dá para criar, alterar ou remover tabela.

## O que não se pode reescrever

Três tabelas são **somente-inserção**, com UPDATE e DELETE revogados até para
`lms_app` e um gatilho que recusa mesmo se alguém reconceder por engano:

| Tabela | Por quê |
|---|---|
| `audit_log` | registro do que foi feito. Editável não é registro |
| `xapi_statements` | um statement xAPI é um fato declarado num instante |
| `grade_entries` | refazer a prova lança OUTRA nota; a anterior é histórico |

**Isso tem uma consequência prática que surpreende.** Não dá para apagar curso,
matrícula ou nota que já tenha uso registrado — o gatilho recusa. Para limpar o
ambiente de desenvolvimento, o caminho é recriar:

```bash
npm run down
docker volume rm nerdlms-local_db-data
npm run migrate
```

É inconveniente de propósito. O incômodo cai sobre o desenvolvedor; a garantia
protege o histórico de quem estudou.

## O que é derivado e o que é gravado

Esta é a decisão que mais protege o sistema a longo prazo.

**Derivado por consulta** — progresso de curso, percentual de trilha, moedas
ganhas, contagem de votos, orçamento semanal de votos, usuários ativos no
período. Contador gravado sai de sincronia e ninguém percebe até o relatório
sair errado.

**Gravado, porque é evento** — moedas gastas (`coin_spends`), voto dado
(`comment_votes`), progresso assistido (`lesson_progress`), tentativa de prova
(`quiz_attempts`), nota lançada (`grade_entries`), pedido de reteste
(`quiz_retake_requests`), e tudo em `audit_log`.

O orçamento semanal de votos, por exemplo, é `COUNT(*)` sobre `comment_votes`
na semana ISO corrente. Não há tabela de saldo — saldo gravado permite gastar
duas vezes numa corrida entre requisições.

**A nota é a exceção que confirma a regra.** `quiz_attempts.score_percent`
guarda o resultado da tentativa, e `grade_entries` guarda o lançamento no
boletim. Parecem o mesmo dado, e não são: o boletim é o que o certificado
consulta, e a prova com questão dissertativa só fecha a nota quando o instrutor
corrige. Houve um período em que o envio da prova não lançava em
`grade_entries`, e o resultado foi certificado impossível de emitir para quem
tirasse dez — sem nenhuma mensagem explicando.

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
  NULL` varre a tabela filha inteira sem ele. O `check:sql` reprova se faltar.
- **Regra que existe no código existe no banco.** O comentário obrigatório na
  decisão de reteste é validado no caso de uso e por um `CHECK` na migração
  038: um `INSERT` fora daquele caminho não deve gravar decisão muda.
- **Índice único parcial para "um por vez".** Um pedido de reteste em aberto
  por prova e matrícula é um `UNIQUE ... WHERE status = 'pending'`. Os
  decididos podem se acumular, porque são o histórico.

## Isolamento entre clientes

42 tabelas carregam `tenant_id`, e
`apps/backend/src/tenancy/query-isolation.test.ts` falha o build quando alguém
escreve uma consulta sem esse recorte. É a única garantia que sobrevive a quem
não leu esta página.

## O que ainda não existe

- **Migração de rollback.** Cada arquivo aplica; nenhum desfaz. Antes de
  produção, ou há `down`, ou há política de restaurar backup — decidir qual.
- **Backup em rotina.** Ver `docs/DEPLOY.md`. Os dois volumes (`db-data` e
  `storage-data`) precisam entrar na cópia: o `pg_dump` não leva os vídeos.
- **Particionamento de `audit_log`.** Não é problema no primeiro ano; é
  problema no terceiro. Anotado, não feito.

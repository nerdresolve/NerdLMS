# `infra`: ambiente

Tudo que roda a plataforma fora do código da aplicação.

```
infra/
├── docker-compose.yml   app, banco, storage e proxy
├── .env.example         modelo; copie para .env (não versionado)
├── db/
│   ├── migrations/      schema PostgreSQL, aplicado em ordem
│   ├── content/         os cursos reais, sem os vídeos
│   ├── seeds/hml.sql    dados de homologação, GERADOS (ver db/README.md)
│   └── README.md        convenções do banco e o que é derivado
├── proxy/Caddyfile      HTTPS, headers de borda e limites de corpo
└── tools/               conteúdo real, seed e verificação do SQL
```

## Subir

Da **raiz do repositório**:

```bash
cp infra/.env.example infra/.env   # e preencha os segredos
npm run up                          # sobe com o projeto `nerdlms-local`
npm run migrate                     # aplica as migrações
npm run logs                        # acompanha
```

O `.env` fica em `infra/`, ao lado do `docker-compose.yml`, e é de lá que o
compose lê as variáveis.

## Os três ambientes não se misturam

Cada script carrega o próprio `-p`, e é ele que separa os volumes. Os três já
conviveram no mesmo projeto do Compose, e o `-p` explícito é o que impede um
comando de desenvolvimento de alcançar produção:

| Comando | Projeto | Arquivos de ambiente |
|---|---|---|
| `npm run up`, `migrate`, `seed`, `logs`, `down` | `nerdlms-local` | `.env` + `.env.local` |
| `npm run up:prod`, `migrate:prod` | `nerdlms` | `.env` |
| `npm run publish`, `migrate:tunnel` | `nerdlms` | `.env` + `.env.tunnel` |

`.env.local` sobrepõe o `.env` porque o Compose lê os dois e o segundo vence. É
onde ficam os valores que divergem de produção: `SITE_ADDRESS=http://localhost`,
`MAIL_TRANSPORT=log`.

**Nunca rode `docker compose` sem `-p`.** Sem ele o Compose deduz o nome pela
pasta, e a dedução não distingue os três.

## As ferramentas

```bash
node infra/tools/parse-cursos.mjs <pasta>   # material de origem → db/content/cursos.json
node infra/tools/upload-cursos.mjs <pasta>  # vídeos → storage (522 MB)
node infra/tools/import-cursos.mjs          # cursos, aulas e provas → banco
node infra/tools/cenario-demo.mjs           # progresso para demonstrar
node infra/tools/duracao-mp4.mjs <arquivo>  # duração lida do cabeçalho MP4
npm run build:seed                          # mocks/data.ts → db/seeds/hml.sql
npm run check:sql                           # verificação estrutural das migrações
npm run check:imutabilidade                 # tenta adulterar auditoria e nota (precisa do banco de pé)
npm run check:css                           # variável CSS usada e nunca definida
```

`check:sql` lê o texto das migrações e não roda banco; `check:imutabilidade`
roda contra o banco que estiver de pé e tenta, uma a uma, cada alteração que os
gatilhos de somente-inserção devem recusar. As duas se complementam, e a
segunda existe porque a migração 040 abriu frestas nesses gatilhos para a
exclusão de conta cumprir a LGPD: fresta em gatilho de imutabilidade é fácil
de alargar sem perceber.

A exclusão de conta em si não tem tela: é `infra/tools/excluir-conta.mjs`, e o
porquê está no cabeçalho do arquivo. Desativar continua sendo o caminho normal.

`check:css` existe porque um token inexistente não dá erro: o navegador
descarta a declaração e a tela fica errada em silêncio. Foram quatro casos
achados de uma vez, todos por alguém chutar o nome do token (`--text-danger`)
em vez de olhar o do sistema (`--danger-text`).

O vídeo sobe separado do banco de propósito: ele demora e falha por rede,
enquanto o banco não. Juntar os dois faria uma falha de upload desfazer a
importação inteira.

`duracao-mp4.mjs` lê a duração do cabeçalho `mvhd` sem ffmpeg, e sabe somar
fragmentos, porque um dos vídeos da Exemplo S.A. é MP4 fragmentado e declara
duração zero no cabeçalho principal.

## Por que assim

- **Banco e storage não publicam porta.** Só o proxy fala com a internet, e a
  rede interna é `internal: true`. Banco acessível de fora é o erro mais caro
  em implantação de container.
- **A aplicação não usa o dono do schema.** `lms_migrator` migra;
  `lms_app` roda a aplicação, sem DDL. SQL injection não alcança a estrutura.
  Os nomes vêm do cliente para quem o produto foi especificado antes desta
  implantação, e continuam porque renomear papel de banco é migração sem ganho
  para quem usa a plataforma.
- **`audit_log` é somente-inserção**, com UPDATE e DELETE revogados até para a
  aplicação, e um gatilho que recusa mesmo se alguém reconceder por engano. O
  mesmo vale para `xapi_statements` e `grade_entries`.
- **O fuso é `America/Sao_Paulo`**, e a imagem instala `tzdata` para isso
  funcionar: sem o pacote, Alpine aceita a variável `TZ` e ignora o valor,
  servindo tudo em UTC sem avisar.
- **O Dockerfile vive junto do app** que ele constrói (`apps/frontend`), não
  aqui. O compose só aponta o contexto.

Detalhes de banco em [`db/README.md`](./db/README.md).

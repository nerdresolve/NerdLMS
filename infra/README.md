# `infra` — ambiente

Tudo que roda a plataforma fora do código da aplicação.

```
infra/
├── docker-compose.yml   app, banco, storage e proxy
├── .env.example         modelo; copie para .env (não versionado)
├── db/
│   ├── migrations/      schema PostgreSQL, aplicado em ordem
│   └── README.md        convenções do banco e o que ainda não rodou
├── proxy/Caddyfile      HTTPS, headers de borda e limites de corpo
└── tools/check-sql.mjs  verificação estrutural das migrações
```

## Subir

Da **raiz do repositório**:

```bash
cp infra/.env.example infra/.env   # e preencha os segredos
npm run up                          # docker compose up -d
npm run migrate                     # aplica as migrações
npm run logs                        # acompanha
```

O `.env` fica em `infra/`, ao lado do `docker-compose.yml` — é de lá que o
compose lê as variáveis.

## Por que assim

- **Banco e storage não publicam porta.** Só o proxy fala com a internet, e a
  rede interna é `internal: true`. Banco acessível de fora é o erro mais caro
  em implantação de container.
- **A aplicação não usa o dono do schema.** `lms_migrator` migra;
  `lms_app` roda a aplicação, sem DDL. SQL injection não alcança a estrutura.
- **`audit_log` é somente-inserção**, com UPDATE e DELETE revogados até para a
  aplicação, e um gatilho que recusa mesmo se alguém reconceder por engano.
- **O Dockerfile vive junto do app** que ele constrói (`apps/frontend`), não
  aqui. O compose só aponta o contexto.

Detalhes de banco em [`db/README.md`](./db/README.md).

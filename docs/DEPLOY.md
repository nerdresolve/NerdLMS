# Implantação

Três caminhos, do mais automático ao mais manual. Escolha um.

| | Para quem | O que precisa |
|---|---|---|
| [A. GitHub Actions](#a-github-actions) | quem vai atualizar com frequência | um servidor com SSH |
| [B. Compose no servidor](#b-compose-no-servidor) | primeira instalação, ou sem CI | acesso ao servidor |
| [C. Cloudflare Tunnel](#c-cloudflare-tunnel) | máquina sem IP público | conta Cloudflare |

Em todos: **Docker e Docker Compose**, 2 vCPU e 4 GB atendem ~100 usuários
simultâneos. Linux, macOS ou Windows.

---

## Antes de qualquer coisa: o `.env`

Nenhum `.env` é versionado. Copie o exemplo e **gere segredos próprios**. Não
reaproveite os de outro ambiente, nem os que estão nos exemplos.

```bash
cp infra/.env.example infra/.env

openssl rand -hex 32   # POSTGRES_PASSWORD
openssl rand -hex 32   # APP_DB_PASSWORD  (precisa entrar também na DATABASE_URL)
openssl rand -hex 32   # STORAGE_SECRET_KEY
openssl rand -hex 48   # SESSION_SECRET
```

> **Use `-hex`, não `-base64`.** O base64 emite `/`, `+` e `=`; a senha do banco
> entra dentro de uma URL, e uma barra ali encerra a autoridade, e a aplicação
> sobe e morre com `TypeError: Invalid URL`, sem dizer qual variável está errada.

Os valores que mudam por instalação:

| Variável | O que é |
|---|---|
| `SITE_ADDRESS` | o domínio que o Caddy atende. `localhost` em desenvolvimento |
| `PUBLIC_ORIGIN` | endereço público completo, usado no link do e-mail de recuperação |
| `MAIL_TRANSPORT` | `log` grava a mensagem no log; `smtp` envia de verdade |
| `SMTP_*` | só com `MAIL_TRANSPORT=smtp` |

> **`MAIL_TRANSPORT=log` em produção significa que a recuperação de senha não
> chega a ninguém.** O link fica no `npm run logs`. É adequado para
> homologação e não para uso real.

---

## A. GitHub Actions

A [Action de deploy](../.github/workflows/deploy.yml) roda os portões, publica a
imagem no GHCR e atualiza o servidor.

**No servidor**, uma vez:

```bash
git clone https://github.com/nerdresolve/NerdLMS.git /opt/nerdlms
cd /opt/nerdlms
cp infra/.env.example infra/.env   # preencha, como acima
```

**No GitHub**, em Settings → Environments → `producao`, crie os secrets:

| Secret | Exemplo |
|---|---|
| `SSH_HOST` | `lms.suaempresa.com` |
| `SSH_USER` | `deploy` |
| `SSH_KEY` | a chave **privada** (a pública vai no `authorized_keys` do servidor) |
| `SSH_PORT` | opcional, padrão `22` |
| `DEPLOY_PATH` | `/opt/nerdlms` |

Depois disso, publicar é marcar uma tag:

```bash
git tag v1.0.0 && git push origin v1.0.0
```

A Action migra o banco, troca o container e **espera o healthcheck** antes de
declarar sucesso. Se a aplicação subir quebrada, o job falha com as últimas 50
linhas do log.

> Sem os secrets de SSH, a Action publica a imagem e **pula** o deploy, sem
> erro. Um fork que só quer a imagem não vê vermelho por algo que não pediu.

### Voltar atrás

As migrações rodam **antes** da troca do container, e cada uma precisa aceitar
a versão anterior da aplicação. É isso que faz o rollback ser uma troca de tag:

```bash
docker compose -f infra/docker-compose.yml --env-file infra/.env \
  pull app && docker compose ... up -d --no-deps app
```

apontando a imagem para a tag anterior. Sem restaurar backup.

---

## B. Compose no servidor

```bash
git clone https://github.com/nerdresolve/NerdLMS.git /opt/nerdlms
cd /opt/nerdlms
cp infra/.env.example infra/.env    # preencha

npm run up        # sobe banco, storage, aplicação e proxy
npm run migrate   # aplica o schema
```

A aplicação responde em `https://$SITE_ADDRESS`. O Caddy emite certificado da
Let's Encrypt sozinho, desde que o DNS já aponte para a máquina e a porta 443
esteja acessível.

Para atualizar depois:

```bash
git pull
npm run migrate
npm run compose -- up -d --build app
```

Ou rode o mesmo script que a Action usa:

```bash
CAMINHO=/opt/nerdlms bash .github/deploy-remoto.sh
```

---

## C. Cloudflare Tunnel

Para máquina **sem IP público**, atrás de NAT, num escritório ou numa VPS sem
porta liberada. O container `cloudflared` abre a conexão de dentro para fora, e
o TLS público termina na borda da Cloudflare. Some a exigência de IP fixo, porta
aberta na entrada e certificado próprio.

```bash
cloudflared tunnel login                       # uma vez, por conta
cloudflared tunnel create nerdlms
cloudflared tunnel route dns nerdlms lms.suaempresa.com
```

Guarde o token **fora do Git** e suba:

```bash
echo "TUNNEL_TOKEN=<o-token>" > infra/.env.tunnel
npm run publish        # up -d --build, com o perfil tunnel
npm run migrate
npm run publish:logs   # acompanha
```

### As duas armadilhas

**`SITE_ADDRESS` precisa levar o esquema `http://`:**

```ini
SITE_ADDRESS=http://lms.suaempresa.com
```

Sem ele o Caddy tenta emitir certificado da Let's Encrypt para um domínio cujo
desafio ACME nunca chega até ele, porque quem atende o mundo é a Cloudflare, e
reitera para sempre. E com o domínio configurado só como `localhost`, o Caddy
recusa o Host que o túnel entrega e responde **421 Misdirected Request**, sem
log de erro que explique.

**O túnel aponta para a porta HTTP, não a HTTPS.** O TLS público termina na
borda; internamente o tráfego é texto claro dentro da própria máquina:

```yaml
ingress:
  - hostname: lms.suaempresa.com
    service: http://localhost:80      # ou a porta em HTTP_PORT
  - service: http_status:404
```

> Se você já tem outro túnel nesta máquina, cuidado com `~/.cloudflared/config.yml`:
> ele é **global** e o `cloudflared` o usa mesmo quando você nomeia outro túnel
> na linha de comando. Passe `--config` apontando para um arquivo próprio, ou o
> DNS será criado para o túnel errado.

## O domínio no certificado

O certificado PDF imprime o endereço de conferência a partir da coluna `domain`
da tabela `tenants`, **não de código**. Vazia, o rodapé imprime "Confira o
código com a área de treinamento" em vez de um endereço que não resolve.

Depois que o DNS apontar para a instalação:

```sql
UPDATE tenants SET domain = 'lms.suaempresa.com' WHERE slug = 'lms';
```

O nome impresso na linha de assinatura, quando o curso não tem instrutor
definido, também vem do tenant (coluna `name`).

---

## Conferir que subiu

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://lms.suaempresa.com/api/health
# 200

docker compose -f infra/docker-compose.yml --env-file infra/.env ps
# app, db, storage e proxy em "running"; app em "healthy"
```

Se o `app` ficar em `unhealthy`:

```bash
npm run logs
```

Causas comuns, em ordem de frequência: `DATABASE_URL` com senha diferente da do
`APP_DB_PASSWORD`, migrações não aplicadas, e `SESSION_SECRET` vazio.

---

## Backup

O que precisa sair da máquina são dois volumes: o banco e o storage.

```bash
# Banco
docker compose -f infra/docker-compose.yml --env-file infra/.env \
  exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > backup.sql.gz

# Restaurar
gunzip -c backup.sql.gz | docker compose ... exec -T db \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

O storage (vídeos e materiais) é um volume do MinIO. Para S3 real, aponte
`STORAGE_ENDPOINT` e as chaves para o provedor: a aplicação não distingue.

A plataforma também tem exportação por dentro (Administração → Backup), que
gera um pacote com o conteúdo lógico. Ela **não** substitui o `pg_dump`: serve
para levar conteúdo de uma instalação a outra, não para recuperar de desastre.

---

## Segurança da instalação

O `docker-compose.yml` já traz, e vale entender antes de mexer:

- **Banco e storage sem porta publicada.** Só o proxy fala com a internet.
- **Duas redes.** `edge` (proxy ↔ aplicação) e `internal` (aplicação ↔ banco).
  O banco não alcança a internet nem é alcançado por ela.
- **Contêiner sem root**, sistema de arquivos somente-leitura onde dá, e sem
  capacidades extras.
- **O papel da aplicação no Postgres não tem DDL.** Quem altera schema é o
  `migrate`, que roda e sai.

Ver [SECURITY.md](../SECURITY.md).

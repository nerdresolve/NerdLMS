# Deployment

Three paths, from most automatic to most manual. Pick one.

| | Who it is for | What you need |
|---|---|---|
| [A. GitHub Actions](#a-github-actions) | anyone updating often | a server with SSH |
| [B. Compose on the server](#b-compose-on-the-server) | first install, or no CI | access to the server |
| [C. Cloudflare Tunnel](#c-cloudflare-tunnel) | a machine with no public IP | a Cloudflare account |

In all of them: **Docker and Docker Compose**, 2 vCPU and 4 GB handle ~100
concurrent users. Linux, macOS or Windows.

---

## Before anything else: the `.env`

No `.env` is committed. Copy the example and **generate your own secrets**. Do
not reuse the ones from another environment, or the ones in the examples.

```bash
cp infra/.env.example infra/.env

openssl rand -hex 32   # POSTGRES_PASSWORD
openssl rand -hex 32   # APP_DB_PASSWORD  (also has to go into DATABASE_URL)
openssl rand -hex 32   # STORAGE_SECRET_KEY
openssl rand -hex 48   # SESSION_SECRET
```

> **Use `-hex`, not `-base64`.** Base64 emits `/`, `+` and `=`; the database
> password goes inside a URL, and a slash there ends the authority, and the
> application starts and dies with `TypeError: Invalid URL`, without saying which
> variable is wrong.

The values that change per install:

| Variable | What it is |
|---|---|
| `SITE_ADDRESS` | the domain Caddy serves. `localhost` in development |
| `PUBLIC_ORIGIN` | the full public address, used in the recovery email link |
| `MAIL_TRANSPORT` | `log` writes the message to the log; `smtp` actually sends it |
| `SMTP_*` | only with `MAIL_TRANSPORT=smtp` |

> **`MAIL_TRANSPORT=log` in production means password recovery reaches nobody.**
> The link sits in `npm run logs`. It is fine for staging and not for real use.

---

## A. GitHub Actions

The [deploy Action](../.github/workflows/deploy.yml) runs the gates, publishes
the image to GHCR and updates the server.

**On the server**, once:

```bash
git clone https://github.com/nerdresolve/NerdLMS.git /opt/nerdlms
cd /opt/nerdlms
cp infra/.env.example infra/.env   # fill it in, as above
```

**On GitHub**, under Settings → Environments → `producao`, create the secrets:

| Secret | Example |
|---|---|
| `SSH_HOST` | `lms.suaempresa.com` |
| `SSH_USER` | `deploy` |
| `SSH_KEY` | the **private** key (the public one goes in the server's `authorized_keys`) |
| `SSH_PORT` | optional, defaults to `22` |
| `DEPLOY_PATH` | `/opt/nerdlms` |

After that, deploying is a matter of tagging:

```bash
git tag v1.0.0 && git push origin v1.0.0
```

The Action migrates the database, swaps the container and **waits for the
healthcheck** before declaring success. If the application comes up broken, the
job fails with the last 50 lines of the log.

> Without the SSH secrets, the Action publishes the image and **skips** the
> deploy, without erroring. A fork that only wants the image does not see red
> over something it never asked for.

### Rolling back

Migrations run **before** the container swap, and each one has to accept the
previous version of the application. That is what makes a rollback a tag change:

```bash
docker compose -f infra/docker-compose.yml --env-file infra/.env \
  pull app && docker compose ... up -d --no-deps app
```

pointing the image at the previous tag. No backup restore involved.

---

## B. Compose on the server

```bash
git clone https://github.com/nerdresolve/NerdLMS.git /opt/nerdlms
cd /opt/nerdlms
cp infra/.env.example infra/.env    # fill it in

npm run up        # brings up database, storage, application and proxy
npm run migrate   # applies the schema
```

The application answers at `https://$SITE_ADDRESS`. Caddy obtains a Let's
Encrypt certificate on its own, as long as DNS already points at the machine and
port 443 is reachable.

To update later:

```bash
git pull
npm run migrate
npm run compose -- up -d --build app
```

Or run the same script the Action uses:

```bash
CAMINHO=/opt/nerdlms bash .github/deploy-remoto.sh
```

---

## C. Cloudflare Tunnel

For a machine **with no public IP**, behind NAT, in an office or on a VPS with
no open port. The `cloudflared` container opens the connection from the inside
out, and public TLS terminates at Cloudflare's edge. That removes the need for a
static IP, an open inbound port and your own certificate.

```bash
cloudflared tunnel login                       # once, per account
cloudflared tunnel create nerdlms
cloudflared tunnel route dns nerdlms lms.suaempresa.com
```

Keep the token **out of Git** and bring it up:

```bash
echo "TUNNEL_TOKEN=<the-token>" > infra/.env.tunnel
npm run publish        # up -d --build, with the tunnel profile
npm run migrate
npm run publish:logs   # follow along
```

### The two traps

**`SITE_ADDRESS` has to carry the `http://` scheme:**

```ini
SITE_ADDRESS=http://lms.suaempresa.com
```

Without it, Caddy tries to issue a Let's Encrypt certificate for a domain whose
ACME challenge never reaches it, because the one answering the world is
Cloudflare, and it retries forever. And with the domain configured only as
`localhost`, Caddy refuses the Host the tunnel delivers and answers **421
Misdirected Request**, with no error log to explain it.

**The tunnel points at the HTTP port, not the HTTPS one.** Public TLS terminates
at the edge; internally the traffic is cleartext inside the machine itself:

```yaml
ingress:
  - hostname: lms.suaempresa.com
    service: http://localhost:80      # or whatever port is in HTTP_PORT
  - service: http_status:404
```

> If you already have another tunnel on this machine, watch out for
> `~/.cloudflared/config.yml`: it is **global** and `cloudflared` uses it even
> when you name a different tunnel on the command line. Pass `--config` pointing
> at a file of your own, or the DNS record will be created for the wrong tunnel.

## The domain on the certificate

The PDF certificate prints the verification address from the `domain` column of
the `tenants` table, **not from code**. Left empty, the footer prints "Confira o
código com a área de treinamento" instead of an address that does not resolve.

Once DNS points at the install:

```sql
UPDATE tenants SET domain = 'lms.suaempresa.com' WHERE slug = 'lms';
```

The name printed on the signature line, when the course has no instructor set,
also comes from the tenant (the `name` column).

---

## Checking that it came up

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://lms.suaempresa.com/api/health
# 200

docker compose -f infra/docker-compose.yml --env-file infra/.env ps
# app, db, storage and proxy in "running"; app in "healthy"
```

If `app` stays `unhealthy`:

```bash
npm run logs
```

Common causes, in order of frequency: `DATABASE_URL` with a different password
from `APP_DB_PASSWORD`, migrations not applied, and an empty `SESSION_SECRET`.

---

## Backup

What needs to leave the machine is two volumes: the database and the storage.

```bash
# Database
docker compose -f infra/docker-compose.yml --env-file infra/.env \
  exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > backup.sql.gz

# Restore
gunzip -c backup.sql.gz | docker compose ... exec -T db \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

The storage (videos and materials) is a MinIO volume. For real S3, point
`STORAGE_ENDPOINT` and the keys at the provider: the application cannot tell the
difference.

The platform also has an export of its own (Administration → Backup), which
produces a package with the logical content. It does **not** replace `pg_dump`:
it is for moving content from one install to another, not for disaster recovery.

---

## Security of the install

The `docker-compose.yml` already ships with this, and it is worth understanding
before changing anything:

- **Database and storage with no published port.** Only the proxy talks to the
  internet.
- **Two networks.** `edge` (proxy ↔ application) and `internal` (application ↔
  database). The database neither reaches the internet nor is reached by it.
- **Container without root**, read-only filesystem where possible, and no extra
  capabilities.
- **The application's Postgres role has no DDL.** The one that changes the schema
  is `migrate`, which runs and exits.

See [SECURITY.md](../SECURITY.md).

# White-label setup

How to put a new client on the platform: create the tenant, point the domain,
apply the visual identity and decide what stays switched on.

A tenant is the product's isolation boundary. Each client has its own courses,
people, grades and configuration, and nothing crosses from one to another. The
separation is by `tenant_id` across 42 tables, and there is a test that fails
the build when someone writes a query without that scope
(`apps/backend/src/tenancy/query-isolation.test.ts`).

---

## What you need before you start

| Item | Where to get it |
|---|---|
| The client's domain or subdomain | From the client. E.g.: `treinamento.acme.com.br` |
| Brand color in hexadecimal | The client's brand manual. Just one color |
| Logo on light and dark backgrounds | PNG or SVG, transparent background |
| Favicon | `.ico` or 32×32 PNG |
| Sender email address | A mailbox the client controls |
| Name of the organizational unit | Whatever the client calls it: "Region", "Branch", "Dealership" |
| Access to the production database | `docker exec` into the Postgres container |
| **If using Google or Microsoft:** client ID and secret | Google Console or the Entra portal. On Microsoft, the directory ID too |
| **If using Active Directory:** server and domain | From whoever administers the network. The port is 636 |
| **If using ADFS, Okta or similar:** IdP metadata | Entity ID, SSO URL and certificate, from the provider's metadata |

There is no screen for creating a tenant. It is SQL, deliberately: creating a
client is a deployment operation, not day-to-day administration, and a screen
for it would come with the risk of someone creating one by mistake.

---

## 1. Create the tenant

One statement. `slug` and `domain` are unique.

```sql
INSERT INTO tenants (slug, name, domain, unit_label, brand_color,
                     mail_from_name, mail_from_email)
VALUES (
  'acme',                          -- slug: lowercase, no spaces, never changes later
  'ACME Saneamento',               -- name shown on screens and in emails
  'treinamento.acme.com.br',       -- domain WITHOUT https:// and WITHOUT a trailing slash
  'Regional',                      -- what the client calls its unit
  '#B8860B',                       -- brand color, 6-digit hexadecimal
  'ACME Treinamento',              -- name that signs the emails
  'treinamento@acme.com.br'        -- sender address
)
RETURNING id;
```

Keep the `id` that comes back: the next steps use it.

### What each field does

**`slug`**: internal identifier. Shows up in logs and in `NERD_DEFAULT_TENANT`.
Changing it later breaks references; pick it once.

**`domain`**: this is how the platform knows whose visitor this is. Someone
arriving at `treinamento.acme.com.br` sees ACME; on another domain, another
client. The resolution lives in `apps/frontend/src/lib/tenant-request.ts`, and
uses `x-forwarded-host` before `host`, because behind the proxy `host` arrives
as the container's internal name.

With no domain registered, the request falls back to the default tenant
(`NERD_DEFAULT_TENANT`, or `exemplo`). That is what holds up a single-client
install; with two clients, each one **needs** its own domain, or the second is
never reached.

**`unit_label`**: the product says "unit" all the time: report filters, person
records, performance by area. The label belongs to the client. Pluralization is
automatic (`packages/core/src/tenancy/unit-label.ts`), so enter the singular.

**`brand_color`**: one color, and the rest is derived. Explained in step 3.

---

## 2. Create the first administrator

The tenant is born with nobody in it. Without this step, nobody gets in.

```sql
INSERT INTO users (tenant_id, email, full_name, role, status)
VALUES (
  '<tenant-id>',
  'nome@acme.com.br',
  'Nome Completo',
  'admin',
  'pending'
);
```

`password_hash` is left null on purpose: the person chooses their own password,
on first access. An administrator who types someone else's password now knows
someone else's password.

The `pending` status makes the account exist without being able to sign in until
the password is set. The person receives the invitation by email if SMTP is
configured (step 6); without SMTP, send them the password-setup link yourself.

From here on, the rest is handled through the interface: this administrator
invites the others in **Administration → Users**, or imports a spreadsheet.

---

## 3. Visual identity

### The color

You supply **one** color and the product derives the whole palette: hover,
active, surfaces, gradient, brand waves. The logic lives in
`packages/core/src/tenancy/branding.ts`.

With `#B8860B`, the palette comes out like this:

```
--brand:#B8860B
--brand-hover:#c19528
--brand-active:#c8a141
--brand-deep:#533c05
--surface-brand-subtle:…
--text-on-brand:…
```

**Contrast is adjusted on its own.** The color of text over the brand is picked
to pass WCAG AA (4.5:1). With the gold above, the result is 5.79:1. A color that
is too light gets dark text; a dark one gets light text. You do not have to
calculate anything, and you cannot produce an unreadable combination through the
color field.

**An invalid color falls back to the default.** `paletteToCss` only accepts
six-digit hexadecimal. Anything else, whether a color name, `rgb()` or loose
text, returns empty and the platform uses the default color. It does not break
the screen, but it does not apply the brand either; if the color did not take,
this is where to look.

### Logos and favicon

Three files, referenced by URL:

| Column | Use | Format |
|---|---|---|
| `logo_light_url` | On a light background | PNG/SVG, transparent background |
| `logo_dark_url` | On a dark background (side menu) | PNG/SVG, light version of the logo |
| `favicon_url` | Browser tab | `.ico` or 32×32 PNG |

Both logos are needed because the side menu is dark and the body is light. A
single dark logo disappears in the menu.

Two ways to host them:

**Through the platform's storage**: upload to the MinIO bucket and use the
public path:

```sql
UPDATE tenants
   SET logo_light_url = '/lms-media/brand/acme-light.png',
       logo_dark_url  = '/lms-media/brand/acme-dark.png',
       favicon_url    = '/lms-media/brand/acme.ico'
 WHERE slug = 'acme';
```

**By external URL**: if the client already hosts them, use the absolute URL. It
has to be HTTPS: an `http://` on an HTTPS page is blocked by the browser and the
logo simply does not show up.

### Through the interface

After first sign-in, all of this is editable in **Administration → Platform**,
with no SQL. Use SQL for the initial deployment and leave the adjustments to the
client.

---

## 4. Point the domain

### DNS

Point the client's domain at the server. An `A` record for the IP, or a `CNAME`
if it sits behind Cloudflare.

### Certificate

Caddy handles HTTPS on its own, via Let's Encrypt. What it needs is in
`infra/.env`:

```
SITE_ADDRESS=treinamento.acme.com.br
ACME_EMAIL=infra@suaempresa.com.br
```

`ACME_EMAIL` receives the warning about a certificate about to expire. It has to
be a valid address: `email` with no argument is not "no email", it is a syntax
error, and Caddy rejects the whole file and restarts in a loop.

### Several domains on the same server

Caddy's site block is `{$SITE_ADDRESS}`, one address at a time. To serve several
clients from the same server, list the domains separated by spaces:

```
SITE_ADDRESS="treinamento.acme.com.br ead.outrocliente.com.br"
```

Caddy treats a block with several addresses as the same site, issues a
certificate for each of them, and the application resolves the tenant from the
request's `Host`. It is one server serving several clients, with none of them
seeing the others.

Confirm after bringing it up, because a mistake here puts the proxy in a restart
loop:

```bash
npm run compose -- logs proxy | tail -20
```

### Behind Cloudflare Tunnel

If you are publishing through the tunnel, public TLS terminates at Cloudflare
and the tunnel delivers over internal HTTP. In that case `SITE_ADDRESS` takes an
explicit scheme:

```
SITE_ADDRESS=http://nerdlms
```

Without the `http://`, Caddy tries to issue a certificate for a domain whose
ACME challenge never reaches it, and retries forever.

After touching `.env`, the proxy needs to re-read it:

```bash
npm run compose -- up -d proxy
```

---

## 5. Choose what stays switched on

There are 16 features that can be switched off, arranged in a tree. With no
configuration at all, every one of them is on. The catalog in
`packages/core/src/tenancy/features.ts` defines the default for each.

```
comentarios
├── comentarios.respostas
└── comentarios.upvotes
forum
├── forum.anexos
└── forum.denuncias
notificacoes
└── notificacoes.email
gamificacao
├── gamificacao.distintivos
└── gamificacao.loja
trilhas, agenda, certificados, favoritos, busca
```

**The hierarchy rules.** Switching off `comentarios` switches off replies and
upvotes along with it, regardless of what is ticked on them. That is what avoids
the incoherent state of "upvotes on in a product with no comments".

Do it through the interface, in **Administration → Platform**, which is where
the tree is shown and the effect of switching off a parent is visible. Via SQL,
if you need to automate the deployment:

```sql
INSERT INTO tenant_features (tenant_id, feature, enabled)
VALUES
  ('<tenant-id>', 'gamificacao', false),
  ('<tenant-id>', 'forum', false)
ON CONFLICT (tenant_id, feature) DO UPDATE SET enabled = EXCLUDED.enabled;
```

The table stores **only what the client changed**. A missing row means "use the
product default", and that is how a new feature arrives switched on for everyone
without needing a data migration.

**Switching off does not delete.** The content stays in the database: it
disappears from the screens and comes back if someone switches it on again. A
client who switches the forum off for six months does not lose the discussions.

---

## 6. Email

Two layers: the transport (the server's) and the identity (the client's).

The transport lives in `infra/.env` and applies to the whole install:

```
MAIL_TRANSPORT=smtp
SMTP_HOST=smtp.provedor.com.br
SMTP_PORT=587
SMTP_USER=…
SMTP_PASSWORD=…
SMTP_FROM=nao-responda@suaempresa.com.br
```

With `MAIL_TRANSPORT=log`, nothing is sent: the email goes to the container's
log. That is the default in development and what you want when testing a
deployment without bothering anyone.

The identity is per tenant, in the `mail_from_name` and `mail_from_email`
columns you already filled in at step 1. The recipient sees "ACME Treinamento",
not your company's name.

**If the client uses its own domain in the sender address**, it has to authorize
your server in SPF, or the email lands in spam. It is the only part of this
process that depends on someone on the client's side touching DNS, so raise it
early.

The email copy is per client too, editable in **Administration → Platform →
Email copy**. With no custom text, the product default applies.

---

## 7. Sign-in through the company's system (SSO)

Optional, and requested almost every time. A company of any size does not want
another password to manage: it wants an offboarding in its own directory to
close access here, the same day.

Google and Microsoft **come preconfigured** in the product: their endpoints are
public and the same for everyone. All you fill in is what belongs to the client.

Everything happens in **Administration → Access**.

### Which of the three

The product offers three ways to sign in through the company's system. The
choice is not a matter of taste and depends on what the client already has:

| If the client uses | Choose | Why |
|---|---|---|
| Google Workspace or Microsoft 365 | **OIDC** | Already preconfigured; they paste in two keys |
| Active Directory on their network | **LDAP** | The directory already exists and already has everyone |
| ADFS, Okta, OneLogin, Shibboleth | **SAML 2.0** | It is what those tools speak |
| Modern Okta or Auth0 | **Generic OIDC** or SAML | Both work; OIDC is less configuration |

You can switch on more than one at a time. Whoever has both Active Directory and
Google usually wants both: AD for people on the network, Google for people in
the field.

### LDAP and Active Directory

What changes per client is the server and the domain. The identifier format,
which differs between AD and OpenLDAP, comes from the product.

| Field | Active Directory | OpenLDAP |
|---|---|---|
| Server | `dc.empresa.com.br` | `ldap.empresa.com.br` |
| Port | 636 | 636 |
| Domain | `empresa.com.br` | — |
| Base | — | `dc=empresa,dc=com,dc=br` |

**Port 636 is not optional.** It is LDAP over TLS, and the product does not offer
port 389: authentication sends the corporate directory password, and without TLS
it crosses the network in the clear.

**The company's own certificate.** A corporate directory almost never uses a
certificate from a public authority. If the connection fails with a certificate
error, tick the corresponding option. It is a conscious choice, and it is
recorded.

What the person types is their login name, not the full DN. The product builds
the rest.

### SAML 2.0

Here the exchange is metadata, and it goes both ways. From the provider you need
three values; to the provider you hand over two.

**What to bring from the provider:**

| Field | Where to find it |
|---|---|
| Entity ID | In the IdP metadata, as `entityID` |
| SSO URL | The `HTTP-Redirect` address of SingleSignOnService |
| Certificate | The `X509Certificate` block in the metadata, or the `.cer` file |

**What to hand to the provider:**

| Field | Value |
|---|---|
| Entity ID (SP) | Whatever you define on the screen, normally the platform's URL |
| Return URL (ACS) | `https://treinamento.acme.com.br/api/saml/retorno` |

**Register the new certificate BEFORE the provider rotates it.** The field
accepts several, and that is what it is for: during the swap, the provider is
already signing with the new key while the client still has the old one. With
both registered, nobody notices the rotation; with only one, sign-in stops until
someone updates it.

**The provider has to sign with SHA-256.** Many still ship with SHA-1, which is
refused: SHA-1 collisions have been demonstrated since 2017, and accepting it
would make validation decorative. The error message says what to configure.

**Unsolicited assertions do not get in.** Some providers offer a button that
sends the assertion without the platform having asked for it. The product
refuses: without a request from us, there is no way to know the person meant to
sign in here.

### The step that trips people up most

The first thing on the screen is the **return URL**, with a copy button.
Register that address with the provider **exactly as it appears there**:

```
https://treinamento.acme.com.br/api/sso/retorno
```

Google and Microsoft compare the whole string and refuse over one extra slash,
with a message that does not say what address they expected. If sign-in fails
right at the start, it is almost always this.

### Google

In the Google Cloud Console, under **APIs & Services → Credentials**, create an
**OAuth client ID** of the web application type. Paste the return URL there, and
bring back two things:

| Field on the screen | Where it comes from |
|---|---|
| Client ID | ends in `.apps.googleusercontent.com` |
| Client secret | shown once, at creation time |

### Microsoft

In the **Entra ID** portal, under **App registrations**, register an
application. Three values:

| Field on the screen | Where it comes from |
|---|---|
| Directory (tenant) ID | the application's overview |
| Client ID | the application's overview |
| Client secret | **Certificates & secrets** |

The directory ID is mandatory and there is no shortcut. There is a `common`
value that Microsoft accepts, and it would let **any Microsoft account in the
world** sign in, personal ones included. On a corporate platform that is an open
door, which is why the product does not offer that option.

### Another provider

Okta, Keycloak, Auth0 and the like go in as **OpenID Connect**. There you fill
in four endpoints by hand, all of them available in the provider's discovery
document, usually at:

```
https://provedor-do-cliente.com/.well-known/openid-configuration
```

### The three decisions that matter

**Accepted domains.** Fill this in. Left blank, the product accepts any email the
provider confirms, and on a client using Google as its provider that includes
any `@gmail.com` in the world. With `acme.com.br` filled in, anyone outside it
is refused.

**Create an account on first sign-in.** Off by default. On, anyone in the
company's directory becomes a user the first time they sign in, with the role you
pick alongside it. Plenty of clients want exactly that; none of them want to find
out later that it happened without their asking.

**Keep password sign-in.** Leave it on until you have tested. Switching it off
requires everyone to come in through the provider, and if the configuration is
wrong nobody gets in, you included. The screen asks for confirmation before
letting you untick it.

### How a person is recognized

In this order:

1. **They have signed in here before**: the link exists, they go straight in.
2. **They already had an account with the same email**: the link is created on
   first sign-in and they land in the account that was already theirs.
3. **They have no account**: one is created, if you switched that option on;
   otherwise they are refused with a note to contact the administrator.

The link is recorded by the provider's identifier, **not by the email address**.
That matters: someone who marries and changes surname gets a different address
and is still the same person. And a disabled address can be reassigned to another
employee, and following the email would hand the old account to the address's new
owner.

**A deactivated account does not get in**, link or no link. It is the access a
company most wants cut on the day of an offboarding.

### Testing

Switch the provider on, open the sign-in screen in a private window and click the
button. What should happen:

- you go to the provider;
- you come back to the platform already signed in;
- in **Administration → Auditing** an `Entrou` record appears and, on first
  sign-in, a `Vinculou conta ao provedor`.

If it errors, the message comes back on the sign-in screen itself. The most
common ones:

| Message | What to check |
|---|---|
| The identity provider refused authentication | wrong or expired client secret; return URL not registered |
| This email does not belong to an authorized domain | the person's domain is not on the list |
| You do not have an account on this platform | the account does not exist and automatic creation is off |
| The provider is only half configured | the directory ID (Microsoft) or one of the endpoints (generic) is missing |

---

## 8. Content and outside systems

Nothing here is required to deliver a client. It is in this document because the
question comes up early in a deployment, almost always as "we have the training
in the old system, can we reuse it?".

### Bringing over what the client already has

| What they have | What to do |
|---|---|
| SCORM 1.2 or 2004 package | Upload the `.zip` when creating the lesson, under **Instructor → My courses → (the course)**. The type, title and pass mark come from the package itself |
| Question bank from another LMS | Export as QTI and import it on the course screen, under **Instructor → My courses → (the course)**. Accepts `.xml` (QTI 2.x and 3.0) and `.csv` |
| Spreadsheet of people | **Administration → Users → Import**. It checks before saving |
| Course catalog in a spreadsheet | **Instructor → My courses**, in the import block |

**About SCORM.** The `.zip` is the only file that goes through the server. The
rest go straight from the browser to storage. A package has to be unpacked, and a
signed URL would solve the upload without solving what comes after. The limit is
60 MB; above that there is almost always video embedded in the package, which
would work better as a separate video lesson.

**Whoever edits the course sees the content in preview.** The player opens and
the package runs the same way, but nothing is recorded: SCORM tracking belongs to
the enrollment, and the instructor does not have one. The screen says so. That is
on purpose: enrolling the instructor in their own course would pollute the
completion reports.

### Connecting the platform to another system

| Standard | What for | Where to configure it |
|---|---|---|
| **LTI 1.3** | An outside tool opens inside the course, already knowing who the student is, and sends the grade back | Tool registration, via SQL |
| **xAPI** | A simulator, a field app or another LMS record what the person did | API key, under Integrations |
| **cmi5** | External content with a session, a result and a completion criterion declared by the author | Unit registration, via SQL |
| **Webhooks** | Notify another system when something happens here | **Administration → Integrations** |
| **REST API** | Read and write from outside | API key, with scopes |

What these five have in common: **the key is per client**. An API key gives
programmatic access to the entire tenant, and leaking one across clients would be
the worst possible leak, which is why it is issued in that client's
administration area and shown exactly once.

### Taking it away

Worth checking at handover, because it is what separates a platform from a trap:

- **Questions**: export as QTI 2.1, the format Moodle, Canvas and Blackboard
  read. Button on the course screen, next to the import one.
- **Reports**: CSV, through the buttons on the **Project dashboard** (Progress,
  Team) and via `/api/relatorios?tipo=progresso|usuarios|notas|cursos`.
- **The whole client**: JSON backup, in **Administration → Platform**. It brings
  the content, the people, the enrollments and the grades.

---

## 9. Check before handover

From the machine, with the domain already pointing:

```bash
# The sign-in screen responds and shows the right brand
curl -sI https://treinamento.acme.com.br/login | head -3

# The tenant was resolved from the domain (and did not fall back to the default)
curl -s https://treinamento.acme.com.br/login | grep -o "ACME Saneamento" | head -1
```

In the browser, signed in as the administrator you created:

- [ ] The logo shows up in the side menu **and** in the body (both versions)
- [ ] The favicon is the client's
- [ ] The buttons are in the brand color, and the text over them is readable
- [ ] The unit label reads the way the client says it, not "Unit"
- [ ] **Administration → Platform** opens and shows the configuration
- [ ] The features you switched off really are gone from the menu
- [ ] An invitation email arrives with the right sender

If the branding did not apply, the suspects in order: color not in hexadecimal
format; logo URL on `http://` on an HTTPS page; domain not matching the `domain`
column (in which case the application fell back to the default tenant and you are
looking at another client).

---

## How isolation works

Worth knowing so nothing surprises you.

**Every query declares the tenant.** Root tables carry `tenant_id`, and the rest
inherit it through foreign keys. There is a test that reads the source code and
fails the build when a query reads a root table without scoping it. It was
written after the table list went stale and started silently passing what it
should have failed.

**The boundary comes before the role.** In
`packages/core/src/auth/permissions.ts`, the tenant check happens before the
administrator block. Without that order, one client's admin would see another
client's data, and "unrestricted access" never meant access to someone else's
company.

**Email is unique per client, not globally.** The same person can have an account
at two clients with the same address. Sign-in resolves it by the domain they
arrived from.

**Backup and restore are per client.** In **Administration → Platform →
Backup**, the file comes out with that client's records. Restoring only works in
the same client that produced the file: the rows carry their source identifiers,
and in a different client those already exist. Migrating content between clients
is not implemented, and the platform refuses instead of pretending it worked.

---

## Before running any command: which environment are you touching

The `package.json` commands read a single environment file, `infra/.env`, and
always bring up the `nerdlms` project:

| Command | Environment file | Containers affected |
|---|---|---|
| `npm run compose` | `infra/.env` | `nerdlms-*` |
| `npm run compose:tunnel` | `infra/.env` + `infra/.env.tunnel` | `nerdlms-*`, published through the tunnel |

What differs between a development machine and a server (domain, ports, email
transport) changes inside `infra/.env` itself. There are no `:prod` variants:
they used to read a second file layered on top, and in a fresh clone that file
did not exist, which made compose abort with "couldn't find env file" and took
down `up`, `migrate`, `seed` and `logs` all at once.

If the same machine needs two independent installs, what separates them is the
project name, not the environment file. The environment file changes the stack's
configuration; what decides which containers and which volumes the command
reaches is `-p`:

```bash
docker compose -p nerdlms-homolog -f infra/docker-compose.yml   --env-file infra/.env up -d --build app
```

The project name is the prefix of the volumes, and Docker does not copy content
from one to another. Bringing it up under a different name from the one that
created the data hands you an empty install, with the previous content intact and
invisible.

Check which one you are in before running anything that writes:

```bash
docker ps --format '{{.Names}}'
```

> **Why some infrastructure names say `lms`.** The database (`nerdlms`), the
> roles (`lms_migrator`, `lms_app`) and the bucket (`lms-media`) are identifiers
> of an install that already holds data. Renaming them is not rebranding, it is
> migration: it requires downtime, and renaming the bucket invalidates every
> media URL already stored in the database. None of it is visible to the user.
> What they do see, which is branding, colors, copy, emails, certificates and
> the domain, comes from the organization.

**`psql` does not accept `-U nerdlms`.** The role is called `lms_migrator`, the
schema owner, or `lms_app`, used by the application. Inside the container, use
the variables that are already in the environment:

```bash
docker exec nerdlms-db-1 sh -c   'psql -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT slug FROM tenants;"'
```

---


## Database migrations

The schema is versioned in `infra/db/migrations/`, one file per change, in
numeric order. There is no tracking of which ones have already been applied: the
runner runs **every file, every time**, and that is how you find out whether an
environment has fallen behind.

This works because STRUCTURE migrations use `IF NOT EXISTS`. But not every
migration is a structural one: `035` is an `UPDATE` that renames the tenant, and
`002` creates a database role. Reapplying those in the RIGHT environment is
harmless: `035` filters by `WHERE slug = 'lms'` and finds nothing the second
time. In the WRONG environment, it is a write to a database that should never
have received it, and no `IF NOT EXISTS` protects against that.

So confirm the environment before migrating, and never run it out of habit:

```bash
docker ps --format '{{.Names}}'   # which install am I in
npm run migrate                   # applies to the nerdlms project
```

Each file runs in its own transaction, with `ON_ERROR_STOP=1`: an error stops at
that file and does not leave half a migration applied.

**Take a `pg_dump` first.** Not because the migration is dangerous, but because
the alternative to having the backup is finding out you needed it:

```bash
docker exec nerdlms-db-1 sh -c 'pg_dump -U $POSTGRES_USER -d $POSTGRES_DB' \
  > backup-$(date +%Y%m%d-%H%M).sql
```

**A new image requires its own schema.** Bringing the application up without
applying the corresponding migrations takes down the screens that depend on the
new tables, with a 500 and no clear message. The order is: migrate, then bring
it up.

To find out where an environment stands, look for the most recent table:

```bash
docker exec nerdlms-db-1 sh -c "psql -U \$POSTGRES_USER -d \$POSTGRES_DB \
  -tAc \"SELECT count(*) FROM information_schema.tables
         WHERE table_name IN ('sso_providers','cmi5_units')\""
```

An answer of `2` means the database is up to date through the most recent
migration in this document.

---

## When something goes wrong

**Every client sees the same thing.** The domain is not matching the `domain`
column. Check what reaches the server:

```bash
docker exec nerdlms-app-1 sh -c 'echo $NERD_DEFAULT_TENANT'
docker exec nerdlms-db-1 psql -U lms_migrator -d nerdlms \
  -c "SELECT slug, domain FROM tenants;"
```

The `domain` value is compared without the scheme and without the port.
`https://acme.com/` matches nothing; `acme.com` matches.

**The certificate is not issued.** Caddy needs to be reachable on port 80 from
outside for the ACME challenge. Behind a tunnel, use `SITE_ADDRESS=http://…` as
in step 4.

```bash
npm run compose -- logs proxy | tail -30
```

**The logo does not load.** Open the browser console. A mixed-content block means
`http://` on an HTTPS page. A 404 on the `/lms-media/…` path means the file is
not in the bucket.

**A feature that was switched off still shows up.** The screens are rendered on
the server with a per-request cache; force a clean reload. If it persists, check
that the row went in for the right tenant:

```sql
SELECT t.slug, f.feature, f.enabled
  FROM tenant_features f
  JOIN tenants t ON t.id = f.tenant_id
 WHERE t.slug = 'acme';
```

---

## Deployment checklist

```
[ ] Migrations applied to the target database
[ ] Tenant created (slug, name, domain, unit_label)
[ ] First administrator created with status 'pending'
[ ] Brand color applied and checked in the browser
[ ] Light logo, dark logo and favicon live
[ ] DNS pointing at the server
[ ] SITE_ADDRESS updated and proxy restarted
[ ] Certificate issued (https with no warning)
[ ] Features reviewed with the client
[ ] SPF authorized, if the sender uses the client's domain
[ ] Invitation email received with the right sender
[ ] The client's administrator set their password and signed in

If the client uses Google or Microsoft (OIDC):
[ ] Return URL registered with the provider, identical to the one on screen
[ ] Client ID and secret filled in (and the directory ID, on Microsoft)

If using Active Directory or LDAP:
[ ] Server and port 636 reachable from the platform's server
[ ] Domain (AD) or base (OpenLDAP) filled in
[ ] Self-signed certificate? Option ticked, if that is the case

If using SAML:
[ ] Provider's Entity ID, SSO URL and certificate registered
[ ] Entity ID and return URL handed to whoever administers the provider
[ ] Provider configured to sign with SHA-256

In any of them:
[ ] Accepted domains filled in
[ ] Sign-in tested in a private window
[ ] Access record checked in Auditing

If the client brings content from another system:
[ ] Questions imported and checked before being applied
[ ] SCORM packages uploaded and opened with an enrolled account
```

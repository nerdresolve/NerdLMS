# Staging: accounts and access

**Address:** whatever is in `SITE_ADDRESS`, in `infra/.env`. There is no domain
hardcoded anywhere: changing the address is editing one line and pointing DNS.

Locally, `http://localhost:3000` with `npm run dev`. With the full stack
(`npm run up`), `https://localhost`: Caddy issues an internal certificate and
the browser shows a warning, which is expected. With a real domain, it obtains a
Let's Encrypt certificate on its own, as long as DNS already points at the server
and port 443 is reachable.

---

## Credentials

Five accounts, one per role. **The display name is the role, not an invented
name**: in a presentation, "Ana Ribeiro" does not tell you which view you are
looking at, and "Administrador" does. **The password is the login without the
dot.**

| Role | Sign in with | Password | Display name | Unit |
|---|---|---|---|---|
| Student | `user.mock` | `usermock` | Aluno | Siririzinho |
| Instructor | `instructor.mock` | `instructormock` | Instrutor | Unidade Norte |
| Instructor | `instructor2.mock` | `instructor2mock` | Instrutor 2 | Riachuelo |
| Manager | `manager.mock` | `managermock` | Gestor | Unidade Norte |
| Administrator | `admin.mock` | `adminmock` | Administrador | Sede |

The full email address (`admin.mock@exemplo.com`) also works: the query accepts
both forms.

Besides those, eight people with real-looking names and no password, in the
"invited" state. They exist to populate the management, engagement and active
user screens, not to sign in.

> **These credentials are for staging and must not exist in production.** A
> password derived from the login is fine for a test environment and unacceptable
> outside it. The load requires the `-v allow_seed=yes` flag to run, which
> prevents applying it to a production environment by accident.

---

## The seed brings fictional content along with it

```bash
npm run up        # brings up database, storage, app and proxy
npm run migrate   # creates the schema
npm run seed      # READ THE WARNING BELOW
```

> **`npm run seed` is not just accounts.** It also inserts **7 made-up courses**,
> 20 modules, 84 lessons, 7 exams, 20 enrollments and 164 progress records. Every
> `INSERT` is `ON CONFLICT DO UPDATE`, so running it against a database that
> already holds the organization's real content **brings the fictional courses
> back**, and the catalog ends up mixing the two.
>
> On an empty database, it is the fastest way to have someone to sign in as. On a
> database in use, do not run it: the accounts are already registered.

The real content is imported by a different path:

```bash
node infra/tools/import-cursos.mjs     # 7 real courses, idempotent
node infra/tools/cenario-demo.mjs      # progress for demo purposes
```

### How the environment was set up today

Database recreated from scratch, with **only the users** from the seed and the
real courses on top. Recreating was necessary rather than deleting: the
insert-only triggers on `audit_log`, `xapi_statements` and `grade_entries` refuse
to remove a course, enrollment or grade with recorded use, and that is how it
should be.

```bash
npm run down
docker volume rm nerdlms-local_db-data
npm run migrate
# from hml.sql, apply only the user INSERTs
node infra/tools/import-cursos.mjs
node infra/tools/cenario-demo.mjs
```

### Regenerating the fictional data

```bash
npm run build:seed
```

`infra/db/seeds/hml.sql` is **generated**, not written by hand. The source is
`apps/frontend/src/mocks/data.ts`. Editing the SQL directly would make the
database tell a different story from the one that produced the data.

---

## The demo scenario

The real videos run 56 to 85 minutes and the player's lock is real: nobody
completes a course live. `cenario-demo.mjs` records the progress a person would
have after watching, in the same tables normal use writes to, and leaves the
Student with one course in each state the rule can produce:

| Course | State | What the screen shows |
|---|---|---|
| `1007-pe-00022` | untouched | "1 lesson left to unlock", button disabled |
| `1001-pr-0006` | lessons completed | "Take the exam" unlocked |
| `1014-pe-0004` | failed, 4.0 | "Request a retake" |
| `1022-pe-00022` | failed, 6.0 | "Waiting on the instructor", and the request in the queue |
| `1001-pe-0003` | passed, 10.0 | "Download certificate" |
| Consciência Negra | completed | course with no exam, closes on the lesson alone |
| My Ahgora | untouched | course with no exam, not started yet |

The retake request queue lives at `/instrutor/correcao`, for
`instructor.mock`.

---

## Switching roles without signing in (development only)

```bash
NERD_DEV_ROLE=admin npm run dev
```

Accepts `admin`, `manager`, `instructor` and `learner`. **Ignored in
production**: there the role comes from an authenticated session and from
nothing else.

---

## How authentication works

```
login screen  →  POST /api/auth/login  →  @nerdlms/backend/auth/login-use-case
                                                   ↓
                                        users-repository (Postgres)
                                                   ↓
                                        @nerdlms/core/auth/login (decides)
                                                   ↓
                                        session + cookie __Host-nerdlms-session
```

- **Password**: scrypt hash with a per-user salt, at OWASP's parameters. The
  database never stores a password in plaintext, and the hash never leaves the
  server layer.
- **Cookie**: `HttpOnly`, `Secure`, `SameSite=Lax`, `__Host-` prefix. Out of
  reach of any script on the page.
- **Session**: the database stores the token's **hash**, not the token. A
  database leak does not yield reusable sessions.
- **Error message**: identical for a wrong password and a nonexistent account, so
  as not to reveal which accounts exist.
- **Lockout**: 10 failures per IP in 15 minutes and sign-in starts refusing.

### Signing in with the company account

LDAP/Active Directory, SAML 2.0, Google and Microsoft are implemented, and the
platform role comes from the group in the directory. Configuration is per tenant,
at `/admin/acesso`, and the walkthrough is in
[`../WHITELABEL.md`](../WHITELABEL.md).

**The organization's directory is configured and SWITCHED OFF.** Validation was
proven against the real Active Directory, but the platform stays on local
passwords until someone decides to flip the switch:

```sql
UPDATE ldap_directories SET enabled = true WHERE kind = 'ad';
```

With `allow_password_login = false` on the directory, the local password stops
working for that tenant: whoever comes in, comes in through Active Directory.
That is the production mode, and it is what closes the door on parallel local
accounts. `require_group`, in the same table, requires the user to belong to one
of the mapped groups. Without that requirement, any valid domain account would be
authenticated as a student.

---

## Password recovery

The flow is complete on the server side: a hashed token in the database, a 1-hour
validity, single use, password change and termination of open sessions.

Sending has two modes, in `MAIL_TRANSPORT`:

- **`log`** (used in staging): writes the message to the log instead of sending it. Enough to walk the whole flow without depending on a mailbox:

  ```bash
  npm run logs                   # the link shows up here
  ```

- **`smtp`**: sends through an SMTP server. Requires `SMTP_HOST`, `SMTP_PORT`,
  `SMTP_USER` and `SMTP_PASSWORD` in the `.env`. **This is the production mode**:
  with `log`, recovery reaches nobody.

The port determines when TLS starts: 465 is encrypted from the first byte, and
587 negotiates via STARTTLS. On 587 sending **requires** STARTTLS: a server that
does not offer it makes delivery fail rather than send the password in the clear.

Any other value in `MAIL_TRANSPORT` discards the email and records the discard in
the log.

---

## What to check before signing off

The gates, which need no network:

```bash
npm run verify
```

And, in the application, the script below. A record existing in the database does
not guarantee the screen presents the state correctly:

1. Sign in as the Student and walk through the seven courses. Each one shows a
   different state of the exam block (the table above).
2. Fail, request a retake, sign in as the Instructor at `/instrutor/correcao`,
   grant it with a comment, come back as the Student and retake it.
3. Issue the certificate for the passed course and check the code at `/validar`.
   An incomplete or made-up code has to be refused.
4. In the editor: publish a course with no lessons (it refuses and explains),
   create a module and a lesson with no title (the field blocks and says what is
   missing).

## What is not real yet

- **The certificate domain.** The verification address comes from
  `tenants.domain`. With the column empty, the footer prints "Confira o código
  com a área de treinamento". The code is valid and verification works, but
  whoever receives the document has nowhere to go on their own. See
  `docs/DEPLOY.md`.
- **Backup** is not configured. RPO and RTO need to be decided before
  production.
- **The staging seed and the real content coexist badly.** As long as `hml.sql`
  loads made-up courses, running `npm run seed` on a database in use dirties the
  catalog. See the warning further up.

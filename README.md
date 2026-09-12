<div align="center">

<img src="docs/brand/nerdresolve-mark.png" alt="" width="96">

# NerdResolve LMS

**White-label corporate training platform.** One install serves several
clients, each with its own domain, brand and colors, none of them seeing the
others.

[![CI](https://github.com/nerdresolve/NerdLMS/actions/workflows/ci.yml/badge.svg)](https://github.com/nerdresolve/NerdLMS/actions/workflows/ci.yml)
[![Security](https://github.com/nerdresolve/NerdLMS/actions/workflows/seguranca.yml/badge.svg)](https://github.com/nerdresolve/NerdLMS/actions/workflows/seguranca.yml)
[![License](https://img.shields.io/badge/license-BSL%201.1%20→%20Apache%202.0-7C3AED)](LICENSE.md)
[![Node](https://img.shields.io/badge/node-%E2%89%A522-7C3AED)](.nvmrc)

**[See it running →](https://lms.nerdresolve.com)** &nbsp;·&nbsp; sign in with
`user.mock` / `usermock`

<img src="docs/capturas/painel-do-aluno.webp" alt="Student dashboard: course in progress, progress and catalog" width="100%">

</div>

---

## Contents

- [Why it exists](#why-it-exists)
- [Up in 5 minutes](#up-in-5-minutes)
- [What each person does here](#what-each-person-does-here)
- [How progress is measured](#how-progress-is-measured)
- [Architecture](#architecture)
- [Customizing for your client](#customizing-for-your-client)
- [Deploying](#deploying)
- [Quality](#quality)
- [Interoperability](#interoperability)
- [Security](#security)
- [Command reference](#command-reference)

---

## Why it exists

Corporate training platforms are usually rented per active user. The cap is
contractual, not technical. The record of who took what, with what grade and on
what date lives in another company's database, and when the contract ends the
export is a CSV, if there is one at all.

Here you host it, you own the data, and the brand on screen is yours.

**Current state:** 38 screens, 65 API routes, 83 tables, 46 migrations and
1,444 automated tests.

---

## Up in 5 minutes

You need **Node 22+** and **Docker**.

```bash
git clone https://github.com/nerdresolve/NerdLMS.git
cd NerdLMS
npm ci

cp infra/.env.example infra/.env
```

Open `infra/.env` and generate a value for each secret:

```bash
openssl rand -hex 32   # POSTGRES_PASSWORD
openssl rand -hex 32   # APP_DB_PASSWORD  (repeat it inside DATABASE_URL)
openssl rand -hex 32   # STORAGE_SECRET_KEY
openssl rand -hex 48   # SESSION_SECRET
```

> **`-hex`, not `-base64`.** Base64 emits `/` and `+`. The application password
> goes inside `DATABASE_URL=postgres://lms_app:PASSWORD@db:5432/nerdlms`, and a
> slash there ends the URL's authority: the container starts and dies with
> `TypeError: Invalid URL`, without saying which variable is wrong.

If ports 80 and 443 are already taken on your machine, adjust them in the same
file:

```ini
HTTP_PORT=9080
HTTPS_PORT=9443
STORAGE_PUBLIC_ENDPOINT=https://localhost:9443
```

Then:

```bash
npm run up        # database, storage, application and proxy
npm run migrate   # applies the 46 migrations
npm run seed      # catalog and demo accounts
```

The platform answers at **<https://localhost>** (or at the port you chose). The
certificate is internal, so the browser warns you. That is expected.

### Demo accounts

| Role | User | Password |
|---|---|---|
| Administrator | `admin.mock` | `adminmock` |
| Manager | `manager.mock` | `managermock` |
| Instructor | `instructor.mock` | `instructormock` |
| Student | `user.mock` | `usermock` |

> The seed **refuses to run** without `-v allow_seed=yes` and uses passwords
> derived from the login. It is fine for staging and unacceptable outside it.

The same accounts work at **<https://lms.nerdresolve.com>**, a demo install
running this same seed. It is a showcase, not a service: the data is wiped on
every update and it may be down without notice. To evaluate it properly, bring
up your own with the three commands above.

### Without Docker

The tests, the accessibility gates and the clickable prototype run with nothing
but npm:

```bash
npm run test          # 1,444 tests
npm run test:a11y     # WCAG AA contrast, token by token
npm run preview       # generates apps/frontend/preview/*.html
```

Open any file from `apps/frontend/preview/` in a browser: those are the 21
screens with the product's real CSS and seed data, no server involved.

---

## What each person does here

### Student

<img src="docs/capturas/aula.webp" alt="Lesson screen: player, materials and course content" width="100%">

Watches the lesson, downloads the material, comments, takes the exam and
receives the certificate. The lesson **picks up where it left off**, on desktop
or on the phone.

The catalog separates what is in progress, completed and saved. There are
tracks (course sequences), a schedule with deadlines, and achievements: coins
per completed lesson, badges per milestone, and a monthly highlight for forum
contribution, not for speed.

<img src="docs/capturas/catalogo.webp" alt="Catalog: filters by status and course cards with progress" width="100%">

### Instructor

<img src="docs/capturas/estudio-do-instrutor.webp" alt="Instructor studio: course list with modules, lessons and status" width="100%">

Creates courses, modules and lessons. Uploads video, PDF, spreadsheet, SCORM
package or H5P. Builds an exam from a question bank, grades essay answers by
rubric and decides on retake requests, granting or refusing them **with a
mandatory comment**.

Sees how the class is engaging: who started, who stopped, where the video loses
people. Months later, records the **training effectiveness**: whether
performance actually changed, which is the question auditors ask.

### Manager

Follows their own team: who is on track, who is about to miss a deadline, who
never started. The scope is the organizational unit, and they cannot see
outside it.

### Administrator

<img src="docs/capturas/painel-da-plataforma.webp" alt="Platform dashboard: reports, overview and activity by unit" width="100%">

People, access and auditing. Competencies and training plans by job title.
Tracks by role and by location. Badges, content library, integrations and the
client's brand.

Reports come out as CSV, scoped by period and by unit.

---

## How progress is measured

Worth understanding before adopting, because this is where platforms differ.

**Completing a lesson requires 90% video coverage with a matching session
time.** Dragging the bar to the end does not count: the actual time watched is
compared against the lesson's duration, and a session that is too short is
refused. Seeking into an unwatched stretch is blocked, and that is configurable
per course: mandatory training and an internal announcement do not call for the
same rigor. Going back is free, and speed goes up to 2x.

**The exam only unlocks once the lessons are done**, and the button says how
many are left instead of letting you click and refusing afterwards. Grades from
0 to 10, with a configurable pass mark. Whoever fails has to **ask the
instructor for a retake**, who grants or refuses it. It is not self-service.

**The certificate is verifiable.** The code at `/validar` is not looked up in a
list: verification re-evaluates enrollment, completion and grade, applying the
same rule as issuance. A certificate belonging to someone who was unenrolled
afterwards does not validate.

---

## Architecture

```
apps/frontend/    Next.js 15 + React 19: screens and HTTP routes
apps/backend/     use cases, repositories and integrations
packages/core/    pure domain rules: no React, no SQL, no framework
infra/            docker-compose, migrations, proxy and tooling
```

The layers have a direction (`frontend → backend → core`) and an automated gate
(`npm run check:layers`) fails an import going the wrong way.

That keeps business rules testable without bringing up infrastructure: the
**1,357 `core` tests run in seconds, with no Docker and no database**. The rule
that decides whether a lesson can be completed is a pure function over numbers;
the repository that reads Postgres is another thing, in another layer.

`apps/backend` does not run a server of its own. It is the layer the Next routes
call: `route.ts` still lives in `apps/frontend/src/app/api/`, because in Next
the route *is* the file. Those routes are thin shells.

### Multi-tenant from the schema up

Every query filters by `tenant_id`, and an automated test covers the isolation
(`query-isolation.test.ts`). The tenant comes from the request's domain; with
no domain registered, it falls back to the default.

---

## Customizing for your client

There are **two layers**, and confusing them is the common mistake.

### The product brand

Whoever operates the platform. It shows up as long as the domain does not
identify any client: the entry page, login, password recovery, certificate
validation.

One file:

```ts
// packages/core/src/brand/brand.config.ts
export const NOME = "Academia ACME";
export const COR  = "#0F766E";
```

Swap the four PNGs in `apps/frontend/public/brand/` (keeping names and
proportions), run `npm run preview` and you are done. The interface's color ramp
lives in `apps/frontend/src/styles/nerd-ds/tokens/colors.css`.

```bash
npm run test:a11y
```

**It fails if the new color does not pass WCAG AA contrast.** That is on
purpose: accessibility is a product standard, not a per-client choice.

### The client brand

Each tenant supplies **one color** and its own logos, through the
Administration → Platform screen. The remaining colors (hover, active, surface,
text color) are derived in `core/tenancy/branding.ts` in a way that can never
fail contrast.

It is a single color because asking for six would invite unreadable
combinations.

The full walkthrough (tenant, domain, email, per-client branding) is in
[WHITELABEL.md](WHITELABEL.md).

---

## Deploying

```bash
git tag v1.0.0 && git push origin v1.0.0
```

The [deploy Action](.github/workflows/deploy.yml) runs the gates, publishes the
image to GHCR and updates the server: it **migrates the database, swaps the
container and waits for the healthcheck** before declaring success. If the
application comes up broken, the job fails with the last 50 lines of the log.

Migrations run **before** the container swap, and each one has to accept the
previous version of the application, which is why a rollback is a tag change
instead of a backup restore.

Without the SSH secrets configured, the Action publishes the image and **skips**
the deploy, without erroring. Three paths (Actions, Compose directly, Cloudflare
Tunnel for a machine with no public IP) in [docs/DEPLOY.md](docs/DEPLOY.md).

---

## Quality

```bash
npm run verify
```

The same thing CI runs:

| Gate | What it catches |
|---|---|
| `test` | 1,444 unit tests |
| `test:a11y` | WCAG AA contrast, token by token, in both themes |
| `quality` | per-page weight budget, image without dimensions, class without CSS |
| `check:imports` | package imported without being declared |
| `check:hydration` | date without a timezone in a client component |
| `perf` | horizontal scrolling, touch target, visible focus |
| `check:sql` | migration structure |
| `check:encoding` | source file outside UTF-8 |
| `check:layers` | import going the wrong way |

The last four run inside the frontend workspace; `npm run verify` at the root
chains them all.

On every PR and every week: CodeQL, `npm audit` and Gitleaks over the history.

The gates exist because each one came out of a defect that slipped through. The
hydration one came from a badge copy button that froze the page; the one for
classes without CSS, from five occasions where a style was reused and the rule
did not come along.

---

## Interoperability

| Standard | Status |
|---|---|
| **SCORM 1.2 and 2004** | imports the package, tracks progress and grade |
| **xAPI (Tin Can)** | built-in LRS, with anonymization |
| **cmi5** | launch and fetch |
| **LTI 1.3** | with AGS (grade passback) and NRPS (class roster) |
| **Open Badges** | issuance with public verification |
| **H5P** | imports `.h5p` as interactive content |
| **LDAP / Active Directory** | directory as the source of identity and role |
| **SAML 2.0, Google, Microsoft** | sign-in with the company account |

Storage is S3-compatible (MinIO in the compose file). Swapping it for real S3 is
an environment variable change, not a code change.

---

## Security

- Containers without root, read-only filesystem, no extra capabilities
- Database and storage **with no published port**: only the proxy talks to the
  internet
- Two networks: the database neither reaches the internet nor is reached by it
- Application role in Postgres **without DDL permission**, separate from the
  schema owner
- Auditing in an insert-only table, with a trigger that refuses UPDATE and
  DELETE
- Secrets encrypted at rest
- Account deletion that the schema promises and the database delivers (LGPD)

Found a flaw? See [SECURITY.md](SECURITY.md). Never in a public issue.

---

## Command reference

| Command | What it does |
|---|---|
| `npm run dev` | Next in development mode, at `localhost:3000` |
| `npm run up` | brings up the full stack behind the proxy |
| `npm run down` | tears the stack down |
| `npm run migrate` | applies the migrations |
| `npm run seed` | staging data (**never in production**) |
| `npm run logs` | follows the logs |
| `npm run verify` | all the gates |
| `npm run typecheck` | types across the three workspaces |
| `npm run preview` | generates the clickable prototype |
| `npm run build` | production build |

`npm run dev` and `npm run up` serve at **different addresses**: the first is
`next dev` with hot reload at `localhost:3000`; the second is the image, behind
the proxy, like in production.

---

## Contributing

[CONTRIBUTING.md](CONTRIBUTING.md). Defects and proposals in
[issues](https://github.com/nerdresolve/NerdLMS/issues); questions in
[discussions](https://github.com/nerdresolve/NerdLMS/discussions).

## License

**Business Source License 1.1**, converting automatically to **Apache 2.0**
after four years. It is the same one MariaDB, Terraform and CockroachDB use, and
the full text is in [LICENSE.md](LICENSE.md).

**Internal use is free, commercial use included.** A company can install it and
train its own employees, contractors, partners, students or customers without
paying anything and without asking permission. Running it multi-tenant too: a
holding company serving its subsidiaries, a franchise network serving its
franchisees, a consultancy training its client base. No user cap, no license
key, no telemetry.

**What needs a conversation** is offering NerdResolve LMS to third parties as a
product or service, competing with the paid version: building a SaaS on top of
this code, or reselling it as your own product. The difference is what is being
sold. Selling training using the platform is free; selling the platform is not.

Every version turns into Apache 2.0 four years after it is published,
automatically and irreversibly. Commercial license:
**contact@nerdresolve.com**.

The font shipped with the repository is **Manrope**, under the
[SIL Open Font License 1.1](apps/frontend/public/fonts/OFL.txt), free to use,
modify and redistribute, including in a commercial fork.

---

<div align="center">
<sub>Built by <a href="https://github.com/nerdresolve">Matheus Mariath</a> · NerdResolve</sub>
</div>

# Security policy

## Reporting a vulnerability

**Do not open a public issue.** Use
[Security → Report a vulnerability](https://github.com/nerdresolve/NerdLMS/security/advisories/new),
which creates a private channel between you and whoever maintains the project.

If you prefer email: **contact@nerdresolve.com**.

It helps a lot to include: what the flaw allows someone to do, the steps to get
there, the version you saw it in, and, if you know, which file is involved.

Reply within 5 business days. Fix according to severity: days for anything that
allows access to another client's data or code execution, weeks for the rest.
You are credited in the advisory unless you ask otherwise.

## Supported versions

| Version | Supported |
| ------- | --------- |
| `main` | yes |
| latest minor release | yes |
| earlier ones | no |

## Surfaces that deserve attention

A report here is worth more than one elsewhere:

- **Isolation between clients.** The platform is multi-tenant. Every query
  filters by `tenant_id`, and an automated test (`query-isolation.test.ts`)
  covers that. A path that returns another client's data is the worst possible
  flaw here.
- **Authorization by role.** Student, instructor, manager and administrator see
  different things. A route that does not check the role is a security defect,
  not an interface one.
- **Exam answer keys.** The correct answers must not reach whoever is answering
  before the result exists (`no-answer-leak.test.ts`).
- **Upload.** SCORM, H5P and video are ZIPs uploaded by users. Zip slip, ZIP
  bombs and executable content are real vectors.
- **SSO / SAML / LDAP.** Signature verification, issuer validation, assertion
  replay.
- **Certificates and badges.** The verification code must be neither guessable
  nor allow enumerating who completed what.

## What the project already does

- Containers without root, read-only filesystem, no extra capabilities, and no
  published database port (`infra/docker-compose.yml`)
- Application role in Postgres without DDL permission, separate from the schema
  owner (migration `002`)
- Auditing in an insert-only table, with a trigger that refuses UPDATE and
  DELETE
- Secrets encrypted at rest (`backend/src/crypto/secret-box.ts`)
- CodeQL, `npm audit` and Gitleaks on every PR and weekly
  (`.github/workflows/seguranca.yml`)

## When deploying

No `.env` is committed. Copy the example, generate your own secrets, and do not
reuse the ones from another environment:

```bash
cp infra/.env.example infra/.env
openssl rand -hex 32    # a NEW value for each secret
```

The staging seed (`infra/db/seeds/hml.sql`) uses passwords derived from the
login and **refuses to run** without `-v allow_seed=yes`. Never point it at
production.

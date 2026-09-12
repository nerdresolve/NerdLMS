# How to contribute

Thanks for your interest. This guide is short on purpose.

## Before you start

For a **defect or a proposal**, open an issue first. For a **question**, use
[Discussions](https://github.com/nerdresolve/NerdLMS/discussions). For a
**vulnerability**, see [SECURITY.md](SECURITY.md). Never in a public issue.

## Running the project

```bash
npm ci
cp infra/.env.example infra/.env.local   # set SITE_ADDRESS=localhost
npm run up                                # brings up database, storage and proxy
npm run migrate                           # applies the schema
npm run seed                              # staging data (optional)
npm run dev
```

Node 22 or newer (`.nvmrc`). Docker for the database and storage.

Without Docker you can still get far: the tests, the accessibility gates and the
prototype in `preview/` run with nothing installed but npm.

## Before opening the PR

```bash
npm run verify
```

That runs everything CI runs: tests, WCAG AA contrast, WCAG 2.2 criteria,
prototype generation, static quality gates, declared imports, hydration, SQL,
file encoding and layer direction. If it passes here, it passes there.

## What the project expects from the code

**The layers have a direction.** `frontend → backend → core`. `core` knows
nothing about React or Postgres: it is pure domain rules, and that is why they
are testable without bringing anything up. `check-layers.mjs` fails an import
going the wrong way.

**Business rules live in `core`.** If the rule sits in a component or a route,
it has no test and it will drift from the next screen that needs it.

**A comment explains the why, not the what.** The code already says what it
does. The comment records the decision: what was tried before, what broke, why
this shape and not the obvious one. A comment that paraphrases the next line is
noise.

**Portuguese in what the user reads and in what the team reads.** Interface,
comments, commit messages and migration names in Portuguese. Code identifiers in
English when the term is technical (`enrollment`, `tenant`), in Portuguese when
it is domain vocabulary (`aproveitamento`, `trilha`).

**No credentials, real email addresses or client names.** The repository is
public and white-label. In examples, use `exemplo.com.br`.

**The schema changes through migrations.** Numbered, never edited after they are
applied. And a migration has to accept the PREVIOUS version of the application:
the deploy migrates before swapping the container, and that is what makes it
possible to roll back without restoring a backup. A change that breaks the
previous version becomes two releases.

## Customizing for another client

If your goal is to run this under another brand, you probably do not need a PR,
you need [WHITELABEL.md](WHITELABEL.md), which covers branding, colors, domain
and tenant without touching product code.

A feature that only makes sense for one organization usually fits better in a
fork. Whatever serves any install is welcome here.

## Commits

Message in the imperative, explaining the effect: `corrige contraste do hover no
tema escuro`, not `mudanças no css`. The body, when there is one, says why.

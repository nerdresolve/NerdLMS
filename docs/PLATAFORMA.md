# Our platform, in full

Functional and technical documentation of the organization's e-learning
platform. This is the long document: what exists, how it works and **why** it
was built this way. To get started quickly, see [`../README.md`](../README.md);
for the presentation, [`ROTEIRO-APRESENTACAO.md`](./ROTEIRO-APRESENTACAO.md).

**State as of 27 August 2026**: 35 screens, 38 migrations, 81 tables, 1,214
automated tests, 7 real courses imported.

---

## Contents

1. [Why we built our own](#1-why-we-built-our-own)
2. [Learning: from enrollment to certificate](#2-learning-from-enrollment-to-certificate)
3. [Assessment: grade, failure and retake](#3-assessment-grade-failure-and-retake)
4. [Certificate and public validation](#4-certificate-and-public-validation)
5. [Teaching: the course editor](#5-teaching-the-course-editor)
6. [Managing: team, auditing and platform](#6-managing-team-auditing-and-platform)
7. [Signing in: password and company account](#7-signing-in-password-and-company-account)
8. [One install that can hold more than one organization](#8-one-install-that-can-hold-more-than-one-organization)
9. [Interoperability](#9-interoperability)
10. [Architecture](#10-architecture)
11. [Real content](#11-real-content)
12. [Operations](#12-operations)
13. [What does not exist yet](#13-what-does-not-exist-yet)

---

## 1. Why we built our own

The current license caps us at **500 active users** for the whole organization.
The limit is commercial, not technical: every additional person is a
negotiation, and training planning comes to depend on when renegotiating is
possible.

The second cost is less visible and weighs more in the long run. Who trained, in
what, with what grade and on what date lives in a vendor's database. In an
audit, the answer depends on asking them for it. If the contract ends, the
history is whatever they export.

With the platform under our own management, the cap goes away and the history is
kept in-house. The additional features implemented in the meantime (graded
exams, verifiable certificates and Active Directory authentication) follow from
that development autonomy.

---

## 2. Learning: from enrollment to certificate

### Enrollment

Three paths, and the difference matters for mandatory training:

| Mode | Who starts it |
|---|---|
| Open | the person themselves, from the catalog |
| Assigned | the manager puts the team in |
| By class | a group with a date and an instructor |

A student enrolls **themselves and nobody else**. A manager enrolls the team
**of their own project**.

### The player lock

Without progress tracking, completing a lesson comes down to a single click, and
the training record ends up attesting to content that may never have been
watched. In operational safety training, that record is used as evidence of
qualification.

Three rules, in `packages/core/src/courses/watch-guard.ts`:

1. **90% coverage** of the video before completion is unlocked.
2. **Matching time.** The session's duration has to be consistent with the
   stretch watched, which prevents counting a video that is playing unattended.
3. **No seeking** beyond the furthest point already reached. Going back is
   allowed; seeking into an unwatched stretch is not.

**Playback speed can go up to 2x.** Restricting speed would tend to induce the
very behavior the control is meant to prevent, with the video playing
unattended.

> **Fix applied during development.** The first implementation recorded progress
> even when seeking was blocked. In testing, a hundred consecutive requests
> reached 81% of an unwatched video, because the tolerance was consumed on every
> call rather than per reference point. The current version does not record when
> seeking is blocked.

### Lesson formats

Video (MP4), document (PDF, with a count of pages read), text, external link,
interactive content and **SCORM 1.2 / 2004** packages.

The file is transferred straight to storage through a short-lived signed URL,
without passing through the application. A two-hour file moving through the
process would hurt the response time of every other page.

### Course completion

A course is complete when **the lessons are done and the exam is passed**. Four
states, in `packages/core/src/courses/completion.ts`:

| State | Means |
|---|---|
| `nao-comecou` | enrolled, nothing watched |
| `em-andamento` | lessons under way |
| `falta-prova` | lessons completed, exam pending or failed |
| `concluido` | lessons **and** exam |

In that state the course card shows **"Exam pending"**, not "100%". The
percentage refers to the lessons only, and the bare number would be read as
completion of the course.

---

## 3. Assessment: grade, failure and retake

### The scale

Grades from **0 to 10**, passing at **8.0**.

The database column stays in percent. Converting it would rewrite every grade
already recorded, and migrations that alter history are hard to audit after the
fact. The 0-to-10 scale is applied at the presentation layer.

Rounding uses one decimal place. Two would imply a precision that a five-question
exam does not have. Passing follows the displayed value: 79.96% is shown as 8.0
and passes, so that the grade displayed and the decision agree.

### The exam requires the lessons

The button stays **disabled** and says how many lessons are left. In the previous
version the button was enabled and the attempt was refused on an error screen,
which took the student out of the course page.

### Retake by request

Whoever fails gets **one attempt**. Retaking depends on asking the instructor.

```
student fails → requests a retake (justification optional)
             → instructor decides at /instrutor/correcao (comment MANDATORY)
             → granted: +1 attempt   |   refused: the reason is on record
```

**On choosing a single attempt.** With unlimited attempts, the first exam starts
working as a practice run, and the failure is not recorded anywhere. Requiring
the request keeps a record of both the failure and the decision that granted the
new attempt.

**The student's justification is optional; the instructor's comment is
mandatory.** The comment records the reason for granting it, information an audit
needs, and tells the student why it was refused. The requirement is implemented
in the code and in a `CHECK` in migration 038, so that an `INSERT` executed
outside that path is refused too.

**One open request at a time**, guaranteed by a partial unique index. Without
that constraint, two clicks would create two requests, and approving both would
grant two attempts.

### Essay grading

An exam with an open question stays in `needs_review`, and the grade is only
finalized after the instructor grades it. Recording it early would store a
percentage subject to change.

---

## 4. Certificate and public validation

The PDF is generated by our own code, with no external dependency, and carries
the name, course, hours, completion date, the **responsible instructor's
signature** and a verification code in the footer.

### Validation is real

`/validar?codigo=XXXXXXXXXXXX`, with no sign-in required, since the recipient of
a certificate normally does not have an account on the platform.

The check looks at **three things**: the enrollment exists, the course was
completed, and the grade reached the minimum.

> **On checking the grade.** In the previous implementation, the check considered
> only the lessons. A course with a mandatory exam refused *issuance* for lack of
> a grade, while `/validar` answered "valid" for the same enrollment: anyone who
> failed could publish the code and the check would confirm a document that was
> never issued. The rule became the same at both points, which keeps two
> definitions of completion from drifting apart over time.

An invalid code gets the answer **"Code does not match"**, without indicating
whether the enrollment exists, whether there was a failure, or which of the three
conditions failed. Distinguishing between those cases would reveal information to
someone who should not have it.

---

## 5. Teaching: the course editor

Course → modules → lessons. Reordering by dragging. Upload of video, PDF and
SCORM packages.

**The boundary is authorship.** The instructor creates freely and edits,
publishes or archives **only what is theirs**. They follow the progress of
students on their own courses and do not change it.

**There is no delete course.** Deleting would take enrollments, progress and
comments with it, and a certificate already issued would stop checking out in the
validator. Archiving is the way: the course leaves the catalog and stops
accepting enrollment, but whoever was already taking it keeps access, certificate
included.

**Publishing requires at least one lesson.** The count comes from the database,
not from what the client claims: publishing an empty course would leave people
enrolled in nothing.

**Required fields block submission and say what is missing.** The message is
defined by the application, not by the browser: the browser's default message
follows its own interface language, and would show *"Please fill out this
field."* on an install configured in Portuguese.

---

## 6. Managing: team, auditing and platform

**Manager**: a dashboard for their own project and their own team. Who finished,
who is behind, who never started. Enrolls people in mandatory training. Does not
edit content.

**Administrator**: people and roles, bulk CSV import, access and SSO, auditing,
competencies, badges, integrations, branding, enabled features, email copy and
backup.

### Auditing

`audit_log` is **insert-only**: `UPDATE` and `DELETE` revoked even for the
application, with a trigger that refuses them even if someone grants the
permission back by mistake. A record you can edit is not a record.

The table stores `actor_name` separately from `actor_id`, and the key uses
`ON DELETE SET NULL`, so that an employee leaving does not remove the record of
the actions they performed.

The same goes for `xapi_statements` and `grade_entries`.

### Features that can be switched off

Per organization: comments, forum, notifications, tracks, schedule,
gamification, certificates, bookmarks and global search. Switching one off
removes the screen and the route as well, so going straight to the address does
not work either.

**Rewards with a financial counterpart were removed.** Items that would require
the company to buy something would tie gamification to a budget, and the
platform would start offering benefits whose delivery does not depend on it.

---

## 7. Signing in: password and company account

Full detail in [`PERFIS-E-ACESSOS.md`](./PERFIS-E-ACESSOS.md). In short:

- **Local password**: scrypt with a per-user salt, at OWASP's parameters.
- **Session**: the database stores the token's *hash*, not the token.
- **Cookie**: `HttpOnly`, `Secure`, `SameSite=Lax`, `__Host-` prefix.
- **A generic error** for a wrong password and a nonexistent account alike.
- **Lockout** at 10 failures per IP in 15 minutes.

### LDAP and Active Directory

Implemented from scratch: BER encoding, `BindRequest`, `SearchRequest`, reading
the responses and the sub-codes the AD hides in the diagnostic message
(`data 52e`, `533` and `532`, among others).

**The filter is a BER tree, not assembled text.** The value typed in travels
inside an `OCTET STRING` and its bytes are never read as syntax: typing
`*)(objectClass=*` does not turn "who is so-and-so?" into "give me everybody".
The filter injection category **does not apply by construction**. The test
covering that behavior compares the bytes against RFC 4511, not against the
encoder itself, which would hide a symmetric error.

The role comes from the **group in the directory**, with the highest one
winning. Whoever joins the instructors group becomes an instructor; whoever
leaves stops being one.

Two production locks: `allow_password_login = false` (the local password stops
working) and `require_group = true` (no mapped group, no entry).

**Today it is switched off.** It was proven against the organization's real AD;
switching it on is one line of SQL, and it is a decision for whoever operates it.

### SAML 2.0, Google and Microsoft

Also implemented, with our own signature verification. Configuration lives at
`/admin/acesso`.

---

## 8. One install that can hold more than one organization

Today there is **just one tenant**, the organization's, and every course, person
and grade belongs to it. But the platform was built knowing how to keep
organizations apart: `tenant_id` is in **42 tables**, and nothing crosses from
one to another.

**That matters to us for two reasons, and neither of them is selling the
platform to third parties.**

The first is today. The scoping is the same mechanism that guarantees a badly
written query does not return data from outside the scope that was asked for. It
is exercised on every build by
`apps/backend/src/tenancy/query-isolation.test.ts`, which **fails** if someone
writes a query without the scope. It is the only guarantee that survives whoever
did not read the documentation.

The second is the day the organization wants to train **people who are not
employees**: a contractor in the field, a partner company, a supplier who needs
the safety induction before entering the site. That audience must not see the
internal catalog or show up in HR reports, and should not sign in through our
Active Directory. With the isolation already in place, that is configuration;
without it, it would be another system.

In the permission rule, the organization check precedes the role check. In the
reverse order, the administrator block would already have authorized access
before the organization was evaluated.

The walkthrough for configuring an install from scratch is in
[`../WHITELABEL.md`](../WHITELABEL.md). It serves both for reconfiguring ours and
for that scenario.

---

## 9. Interoperability

| Standard | Status |
|---|---|
| SCORM 1.2 and 2004 | imports the package, runs it and records |
| xAPI | sends and receives statements |
| cmi5 | launch and session |
| LTI 1.3 | launch and grade passback (AGS) |
| QTI | imports and exports questions |
| CSV | imports users and questions; exports reports |

All written in this repository, with no third-party library. That is a decision,
not stubbornness: the `@nerdlms/core` package **declares no runtime
dependencies**, and it is the `package.json` that proves it, not a promise in a
README.

---

## 10. Architecture

```
packages/core/      domain rules. No framework, no dependencies.
apps/backend/       talks to PostgreSQL and to outside systems.
apps/frontend/      Next.js 15 + React 19. Screens and HTTP routes.
infra/              Docker, PostgreSQL, MinIO, Caddy.
```

**Three layers, and the bottom one knows nothing about the top.** The domain does
not know what React, an HTTP request or a database is. The backend knows nothing
about Next. This is not purism: it is what makes 1,127 rule tests run in 17
seconds without bringing anything up.

### Why there is no HTTP server of our own

Next already serves HTTP. An additional server would require a second image, a
second deploy, CORS configuration and one more exposed port, with nothing in
return at the current scope. The routes are thin layers that call the use case;
if the API is ever pulled out of Next, only the `route.ts` files are thrown away.

### What is derived and what is stored

**Derived by query**: progress, track percentage, coins earned, vote counts,
active users. A stored counter drifts out of sync and nobody notices until a
report comes out wrong.

**Stored, because it is an event**: progress watched, vote cast, coin spent, exam
attempt, grade recorded, retake request, and everything in `audit_log`.

The weekly vote budget, for instance, is a `COUNT(*)` over the current ISO week.
A stored balance would allow spending twice in a race between requests.

### Secrets that have to come back

A person's password becomes a hash and never comes back. The Active Directory
service account's password does not work that way: the application has to present
it to the directory.

`apps/backend/src/crypto/secret-box.ts` encrypts with AES-256-GCM using a key
derived from `SESSION_SECRET` via HKDF, with a per-use label. The protection
covers the scenario where the secret leaves along with a **database dump**: a
backup copied, or a staging replica restored from the production database. It
does **not** cover code execution on the server itself, a limitation recorded in
the file's header.

---

## 11. Real content

Seven courses, all of them the organization's procedures. Five with an exam (30
questions, full answer key), two without.

The video files add up to 522 MB and are **not committed**. The repository stores
the JSON with the structure, exams and answer key. The import is split across
three tools, because transferring video is slow and prone to network failure,
unlike writing to the database:

```bash
node infra/tools/parse-cursos.mjs <folder>   # material → infra/db/content/cursos.json
node infra/tools/upload-cursos.mjs <folder>  # videos → storage
node infra/tools/import-cursos.mjs           # courses, lessons and exams → database
```

Merging upload and import would make a network failure undo the whole import.

**Idempotent**: each id derives from the procedure's code, and every write is
`ON CONFLICT DO UPDATE`. Running it again after fixing an answer key updates
without duplicating a course or losing an enrollment.

Duration is read from the MP4's `mvhd` header by
`infra/tools/duracao-mp4.mjs`, with no dependency on ffmpeg. One of the videos is
fragmented MP4 and declares zero duration in the main header; in that case the
duration is obtained by summing the fragments.

Title and summary are curated in a table **inside the parser**, not in the JSON:
the JSON is output and would be overwritten on the next run.

### The demo scenario

```bash
node infra/tools/cenario-demo.mjs
```

The videos run between 56 and 85 minutes, and progress tracking is applied in
full, which makes completing a course during a demo impossible. The script
records progress equivalent to that of someone who watched the content, in the
same tables normal operation uses and with no demo marker. Records the
application would not produce would lead to screens it never reaches in real
use.

---

## 12. Operations

### One environment per Compose project

| Command | Environment file | Compose project |
|---|---|---|
| `npm run up`, `migrate`, `seed`, `logs` | `infra/.env` | `nerdlms` |
| `npm run publish`, `migrate:tunnel` | `infra/.env` + `infra/.env.tunnel` | `nerdlms` |

**Never run `docker compose` without `-p`**: without it Compose infers the name
from the folder, and that inference cannot tell two installs on the same machine
apart.

### Gates

```bash
npm run typecheck
npm run test          # 1,127 + 49 + 38
npm run lint
npm run check:sql
npm run check:imports
npm run verify        # the above minus typecheck, plus the prototype audits
```

`verify` does **not** run `typecheck`. Before committing, run both.

### Database

Neither PostgreSQL nor MinIO publishes a port. Only the proxy talks to the
internet, and the internal network is `internal: true`.

The application does **not** use the schema owner: `lms_migrator` migrates,
`lms_app` runs without DDL. If there is a SQL injection, the damage does not
reach the structure.

> The roles (`lms_migrator`, `lms_app`) and the bucket (`lms-media`) carry the
> product's name, not the client's, and that is on purpose: one install serves
> several clients, and a client's name in the infrastructure would age badly.
> Renaming them on a database already in use is an infrastructure migration, with
> a risk of leaving the application unable to connect halfway through. The
> `035_tenant_do_cliente` migration is where an install declares whose it is.

Details in [`../infra/db/README.md`](../infra/db/README.md).

---

## 13. What does not exist yet

| Open item | Impact |
|---|---|
| **Certificate domain** | The verification address comes from `tenants.domain`, currently empty: the footer prints a note instead of an address. The code is valid and verification works. **Declare the domain once DNS points at the install**, as in `docs/DEPLOY.md`. |
| **Backup** | Not configured. RPO and RTO need to be decided. Both volumes (`db-data` and `storage-data`) have to be in the copy: `pg_dump` does not take the videos. |
| **Migration rollback** | Every file applies; none undoes. Either there comes to be a `down`, or the policy is restoring a backup. |
| **Seed vs. real content** | `npm run seed` inserts 7 fictional courses with `ON CONFLICT DO UPDATE`. On a database that already holds the real content, the catalog goes back to mixing the two. See [`HOMOLOGACAO.md`](./HOMOLOGACAO.md). |
| **CSP** | `'unsafe-inline'` in `script-src` (ISSUE-028). No external origin executes script, but the protection against injected inline script is open. |
| **Final catalog** | Seven courses went in. The rest depends on HR. |
| **Partitioning `audit_log`** | Not a problem in the first year; it is in the third. |

The reasoning behind each technical decision, numbered, is in
[`progress.md`](./progress.md).

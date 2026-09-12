# Roles and access

What each role is responsible for on the organization's training platform, the
permission restrictions applied to each one, and the accounts used in staging.

The rules described here were verified against the running application, not
inferred from the source code.

> There is a PDF version, carrying the company's visual identity, at
> [`NerdResolve-Energy-Perfis-e-Acessos.pdf`](./NerdResolve-Energy-Perfis-e-Acessos.pdf).
> The content is the same. To regenerate it after changing a rule:
>
> ```bash
> npm run guia:perfis
> ```

---

## Staging accounts

The display name matches the account's role, which makes it easy to tell which
view is being demonstrated. **The password is the login without the dot.**

| Role | Sign in with | Password | Display name | Unit |
|---|---|---|---|---|
| Student | `user.mock` | `usermock` | Aluno | Siririzinho |
| Instructor | `instructor.mock` | `instructormock` | Instrutor | Unidade Norte |
| Instructor | `instructor2.mock` | `instructor2mock` | Instrutor 2 | Riachuelo |
| Manager | `manager.mock` | `managermock` | Gestor | Unidade Norte |
| Administrator | `admin.mock` | `adminmock` | Administrador | Sede |

The full email address (`admin.mock@exemplo.com`) is also accepted in the login
field.

The dataset also includes eight users with real-looking names and no password,
in the invited state. They do not sign in, and exist to populate the management,
team and engagement screens.

> **The accounts above are for staging and should not be created in
> production**, since their password is derived from the login. Loading the
> staging data requires the `-v allow_seed=yes` flag to run, which prevents
> applying it to a production environment by accident.

---

## Responsibilities by role

### Student

The default role, assigned to every person created from the organization's
Active Directory.

| Screen | Purpose |
|---|---|
| `/dashboard` | resume from the last point, progress and deadlines |
| `/meus-cursos` | courses they are enrolled in |
| `/cursos` | catalog, with self-enrollment in courses open for registration |
| `/concluidos` | finished courses, lessons and exam included |
| `/favoritos` | bookmarked courses |
| `/trilhas` | course sequences |
| `/conquistas` | badges and level |
| `/agenda` | calendar and notices |
| `/cursos/<slug>` | course page, with the assessment block |
| `/aulas/<id>` | player, with progress tracking |
| `/provas/<id>` | exam, once unlocked |
| `/perfil` | details, certificates, signature and notification preferences |

**Restrictions.** The `/admin`, `/instrutor/*` and `/gestor/*` routes return HTTP
404. Choosing 404 over 403 avoids confirming that the screen exists to someone
who has no permission to reach it.

The student reads and writes only their own progress, and enrolls only
themselves.

### Instructor

Responsible for the content. Editing permissions are bounded by authorship: each
instructor changes only the courses they created.

| Screen | Purpose |
|---|---|
| `/instrutor/cursos` | courses they authored |
| `/instrutor/cursos/<id>` | editor: modules, lessons, media and exam |
| `/instrutor/correcao` | essay grading and the retake request queue |
| `/instrutor/engajamento` | video drop-off points, per lesson |
| `/perfil` | includes uploading the signature applied to certificates |

**Restrictions.** Does not edit, publish or archive another instructor's course.
Does not enroll anyone, which is the manager's responsibility. Reads the progress
of students on their own courses, with no permission to change it.

The Professor marker on comments requires the instructor role and authorship of
the course. It indicates authorship of the content, not hierarchy, which is why
it is not given to the administrator.

### Manager

Follows the team. Every query is bounded by the project the manager belongs to.

| Screen | Purpose |
|---|---|
| `/gestor` | project indicators |
| `/gestor/equipe` | people on the project, with individual progress |

**Restrictions.** Does not read people from another project. Does not create or
edit content, which is the instructor's responsibility. Does not decide retake
requests. Analytics queries are limited to the `project` scope of their own
project.

The manager performs assigned enrollment, used to enroll the team in mandatory
training.

### Administrator

Broad access to the platform, with three restrictions defined by design.

| Screen | Purpose |
|---|---|
| `/admin` | overview dashboard |
| `/admin/usuarios` | invitation, role, status and bulk import |
| `/admin/acesso` | Active Directory, SAML, Google and Microsoft |
| `/admin/auditoria` | action log, with author and date |
| `/admin/analytics` | consolidated analytics |
| `/admin/competencias` | competency map |
| `/admin/badges` | badges |
| `/admin/integracoes` | LTI, xAPI and webhooks |
| `/admin/plataforma` | branding, enabled features, email copy and backup |

**The three restrictions:**

1. **Another organization's data.** The `tenant_id` check precedes the role rule.
   Since there is one organization registered, the restriction is not currently
   exercised; it applies to the scenario of training contractors or partners,
   with a catalog separate from the internal one.
2. **The Professor marker.** Not granted, as described under the Instructor
   role.
3. **Editing another author's comment.** The moderation available is removal,
   which is recorded in the audit log. Editing would allow changing the meaning
   of a message while keeping the original authorship.

The administrator's actions are recorded in the audit log.

---

## How authorization is resolved

The decision is made by a single function, `can(ator, ação, recurso)`, in
`packages/core/src/auth/permissions.ts`. It depends on neither HTTP nor the
database: it takes the actor, the action and the resource, and returns the
authorization.

The same function is called by the interface and by the API routes, so that the
permission shown on screen and the one enforced on the server do not diverge.

The order of evaluation is as follows:

| Order | Check |
|---|---|
| 1 | **Organization.** Resources belonging to another organization are denied before any role check. |
| 2 | **Administrator.** Authorized, except for the three restrictions above. |
| 3 | **Manager.** Authorized within the project they belong to. |
| 4 | **Instructor and Student.** Evaluated by course authorship and by enrollment. |

### Verified restrictions

The attempts below were executed against the application. All of them return
HTTP 404.

| Role | Routes | Response |
|---|---|---|
| Student | `/admin`, `/admin/usuarios`, `/admin/auditoria` | 404 |
| Student | `/instrutor/cursos`, `/instrutor/correcao` | 404 |
| Student | `/gestor/equipe` | 404 |
| Instructor | `/admin/usuarios`, `/admin/auditoria`, `/admin/plataforma` | 404 |
| Manager | `/admin/usuarios`, `/admin/plataforma` | 404 |
| Manager | `/instrutor/correcao` | 404 |

---

## Corporate authentication

The platform supports LDAP/Active Directory, SAML 2.0, Google and Microsoft. The
role assigned to the user is derived from the group they belong to in the
directory, which removes the need to maintain a duplicate set of records.
Configuration lives at `/admin/acesso`.

**The integration with the organization's Active Directory is configured and
disabled.** Authentication was validated against the production directory,
including interpreting the error sub-codes the AD returns. The platform runs on
local passwords until the integration is enabled:

```sql
UPDATE ldap_directories SET enabled = true WHERE kind = 'ad';
```

Two columns in the same table define how strict it is:

- **`allow_password_login = false`**: the local password stops being accepted,
  and sign-in happens exclusively through the directory. This is the production
  configuration, and it prevents local accounts from persisting outside the AD's
  control.
- **`require_group = true`**: requires the user to belong to one of the mapped
  groups. Without that requirement, any valid domain account would be
  authenticated with the student role.

The full configuration procedure is in
[`../WHITELABEL.md`](../WHITELABEL.md).

---

## Sign-in security

| Item | Implementation |
|---|---|
| Password | scrypt hash with a per-user salt, at the parameters OWASP recommends. The database does not store passwords in plaintext. |
| Cookie | `HttpOnly`, `Secure`, `SameSite=Lax`, with the `__Host-` prefix. |
| Session | The database stores the token's hash, not the token. |
| Error message | Identical for a wrong password and a nonexistent account, so as not to reveal which accounts exist. |
| Lockout | 10 failures per IP in 15 minutes suspend further attempts. |
| Auditing | Sign-in, sign-out, role changes and administrative actions are written to `audit_log`. |

The `audit_log` table is insert-only. `UPDATE` and `DELETE` permissions are
revoked even for the application user, and a trigger refuses the operation should
the permission ever be granted again.

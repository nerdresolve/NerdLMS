/**
 * Gera `infra/db/seeds/hml.sql` a partir dos dados fictícios.
 *
 * Por que gerar em vez de escrever à mão: as aulas e o progresso do mock vêm de
 * funções (`lessons()`, `completeFirst()`), não de literais. Transcrever isso
 * para SQL manualmente criaria duas versões da mesma história, que divergem no
 * primeiro ajuste — e ninguém percebe, porque as telas leem do mock e o seed
 * só é visto por quem abre o banco.
 *
 * As senhas são derivadas do papel (`admin.mock` / `adminmock`) e viram hash
 * Argon2id aqui, no momento da geração: o SQL nunca carrega senha em texto.
 *
 * Uso: node infra/tools/build-seed.mjs
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { hashPassword } from "@nerdlms/core/auth/password.ts";
import { isLessonCompleted } from "@nerdlms/core/courses/progress.ts";
import {
  allCourses,
  allEnrollments,
  allUsers,
  comments,
  events,
  materials,
  notifications,
  tracks,
} from "../../apps/frontend/src/mocks/data.ts";
import { uuidForMockId } from "../../apps/frontend/src/mocks/seed-ids.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const out = join(root, "infra", "db", "seeds", "hml.sql");

/** Escapa um literal de texto para SQL. `null` vira NULL sem aspas. */
const lit = (value) =>
  value === null || value === undefined ? "NULL" : `'${String(value).replace(/'/g, "''")}'`;

/* A derivação mora em `apps/frontend/src/mocks/seed-ids.ts` porque os dois
   lados precisam concordar: este gerador escreve o SQL, e `repository.ts` lê o
   id de volta. Duas cópias divergiriam em silêncio. *//** Atalho: id do mock -> literal SQL do UUID correspondente. */
const uid = (key) => lit(uuidForMockId(key));

/**
 * Login descritivo por papel, como pedido: o identificador diz a função, não um
 * nome inventado. Dois instrutores existem, então o segundo recebe sufixo.
 */
const LOGIN_BY_ID = {
  u1: "user.mock",
  u2: "instructor.mock",
  u3: "instructor2.mock",
  u4: "manager.mock",
  u9: "admin.mock",
};

/** A senha é o login sem o ponto: `admin.mock` -> `adminmock`. */
const passwordFor = (login) => login.replace(".", "");

/**
 * O e-mail de quem não tem login de teste.
 *
 * A turma (`s1`, `s2`…) entra no seed para as telas de gestão terem o que
 * mostrar — equipe, engajamento, usuários ativos —, mas **sem senha**: essas
 * pessoas não são para entrar, são para aparecer. `password_hash` nulo é
 * exatamente o estado "convidado, ainda não acessou" que a migração 001
 * descreve, e é o que a gestão de usuários precisa exibir.
 */
const emailOf = (user) => user.email ?? `${user.id}@exemplo.com.br`;

/**
 * "480 kB" / "1,2 MB" -> bytes.
 *
 * O mock guarda o tamanho já formatado, porque é o que a tela mostra; a tabela
 * guarda bytes, porque é o dado. A conversão fica aqui para não existirem duas
 * verdades sobre o mesmo arquivo — o repositório formata de volta na leitura.
 */
const bytesFromLabel = (label) => {
  const m = /^([\d.,]+)\s*(KB|kB|MB)$/.exec(String(label).trim());
  if (!m) return 1024;

  const valor = Number(m[1].replace(".", "").replace(",", "."));
  if (!Number.isFinite(valor)) return 1024;

  return Math.round(valor * (m[2].toUpperCase() === "MB" ? 1024 * 1024 : 1024));
};

/** Índice de aulas por id, para derivar `completed_at` a partir da duração. */
const lessonById = new Map(
  allCourses.flatMap((course) => course.modules.flatMap((module) => module.lessons.map((l) => [l.id, l]))),
);

/* O tenant é resolvido por subconsulta, não por UUID literal: o seed não sabe
   qual id a migração gerou, e fixar um aqui amarraria os dois arquivos. */
const TENANT = "(SELECT id FROM tenants WHERE slug = 'lms')";

/* Idem para a unidade: o texto do mock vira referência. `LIMIT 1` porque o
   nome é único dentro do tenant, e `NULL` quando o mock não tem projeto. */
const unidade = (nome) =>
  nome
    ? `(SELECT id FROM org_units WHERE tenant_id = ${TENANT} AND name = ${lit(nome)} LIMIT 1)`
    : "NULL";

const lines = [];
const w = (s = "") => lines.push(s);

w("-- =============================================================================");
w("-- Seed de homologação — usuários, catálogo e matrículas.");
w("--");
w("-- GERADO POR `node infra/tools/build-seed.mjs`. Não edite à mão: os dados vêm");
w("-- de `apps/frontend/src/mocks/data.ts`, e é de lá que as telas leem. Editar só");
w("-- aqui faria o banco contar uma história diferente da interface.");
w("--");
w("-- NUNCA RODE EM PRODUÇÃO. As senhas são derivadas do login (`admin.mock` tem");
w("-- senha `adminmock`), o que é adequado para homologação e inaceitável fora");
w("-- dela. O bloco abaixo recusa a execução se o banco não parecer de HML.");
w("-- =============================================================================");
w();
w("BEGIN;");
w();
w("-- Trava explícita. O seed só roda se quem o executa afirmar, no comando, que");
w("-- este banco é de homologação:");
w("--");
w("--   psql -v allow_seed=yes -f hml.sql");
w("--");
w("-- Rodar sem isso falha e nada é escrito. É deliberado: um seed com senha");
w("-- previsível não pode entrar em produção por descuido de quem digitou o");
w("-- comando errado.");
w("\\if :{?allow_seed}");
w("\\else");
w("  \\echo 'ERRO: seed de HML. Rode com -v allow_seed=yes se este banco for de homologação.'");
w("  \\quit 1");
w("\\endif");
w();

/* ------------------------------------------------------------------ usuários */
w("-- ----------------------------------------------------------------- usuários");
w("-- `ON CONFLICT` mantém o seed reaplicável, como as migrações 001 e 002.");
for (const user of allUsers) {
  const login = LOGIN_BY_ID[user.id];

  /* Só os cinco perfis nomeados têm senha. A turma entra para as telas de
     gestão terem gente de verdade, e fica sem hash — que é o estado
     "convidado" e também impede que alguém entre com uma conta de figuração. */
  const email = login ? `${login}@exemplo.com.br` : emailOf(user);
  const hash = login ? lit(hashPassword(passwordFor(login))) : "NULL";
  const status = login ? "active" : (user.status ?? "active");

  w(
    `INSERT INTO users (id, tenant_id, org_unit_id, email, full_name, password_hash, role, status, project, region, last_access_at)\n` +
      `VALUES (${uid(user.id)}, ${TENANT}, ${unidade(user.project ?? null)},\n` +
      `        ${lit(email)}, ${lit(user.fullName)}, ${hash},\n` +
      `        ${lit(user.role)}, ${lit(status)}, ${lit(user.project ?? null)}, ${lit(user.region ?? null)},\n` +
      `        ${user.lastAccessAt ? lit(user.lastAccessAt) : "NULL"})\n` +
      `ON CONFLICT (id) DO UPDATE SET\n` +
      `  email = EXCLUDED.email, full_name = EXCLUDED.full_name,\n` +
      `  password_hash = EXCLUDED.password_hash, role = EXCLUDED.role,\n` +
      `  status = EXCLUDED.status, project = EXCLUDED.project, region = EXCLUDED.region,\n` +
      `  last_access_at = EXCLUDED.last_access_at;`,
  );
}
w();

/* -------------------------------------------------------------------- cursos */
w("-- ------------------------------------------------------------------- cursos");
for (const course of allCourses) {
  w(
    `INSERT INTO courses (id, tenant_id, org_unit_id, author_id, slug, title, summary, status, enrollment_mode)\n` +
      `VALUES (${uid(course.id)}, ${TENANT}, ${unidade(course.project ?? null)},\n` +
      `        ${uid(course.authorId)}, ${lit(course.slug)}, ${lit(course.title)},\n` +
      `        ${lit(course.summary)}, ${lit(course.status)}, ${lit(course.enrollmentMode)})\n` +
      `ON CONFLICT (id) DO UPDATE SET\n` +
      `  title = EXCLUDED.title, summary = EXCLUDED.summary, status = EXCLUDED.status;`,
  );
}
w();

/* ------------------------------------------------------------ módulos e aulas */
w("-- ---------------------------------------------------------- módulos e aulas");
for (const course of allCourses) {
  course.modules.forEach((module, moduleIndex) => {
    w(
      `INSERT INTO modules (id, course_id, title, position)\n` +
        `VALUES (${uid(module.id)}, ${uid(course.id)}, ${lit(module.title)}, ${moduleIndex + 1})\n` +
        `ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, position = EXCLUDED.position;`,
    );
    module.lessons.forEach((lesson, lessonIndex) => {
      w(
        `INSERT INTO lessons (id, module_id, title, duration_seconds, position)\n` +
          `VALUES (${uid(lesson.id)}, ${uid(module.id)}, ${lit(lesson.title)},\n` +
          `        ${lesson.durationSeconds}, ${lessonIndex + 1})\n` +
          `ON CONFLICT (id) DO UPDATE SET\n` +
          `  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,\n` +
          `  position = EXCLUDED.position;`,
      );
    });
  });
}
w();

/* ---------------------------------------------------------------- matrículas */
w("-- --------------------------------------------------------------- matrículas");
for (const enrollment of allEnrollments) {
  /* `enrolled_by` referencia `users`: "self" do mock significa que o próprio
     aluno se matriculou, então aponta para ele mesmo. */
  const enrolledBy =
    enrollment.enrolledBy && enrollment.enrolledBy !== "self"
      ? uid(enrollment.enrolledBy)
      : uid(enrollment.learnerId);

  w(
    `INSERT INTO enrollments (id, course_id, learner_id, enrolled_by, saved)\n` +
      `VALUES (${uid(`e-${enrollment.courseId}-${enrollment.learnerId}`)},\n` +
      `        ${uid(enrollment.courseId)}, ${uid(enrollment.learnerId)},\n` +
      `        ${enrolledBy}, ${enrollment.saved ? "true" : "false"})\n` +
      `ON CONFLICT (course_id, learner_id) DO UPDATE SET saved = EXCLUDED.saved;`,
  );

  /* `lesson_progress` pende da matrícula, não do aluno — a chave é
     (enrollment_id, lesson_id). */
  for (const [lessonId, state] of Object.entries(enrollment.progress ?? {})) {
    /* `completed_at` não existe no mock: é derivado da mesma regra do domínio
       (`isLessonCompleted`, 90% assistido). Calcular aqui em vez de inventar
       uma data mantém banco e telas concordando sobre quais aulas terminaram. */
    const lesson = lessonById.get(lessonId);
    const completed = lesson ? isLessonCompleted(state.watchedSeconds, lesson.durationSeconds) : false;

    w(
      /* `completion_source` acompanha `completed_at` obrigatoriamente — o CHECK
         de coerência da 006 recusa um sem o outro. Aqui é sempre 'auto': o
         seed deriva a conclusão do consumo, ninguém marcou nada à mão.

         `last_position_seconds` recebe o consumo porque o mock não guarda onde
         cada pessoa parou — mesma aproximação que a migration usou para o dado
         que já existia. */
      `INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,\n` +
        `                             last_position_seconds, completed_at, completion_source)\n` +
        `VALUES (${uid(`e-${enrollment.courseId}-${enrollment.learnerId}`)}, ${uid(lessonId)},\n` +
        `        ${state.watchedSeconds}, ${state.watchedSeconds},\n` +
        `        ${completed ? "now()" : "NULL"}, ${completed ? "'auto'" : "NULL"})\n` +
        `ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET\n` +
        `  watched_seconds = EXCLUDED.watched_seconds,\n` +
        `  last_position_seconds = EXCLUDED.last_position_seconds,\n` +
        `  completed_at = EXCLUDED.completed_at,\n` +
        `  completion_source = EXCLUDED.completion_source;`,
    );
  }
}
w();

/* -------------------------------------------------------------- comentários */
w("-- -------------------------------------------------------------- comentários");
w("-- `highlighted` é recalculado a partir da autoria do curso, não copiado do");
w("-- mock: é o servidor que decide quem aparece como professor (PRD §8), e o");
w("-- seed não pode ser a exceção que contradiz a regra.");
/* `allUsers` não cobre todo mundo que aparece no mock — `u5` (João Peixoto) é
   citado num comentário mas não está na lista de pessoas. Sem este filtro, o
   INSERT viola a chave estrangeira e derruba o seed inteiro. */
const seededUserIds = new Set(allUsers.map((user) => user.id));

/* Uma resposta pendura num comentário pai. Se o pai caiu por autor ausente, a
   resposta cai junto — senão o `parent_id` apontaria para nada. */
const seededCommentIds = new Set(
  comments
    .filter((comment) => seededUserIds.has(comment.authorId) && lessonById.has(comment.lessonId))
    .map((comment) => comment.id),
);

/* O que REALMENTE entrou. `seededCommentIds` é o conjunto candidato: um
   comentário pode passar por ele e ainda assim ser descartado aqui (pai que
   não entrou). Votar num id descartado viola a chave estrangeira e derruba o
   seed inteiro. */
const inseridos = new Set();

for (const comment of comments) {
  const lesson = lessonById.get(comment.lessonId);
  if (!lesson) continue;
  if (!seededUserIds.has(comment.authorId)) continue;
  if (comment.parentId && !seededCommentIds.has(comment.parentId)) continue;

  inseridos.add(comment.id);

  const course = allCourses.find((item) =>
    item.modules.some((module) => module.lessons.some((l) => l.id === comment.lessonId)),
  );
  const highlighted = course ? comment.authorId === course.authorId : false;

  w(
    `INSERT INTO comments (id, lesson_id, author_id, parent_id, body, highlighted, created_at)\n` +
      `VALUES (${uid(comment.id)}, ${uid(comment.lessonId)}, ${uid(comment.authorId)},\n` +
      `        ${comment.parentId ? uid(comment.parentId) : "NULL"}, ${lit(comment.body)},\n` +
      `        ${highlighted}, ${lit(comment.createdAt)})\n` +
      `ON CONFLICT (id) DO UPDATE SET\n` +
      `  body = EXCLUDED.body, highlighted = EXCLUDED.highlighted;`,
  );
}
w();

/* -------------------------------------------------------------- trilhas
   A trilha só faz sentido com a ordem dos cursos, então `track_courses` entra
   junto: `position` é o que decide o que abre primeiro no modo sequencial. */
for (const track of tracks) {
  w(
    `INSERT INTO tracks (id, tenant_id, org_unit_id, slug, title, summary, mode, project)
` +
      `VALUES (${uid(track.id)}, ${TENANT}, ${unidade(track.project ?? null)},
` +
      `        ${lit(track.slug)}, ${lit(track.title)},
` +
      `        ${lit(track.summary)}, ${lit(track.mode)}, ${track.project ? lit(track.project) : "NULL"})
` +
      `ON CONFLICT (id) DO UPDATE SET
` +
      `  title = EXCLUDED.title, summary = EXCLUDED.summary, mode = EXCLUDED.mode;`,
  );

  track.courseIds.forEach((courseId, index) => {
    /* Curso fora do seed derrubaria o INSERT pela chave estrangeira — foi o
       que os votos órfãos já causaram uma vez. */
    if (!allCourses.some((course) => course.id === courseId)) return;

    w(
      `INSERT INTO track_courses (track_id, course_id, position)
` +
        `VALUES (${uid(track.id)}, ${uid(courseId)}, ${index + 1})
` +
        `ON CONFLICT (track_id, course_id) DO UPDATE SET position = EXCLUDED.position;`,
    );
  });
}
w();

/* --------------------------------------------------------------- votos
   O mock traz `upvotes` como número; a tabela guarda QUEM votou. Os votos
   são distribuídos entre os alunos de forma determinística — sem sorteio,
   para o seed reaplicado produzir exatamente o mesmo banco. */
const votantes = allUsers.filter((user) => user.role === "learner");

for (const comment of comments) {
  if (!comment.upvotes || !inseridos.has(comment.id)) continue;

  for (let i = 0; i < Math.min(comment.upvotes, votantes.length); i += 1) {
    const votante = votantes[i];
    if (!votante || votante.id === comment.authorId) continue;

    w(
      `INSERT INTO comment_votes (comment_id, voter_id)
` +
        `VALUES (${uid(comment.id)}, ${uid(votante.id)})
` +
        `ON CONFLICT DO NOTHING;`,
    );
  }
}
w();

/* ------------------------------------------------------- agenda e avisos
   As datas entram como deslocamento a partir de `current_date`, e não como
   data fixa. Um seed com data absoluta envelhece: rodado hoje, a agenda abre
   correta; consultada em dois meses, mostra "próximos eventos" que já
   passaram. Com `current_date + interval`, o calendário acompanha o relógio
   do banco em qualquer reaplicação. */
const hoje = new Date();
hoje.setHours(0, 0, 0, 0);

/** Distância em dias entre uma data civil do mock e hoje. */
const offsetOf = (iso) => {
  const [ano, mes, dia] = iso.split("-").map(Number);
  const alvo = new Date(ano, mes - 1, dia);
  return Math.round((alvo - hoje) / 86400000);
};

/** `current_date` deslocado, pronto para interpolar no SQL. */
const dateExpr = (iso) => {
  const dias = offsetOf(iso);
  if (dias === 0) return "current_date";
  return `current_date + interval '${dias} days'`;
};

for (const event of events) {
  w(
    `INSERT INTO events (id, tenant_id, org_unit_id, on_date, time_label, title, kind, location, project)
` +
      `VALUES (${uid(event.id)}, ${TENANT}, NULL,
` +
      `        ${dateExpr(event.date)}, ${event.time ? lit(event.time) : "NULL"},
` +
      `        ${lit(event.title)}, ${lit(event.kind)}, ${event.location ? lit(event.location) : "NULL"}, NULL)
` +
      `ON CONFLICT (id) DO UPDATE SET
` +
      `  on_date = EXCLUDED.on_date, title = EXCLUDED.title, kind = EXCLUDED.kind,
` +
      `  time_label = EXCLUDED.time_label, location = EXCLUDED.location;`,
  );
}
w();

/* Um aviso pertence a uma pessoa. O mock não diz a quem, porque a tela sempre
   mostrou os mesmos quatro para quem estivesse logado; aqui cada aluno recebe
   a sua cópia, que é como a tabela foi desenhada. O id vira determinístico
   pela combinação aviso+pessoa, para o seed continuar reaplicável. */
const learners = allUsers.filter((user) => user.role === "learner");

for (const note of notifications) {
  for (const learner of learners) {
    w(
      `INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at)
` +
        `VALUES (${uid(`${note.id}:${learner.id}`)}, ${uid(learner.id)}, ${lit(note.title)},
` +
        `        ${lit(note.body)}, ${lit(note.kind)}, ${dateExpr(note.date)},
` +
        `        ${note.read ? dateExpr(note.date) : "NULL"})
` +
        `ON CONFLICT (id) DO UPDATE SET
` +
        `  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at;`,
    );
  }
}
w();

/* ------------------------------------------------------------- materiais */
w("-- -------------------------------------------------------------- materiais");
w("-- O mock traz o tamanho já formatado (\"480 kB\"); a tabela guarda bytes e a");
w("-- formatação é do repositório. Converter aqui evita duas verdades sobre o");
w("-- mesmo arquivo.");
w("--");
w("-- `storage_key` aponta para um objeto que NÃO existe no storage: o seed não");
w("-- sobe arquivo. Baixar um destes devolve erro do storage, e é o esperado —");
w("-- o que o seed prova é que a listagem vem do banco, não do mock.");

for (const [lessonId, list] of Object.entries(materials)) {
  if (!lessonById.has(lessonId)) continue;

  for (const [index, material] of list.entries()) {
    const bytes = bytesFromLabel(material.sizeLabel);

    w(
      `INSERT INTO materials (id, lesson_id, name, kind, size_bytes, storage_key, uploaded_by)
` +
        `VALUES (${uid(`mat-${material.id}`)}, ${uid(lessonId)}, ${lit(material.name)},
` +
        `        ${lit(material.kind)}, ${bytes},
` +
        `        ${lit(`materiais/${lessonId}/${index + 1}-${material.kind}`)}, ${uid("u2")})
` +
        `ON CONFLICT (id) DO UPDATE SET
` +
        `  name = EXCLUDED.name, kind = EXCLUDED.kind, size_bytes = EXCLUDED.size_bytes;`,
    );
  }
}
w();

w("COMMIT;");
w();

writeFileSync(out, lines.join("\n"), "utf8");
console.log(`hml.sql gerado: ${lines.length} linhas`);
console.log(`  ${allUsers.length} usuários, ${allCourses.length} cursos, ${allEnrollments.length} matrículas, ${comments.length} comentários`);
console.log(`  ${events.length} eventos, ${notifications.length * learners.length} avisos (datas relativas a current_date)`);
console.log(`  ${tracks.length} trilhas`);

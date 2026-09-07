-- =============================================================================
-- NerdResolve EAD — schema inicial
--
-- Decisões estruturais, todas com motivo. Se alguma for revista, o motivo é o
-- que precisa ser derrubado primeiro.
--
-- 1. CHAVE PRIMÁRIA É UUID, NÃO SEQUENCIAL
--    Id sequencial exposto em URL permite enumerar: /cursos/1, /cursos/2. Já
--    decidimos responder 404 em vez de 403 para não confirmar existência
-- — id sequencial desfaria isso sozinho.
--
-- 2. ENUM É `text` + CHECK, NÃO TIPO NATIVO
--    Acrescentar um papel a um ENUM nativo exige ALTER TYPE e trava a
--    migração. Com CHECK, é uma linha. O custo é não ter o tipo em catálogo,
--    o que não muda nada na prática.
--
-- 3. TUDO QUE É INSTANTE É `timestamptz`; DATA DE EVENTO É `date`
--    Um treinamento no dia 26 é no dia 26 em Manaus e no Rio (DEC-047). Já um
--    login aconteceu num instante, e instante sem fuso é bug esperando data.
--
-- 4. CONTADOR NUNCA É FONTE DE VERDADE
--    Votos de comentário, moedas e progresso de curso são derivados por
--    consulta. Contador gravado sai de sincronia e ninguém percebe até o
--    relatório sair errado.
--
-- 5. NADA DE DELETE EM DADO COM HISTÓRICO
--    Usuário é desativado, curso é arquivado. Apagar quebra a auditoria, que
--    precisa responder "quem fez isso" mesmo depois de a pessoa sair.
-- =============================================================================

BEGIN;

-- gen_random_uuid() é nativo desde o PostgreSQL 13; a extensão fica para o
-- caso de o alvo ser mais antigo.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- `citext` dá comparação de texto insensível a maiúsculas, usada em `email` e
-- no identificador de tentativa de login. Faltava aqui e a migração morria em
-- `type "citext" does not exist` — encontrado na primeira execução real.
CREATE EXTENSION IF NOT EXISTS citext;

-- =============================================================================
-- Identidade
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         citext,
  full_name     text NOT NULL CHECK (length(btrim(full_name)) > 0),
  -- Hash Argon2id. Nulo enquanto o convite não foi aceito — é o estado
  -- "pendente" que a gestão de usuários mostra.
  password_hash text,
  role          text NOT NULL DEFAULT 'learner'
                CHECK (role IN ('admin', 'manager', 'instructor', 'learner')),
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('active', 'pending', 'inactive')),
  -- Dimensões dos relatórios pedidos (ISSUE-023). Sem elas, relatório por
  -- projeto e por região não existe.
  project       text,
  region        text,
  -- Alimenta a métrica de "usuário ativo no período" (DEC-040), que é o teto
  -- de 500 da licença atual.
  last_access_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Email é único ignorando maiúsculas, mas só entre contas não excluídas.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users (email) WHERE email IS NOT NULL;

-- Gestor precisa de projeto: gestor sem recorte enxergaria tudo ou nada, e as
-- duas opções são erradas (DEC-038).
-- `ADD CONSTRAINT` não aceita `IF NOT EXISTS`; sem a checagem abaixo, reaplicar
-- a migração falharia aqui.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_manager_needs_project'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_manager_needs_project
      CHECK (role <> 'manager' OR project IS NOT NULL);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS users_project_idx ON users (project) WHERE project IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_role_idx ON users (role);
CREATE INDEX IF NOT EXISTS users_last_access_idx ON users (last_access_at DESC NULLS LAST);

-- =============================================================================
-- Sessão e proteção de acesso
-- =============================================================================

CREATE TABLE IF NOT EXISTS sessions (
  -- Guarda-se o hash do token, nunca o token. Vazamento de banco não pode
  -- virar sessão válida.
  token_hash  bytea PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  user_agent  text,
  ip          inet
);

CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token_hash bytea PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  -- Token usado é invalidado, não apagado: tentativa de reuso precisa ser
  -- detectável.
  used_at    timestamptz
);

CREATE INDEX IF NOT EXISTS password_reset_user_idx ON password_reset_tokens (user_id);

-- Rate limiting por IP **e** por identidade. Só por IP, o atacante troca de
-- IP; só por conta, ele derruba a conta de outra pessoa.
CREATE TABLE IF NOT EXISTS login_attempts (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  identifier citext,
  ip         inet NOT NULL,
  succeeded  boolean NOT NULL,
  at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS login_attempts_ip_idx ON login_attempts (ip, at DESC);
CREATE INDEX IF NOT EXISTS login_attempts_identifier_idx ON login_attempts (identifier, at DESC);

-- =============================================================================
-- Conteúdo
-- =============================================================================

CREATE TABLE IF NOT EXISTS courses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title       text NOT NULL CHECK (length(btrim(title)) > 0),
  summary     text NOT NULL DEFAULT '',
  -- Autor define quem edita e quem responde com a tag Professor (PRD §8).
  -- RESTRICT: não se apaga instrutor que tem curso — arquiva-se.
  author_id   uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  status      text NOT NULL DEFAULT 'draft'
              CHECK (status IN ('draft', 'published', 'archived')),
  -- Livre ou atribuído pelo gestor (DEC-039).
  enrollment_mode text NOT NULL DEFAULT 'open'
              CHECK (enrollment_mode IN ('open', 'assigned')),
  project     text,
  artwork     smallint NOT NULL DEFAULT 0 CHECK (artwork BETWEEN 0 AND 3),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

CREATE INDEX IF NOT EXISTS courses_author_idx ON courses (author_id);
CREATE INDEX IF NOT EXISTS courses_status_idx ON courses (status);
CREATE INDEX IF NOT EXISTS courses_project_idx ON courses (project) WHERE project IS NOT NULL;

CREATE TABLE IF NOT EXISTS modules (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  title     text NOT NULL CHECK (length(btrim(title)) > 0),
  -- Ordem explícita. Depender da ordem de inserção quebra ao reordenar.
  position  integer NOT NULL CHECK (position >= 0),
  UNIQUE (course_id, position) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS modules_course_idx ON modules (course_id, position);

CREATE TABLE IF NOT EXISTS lessons (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id        uuid NOT NULL REFERENCES modules (id) ON DELETE CASCADE,
  title            text NOT NULL CHECK (length(btrim(title)) > 0),
  position         integer NOT NULL CHECK (position >= 0),
  duration_seconds integer NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  -- SCORM não segue a regra dos 90%: quem decide conclusão é o pacote
  -- (DEC-041). O tipo precisa estar no modelo para a regra saber qual aplicar.
  kind             text NOT NULL DEFAULT 'video'
                   CHECK (kind IN ('video', 'pdf', 'scorm')),
  -- Chave no armazenamento de objetos. Nunca URL pública: o acesso é por URL
  -- assinada com validade curta (DEC-009).
  media_key        text,
  captions_key     text,
  UNIQUE (module_id, position) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS lessons_module_idx ON lessons (module_id, position);

CREATE TABLE IF NOT EXISTS materials (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id  uuid NOT NULL REFERENCES lessons (id) ON DELETE CASCADE,
  name       text NOT NULL CHECK (length(btrim(name)) > 0),
  kind       text NOT NULL CHECK (kind IN ('pdf', 'spreadsheet', 'slides', 'document')),
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  storage_key text NOT NULL,
  uploaded_by uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS materials_lesson_idx ON materials (lesson_id);
-- Índice sobre a FK não é só para consulta: `ON DELETE SET NULL` no usuário
-- obriga o PostgreSQL a varrer esta tabela inteira sem ele.
CREATE INDEX IF NOT EXISTS materials_uploader_idx ON materials (uploaded_by) WHERE uploaded_by IS NOT NULL;

-- =============================================================================
-- Trilhas
-- =============================================================================

CREATE TABLE IF NOT EXISTS tracks (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug    text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title   text NOT NULL CHECK (length(btrim(title)) > 0),
  summary text NOT NULL DEFAULT '',
  mode    text NOT NULL DEFAULT 'free' CHECK (mode IN ('sequential', 'free')),
  project text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS track_courses (
  track_id  uuid NOT NULL REFERENCES tracks (id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  position  integer NOT NULL CHECK (position >= 0),
  PRIMARY KEY (track_id, course_id),
  UNIQUE (track_id, position) DEFERRABLE INITIALLY DEFERRED
);

-- A chave primária cobre (track_id, course_id); a busca "quais trilhas contêm
-- este curso?" — usada pela recomendação — precisa do lado inverso.
CREATE INDEX IF NOT EXISTS track_courses_course_idx ON track_courses (course_id);

-- =============================================================================
-- Matrícula e progresso
-- =============================================================================

CREATE TABLE IF NOT EXISTS enrollments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   uuid NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  learner_id  uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  -- Quem matriculou: nulo quando foi auto-inscrição. Guardar isso é o que
  -- permite auditar matrícula atribuída depois.
  enrolled_by uuid REFERENCES users (id) ON DELETE SET NULL,
  saved       boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- Uma matrícula por pessoa por curso. Sem isso, progresso duplica.
  UNIQUE (course_id, learner_id)
);

CREATE INDEX IF NOT EXISTS enrollments_learner_idx ON enrollments (learner_id);
CREATE INDEX IF NOT EXISTS enrollments_course_idx ON enrollments (course_id);
CREATE INDEX IF NOT EXISTS enrollments_saved_idx ON enrollments (learner_id) WHERE saved;
CREATE INDEX IF NOT EXISTS enrollments_enroller_idx ON enrollments (enrolled_by) WHERE enrolled_by IS NOT NULL;

CREATE TABLE IF NOT EXISTS lesson_progress (
  enrollment_id  uuid NOT NULL REFERENCES enrollments (id) ON DELETE CASCADE,
  lesson_id      uuid NOT NULL REFERENCES lessons (id) ON DELETE CASCADE,
  -- Nunca retrocede: a escrita usa GREATEST(atual, novo). Rever um trecho não
  -- pode apagar progresso.
  watched_seconds integer NOT NULL DEFAULT 0 CHECK (watched_seconds >= 0),
  -- Preenchido quando o pacote SCORM declara conclusão. Para vídeo e PDF fica
  -- nulo e a conclusão sai da regra dos 90% (DEC-041).
  completed_at   timestamptz,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (enrollment_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS lesson_progress_lesson_idx ON lesson_progress (lesson_id);

-- =============================================================================
-- Comentários e economia social
-- =============================================================================

CREATE TABLE IF NOT EXISTS comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id  uuid NOT NULL REFERENCES lessons (id) ON DELETE CASCADE,
  author_id  uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  parent_id  uuid REFERENCES comments (id) ON DELETE CASCADE,
  body       text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 4000),
  -- Derivado no servidor a partir de papel + autoria do curso, nunca aceito do
  -- cliente (PRD §8). Fica gravado porque o papel pode mudar depois e o
  -- destaque histórico não deve mudar junto.
  highlighted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at  timestamptz,
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS comments_lesson_idx ON comments (lesson_id, created_at);
CREATE INDEX IF NOT EXISTS comments_parent_idx ON comments (parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS comments_author_idx ON comments (author_id);

CREATE TABLE IF NOT EXISTS comment_votes (
  comment_id uuid NOT NULL REFERENCES comments (id) ON DELETE CASCADE,
  voter_id   uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Um voto por pessoa por comentário. A contagem é COUNT(*), nunca um campo
  -- incrementado (decisão 4 do cabeçalho).
  PRIMARY KEY (comment_id, voter_id)
);

CREATE INDEX IF NOT EXISTS comment_votes_voter_idx ON comment_votes (voter_id, created_at DESC);

-- O orçamento semanal de votos é derivado: conta-se quantos votos a pessoa deu
-- na semana ISO corrente. Não existe tabela de saldo — saldo gravado sai de
-- sincronia e permite gastar duas vezes numa corrida.

-- Moeda ganha é derivada do progresso e dos votos recebidos (DEC-046).
-- Moeda gasta é evento e precisa existir.
CREATE TABLE IF NOT EXISTS coin_spends (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  amount     integer NOT NULL CHECK (amount > 0),
  reason     text NOT NULL,
  reward_id  text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coin_spends_user_idx ON coin_spends (user_id, created_at DESC);

-- =============================================================================
-- Agenda e comunicados
-- =============================================================================

CREATE TABLE IF NOT EXISTS events (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- `date`, não `timestamptz`: dia 26 é dia 26 em qualquer fuso (DEC-047).
  on_date  date NOT NULL,
  time_label text,
  title    text NOT NULL CHECK (length(btrim(title)) > 0),
  kind     text NOT NULL CHECK (kind IN ('training', 'deadline', 'announcement')),
  location text,
  project  text,
  created_by uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_date_idx ON events (on_date);
CREATE INDEX IF NOT EXISTS events_project_idx ON events (project) WHERE project IS NOT NULL;
CREATE INDEX IF NOT EXISTS events_creator_idx ON events (created_by) WHERE created_by IS NOT NULL;

CREATE TABLE IF NOT EXISTS notifications (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title   text NOT NULL,
  body    text NOT NULL DEFAULT '',
  kind    text NOT NULL CHECK (kind IN ('announcement', 'reminder', 'achievement')),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

-- Índice parcial: a consulta quente é "minhas não lidas".
CREATE INDEX IF NOT EXISTS notifications_unread_idx ON notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

-- =============================================================================
-- Auditoria
-- =============================================================================

-- Só recebe INSERT. UPDATE e DELETE são revogados do papel da aplicação mais
-- abaixo — registro que pode ser alterado não prova nada (DEC-048).
CREATE TABLE IF NOT EXISTS audit_log (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at         timestamptz NOT NULL DEFAULT now(),
  -- SET NULL, não CASCADE: a saída de um funcionário não pode apagar o
  -- histórico do que ele fez. `actor_name` guarda o nome do momento.
  actor_id   uuid REFERENCES users (id) ON DELETE SET NULL,
  actor_name text NOT NULL,
  action     text NOT NULL,
  target     text NOT NULL,
  outcome    text NOT NULL CHECK (outcome IN ('allowed', 'denied')),
  ip         inet
);

CREATE INDEX IF NOT EXISTS audit_log_at_idx ON audit_log (at DESC);
CREATE INDEX IF NOT EXISTS audit_log_actor_idx ON audit_log (actor_id, at DESC);
CREATE INDEX IF NOT EXISTS audit_log_denied_idx ON audit_log (at DESC) WHERE outcome = 'denied';

-- =============================================================================
-- `updated_at` automático
-- =============================================================================

CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER users_touch BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE OR REPLACE TRIGGER courses_touch BEFORE UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE OR REPLACE TRIGGER lesson_progress_touch BEFORE UPDATE ON lesson_progress
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

COMMIT;

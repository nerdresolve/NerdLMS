-- 012 — Trabalhos, rubricas e livro de notas.
--
-- O guia §8 pede assignment com upload, texto online, prazo, late submission,
-- nota, feedback textual e por arquivo, rubricas, reavaliação e histórico. O §9
-- pede gradebook com notas por atividade, peso, categorias, nota final e
-- histórico de alterações.
--
-- A decisão que atravessa tudo: NOTA É LANÇAMENTO, NÃO CAMPO.
--
-- Uma coluna `grade` na entrega guardaria só a nota atual, e o guia pede
-- histórico de alterações. Pior: reavaliar apagaria a nota anterior, e é
-- justamente na reavaliação que alguém precisa saber o que mudou e por quê.
-- Por isso `grade_entries` é append-only, e a nota vigente é a última linha.

BEGIN;

-- ---------------------------------------------------------- trabalhos
CREATE TABLE IF NOT EXISTS assignments (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES lessons (id) ON DELETE CASCADE,

  title        text NOT NULL CHECK (length(btrim(title)) > 0),
  instructions text,

  -- O que se entrega. Os dois podem ser exigidos juntos.
  allow_file boolean NOT NULL DEFAULT true,
  allow_text boolean NOT NULL DEFAULT true,

  max_files  integer NOT NULL DEFAULT 3 CHECK (max_files > 0),
  -- Em MB. O storage tem seu próprio teto; este é o do professor.
  max_file_mb integer NOT NULL DEFAULT 20 CHECK (max_file_mb > 0),

  points_possible numeric(6,2) NOT NULL DEFAULT 100 CHECK (points_possible > 0),

  due_at timestamptz,

  -- Late submission: aceita depois do prazo?
  --   block   → recusa
  --   accept  → aceita e MARCA como atrasada
  --   penalty → aceita, marca e desconta
  late_policy text NOT NULL DEFAULT 'accept'
              CHECK (late_policy IN ('block', 'accept', 'penalty')),

  -- Percentual descontado quando `penalty`.
  late_penalty_percent numeric(5,2) NOT NULL DEFAULT 0
                       CHECK (late_penalty_percent >= 0 AND late_penalty_percent <= 100),

  -- Quantas vezes pode reenviar. Nulo é ilimitado até o prazo.
  max_attempts integer CHECK (max_attempts IS NULL OR max_attempts > 0),

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS assignments_tenant_idx ON assignments (tenant_id);
CREATE INDEX IF NOT EXISTS assignments_course_idx ON assignments (course_id);
CREATE INDEX IF NOT EXISTS assignments_lesson_idx ON assignments (lesson_id);

-- ------------------------------------------------------------ entregas
CREATE TABLE IF NOT EXISTS submissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES assignments (id) ON DELETE CASCADE,
  enrollment_id uuid NOT NULL REFERENCES enrollments (id) ON DELETE CASCADE,

  attempt_number integer NOT NULL DEFAULT 1 CHECK (attempt_number > 0),

  text_content text,

  submitted_at timestamptz NOT NULL DEFAULT now(),

  -- Atrasada? Gravado no envio, não derivado na leitura: se o professor
  -- estender o prazo depois, quem entregou atrasado entregou atrasado — e é
  -- essa a informação que o histórico precisa preservar.
  is_late boolean NOT NULL DEFAULT false,

  UNIQUE (assignment_id, enrollment_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS submissions_assignment_idx ON submissions (assignment_id);
CREATE INDEX IF NOT EXISTS submissions_enrollment_idx ON submissions (enrollment_id);

-- Arquivos da entrega. Mesma modelagem dos materiais: o arquivo vive no
-- storage, a linha guarda a chave.
CREATE TABLE IF NOT EXISTS submission_files (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES submissions (id) ON DELETE CASCADE,
  name          text NOT NULL,
  size_bytes    bigint NOT NULL,
  storage_key   text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS submission_files_submission_idx ON submission_files (submission_id);

-- ------------------------------------------------------------ rubricas
--
-- Uma rubrica é um conjunto de critérios, cada um com níveis de desempenho. O
-- guia §8 pede "rubricas" e "critérios" como itens separados, e é isso: a
-- rubrica agrupa, o critério pontua.
CREATE TABLE IF NOT EXISTS rubrics (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  name      text NOT NULL CHECK (length(btrim(name)) > 0),

  -- A rubrica pode pertencer a um trabalho ou ficar reutilizável no tenant.
  assignment_id uuid REFERENCES assignments (id) ON DELETE CASCADE,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rubrics_tenant_idx ON rubrics (tenant_id);
CREATE INDEX IF NOT EXISTS rubrics_assignment_idx ON rubrics (assignment_id);

CREATE TABLE IF NOT EXISTS rubric_criteria (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rubric_id uuid NOT NULL REFERENCES rubrics (id) ON DELETE CASCADE,
  name      text NOT NULL CHECK (length(btrim(name)) > 0),
  description text,
  max_points numeric(6,2) NOT NULL CHECK (max_points > 0),
  position   integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS rubric_criteria_rubric_idx ON rubric_criteria (rubric_id);

-- Quanto o corretor deu em cada critério desta entrega.
CREATE TABLE IF NOT EXISTS rubric_scores (
  submission_id uuid NOT NULL REFERENCES submissions (id) ON DELETE CASCADE,
  criterion_id  uuid NOT NULL REFERENCES rubric_criteria (id) ON DELETE CASCADE,
  points        numeric(6,2) NOT NULL CHECK (points >= 0),
  comment       text,
  PRIMARY KEY (submission_id, criterion_id)
);

CREATE INDEX IF NOT EXISTS rubric_scores_criterion_idx ON rubric_scores (criterion_id);

-- --------------------------------------------------- livro de notas
--
-- APPEND-ONLY. A nota vigente é a última linha; as anteriores são o histórico
-- de alterações que o guia §9 exige.
--
-- Reavaliar não apaga: acrescenta. É a diferença entre "a nota é 7" e "a nota
-- era 5, foi revista para 7 em 20/03 pelo instrutor X, porque o aluno recorreu".
CREATE TABLE IF NOT EXISTS grade_entries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  enrollment_id uuid NOT NULL REFERENCES enrollments (id) ON DELETE CASCADE,

  -- A atividade avaliada. Exatamente uma — o CHECK garante.
  quiz_id       uuid REFERENCES quizzes (id) ON DELETE CASCADE,
  assignment_id uuid REFERENCES assignments (id) ON DELETE CASCADE,

  points_earned   numeric(8,2) NOT NULL CHECK (points_earned >= 0),
  points_possible numeric(8,2) NOT NULL CHECK (points_possible > 0),

  -- Peso desta atividade na nota final do curso.
  weight numeric(6,2) NOT NULL DEFAULT 1 CHECK (weight >= 0),

  feedback text,

  -- Quem lançou. Nulo na correção automática — ninguém lançou, o sistema
  -- corrigiu.
  graded_by uuid REFERENCES users (id) ON DELETE SET NULL,

  -- Por que mudou, quando é reavaliação.
  reason text,

  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE grade_entries DROP CONSTRAINT IF EXISTS grade_entries_one_activity;
ALTER TABLE grade_entries ADD CONSTRAINT grade_entries_one_activity CHECK (
  (quiz_id IS NOT NULL)::int + (assignment_id IS NOT NULL)::int = 1
);

CREATE INDEX IF NOT EXISTS grade_entries_tenant_idx ON grade_entries (tenant_id);
CREATE INDEX IF NOT EXISTS grade_entries_enrollment_idx ON grade_entries (enrollment_id);
CREATE INDEX IF NOT EXISTS grade_entries_quiz_idx ON grade_entries (quiz_id);
CREATE INDEX IF NOT EXISTS grade_entries_assignment_idx ON grade_entries (assignment_id);
CREATE INDEX IF NOT EXISTS grade_entries_graded_by_idx ON grade_entries (graded_by);

-- Append-only de verdade, como o `audit_log` da 002: um registro que se edita
-- não é histórico.
CREATE OR REPLACE FUNCTION grade_entries_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'grade_entries é somente-inserção: para mudar a nota, lance outra entrada';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS grade_entries_no_update ON grade_entries;
CREATE TRIGGER grade_entries_no_update
  BEFORE UPDATE OR DELETE ON grade_entries
  FOR EACH ROW EXECUTE FUNCTION grade_entries_immutable();

-- -------------------------------------- nota mínima no certificado
--
-- F3-09: o certificado passa a poder exigir nota, não só conclusão das aulas.
-- Nulo mantém o comportamento atual — concluir as aulas basta.
ALTER TABLE courses ADD COLUMN IF NOT EXISTS min_grade_percent numeric(5,2)
  CHECK (min_grade_percent IS NULL OR (min_grade_percent >= 0 AND min_grade_percent <= 100));

COMMIT;

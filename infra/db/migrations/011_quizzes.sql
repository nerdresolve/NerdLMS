-- 011 — Provas, tentativas e respostas.
--
-- O guia §7 lista o que uma prova precisa: limite de tempo, número de
-- tentativas, nota mínima, randomização, questões por página, navegação
-- sequencial, feedback imediato e posterior, janela de realização com grace
-- period, e critério de aprovação.
--
-- A decisão central: TENTATIVA É IMUTÁVEL DEPOIS DE ENVIADA.
--
-- Uma nota que pode ser recalculada silenciosamente não é nota — é opinião do
-- sistema no momento da leitura. Se o instrutor corrigir o gabarito de uma
-- questão amanhã, quem já entregou hoje continua com a nota que tirou, e a
-- reavaliação é um ato explícito e registrado. É a mesma razão de `completed_at`
-- ter virado fato na 006.

BEGIN;

CREATE TABLE IF NOT EXISTS quizzes (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses (id) ON DELETE CASCADE,

  -- A prova pode pendurar numa aula (a "atividade" da trilha) ou existir solta
  -- no curso (a prova final). Nulo é o segundo caso.
  lesson_id uuid REFERENCES lessons (id) ON DELETE CASCADE,

  title       text NOT NULL CHECK (length(btrim(title)) > 0),
  description text,

  -- Minutos. Nulo é sem limite — a prova sem cronômetro é comum e legítima.
  time_limit_minutes integer CHECK (time_limit_minutes IS NULL OR time_limit_minutes > 0),

  -- Quantas vezes se pode tentar. Nulo é ilimitado.
  max_attempts integer CHECK (max_attempts IS NULL OR max_attempts > 0),

  -- Percentual de acerto que aprova. 0 a 100.
  passing_score numeric(5,2) NOT NULL DEFAULT 70
                CHECK (passing_score >= 0 AND passing_score <= 100),

  -- Como a nota final sai de várias tentativas. "Melhor" é o padrão porque é o
  -- que o aluno espera; "última" serve a quem usa a prova como diagnóstico.
  grading_method text NOT NULL DEFAULT 'best'
                 CHECK (grading_method IN ('best', 'last', 'average', 'first')),

  -- Randomização: a ordem das questões e das alternativas muda por tentativa.
  shuffle_questions boolean NOT NULL DEFAULT false,
  shuffle_options   boolean NOT NULL DEFAULT false,

  -- Quantas questões por página. Nulo mostra todas numa página só.
  questions_per_page integer CHECK (questions_per_page IS NULL OR questions_per_page > 0),

  -- Navegação sequencial impede voltar a uma questão já respondida.
  sequential_navigation boolean NOT NULL DEFAULT false,

  -- Quando o aluno vê o resultado.
  --   immediate  → a cada questão, durante a prova
  --   on_submit  → ao enviar
  --   after_close → só depois da data de fechamento
  --   never      → nunca (a nota aparece, as respostas não)
  feedback_mode text NOT NULL DEFAULT 'on_submit'
                CHECK (feedback_mode IN ('immediate', 'on_submit', 'after_close', 'never')),

  -- Janela de realização.
  opens_at  timestamptz,
  closes_at timestamptz,

  -- Minutos de tolerância depois do fechamento. O guia pede "grace period":
  -- quem começou a tempo termina, em vez de perder a prova por um minuto.
  grace_minutes integer NOT NULL DEFAULT 0 CHECK (grace_minutes >= 0),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE quizzes DROP CONSTRAINT IF EXISTS quizzes_window_check;
ALTER TABLE quizzes ADD CONSTRAINT quizzes_window_check
  CHECK (opens_at IS NULL OR closes_at IS NULL OR closes_at > opens_at);

CREATE INDEX IF NOT EXISTS quizzes_tenant_idx ON quizzes (tenant_id);
CREATE INDEX IF NOT EXISTS quizzes_course_idx ON quizzes (course_id);
CREATE INDEX IF NOT EXISTS quizzes_lesson_idx ON quizzes (lesson_id);

-- --------------------------------------------- as questões desta prova
--
-- A ligação, não a questão. É o que torna o banco reutilizável: a mesma questão
-- aparece em quantas provas for preciso, e corrigir o enunciado corrige em
-- todas.
CREATE TABLE IF NOT EXISTS quiz_questions (
  quiz_id     uuid NOT NULL REFERENCES quizzes (id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions (id) ON DELETE CASCADE,
  position    integer NOT NULL DEFAULT 0,

  -- Sobrescreve o peso da questão NESTA prova. Nulo usa o peso próprio dela —
  -- a mesma questão pode valer 1 ponto num quiz rápido e 5 na prova final.
  points numeric(6,2) CHECK (points IS NULL OR points > 0),

  PRIMARY KEY (quiz_id, question_id)
);

CREATE INDEX IF NOT EXISTS quiz_questions_question_idx ON quiz_questions (question_id);

-- ---------------------------------------------------------- tentativas
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES quizzes (id) ON DELETE CASCADE,

  -- A matrícula, não o usuário: a tentativa pertence ao vínculo com o curso, e
  -- é por ela que o gradebook encontra as notas de quem cursa.
  enrollment_id uuid NOT NULL REFERENCES enrollments (id) ON DELETE CASCADE,

  -- 1, 2, 3… O número importa para "melhor de 3" e para o histórico.
  attempt_number integer NOT NULL CHECK (attempt_number > 0),

  started_at   timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,

  -- A nota, em pontos e em percentual. Os dois porque respondem perguntas
  -- diferentes: "quantos pontos fez" e "passou dos 70%".
  score_points  numeric(8,2),
  score_percent numeric(5,2) CHECK (score_percent IS NULL OR (score_percent >= 0 AND score_percent <= 100)),

  -- Passou? Derivado de `score_percent >= quiz.passing_score` no momento do
  -- envio, e GRAVADO: se a nota de corte mudar amanhã, quem passou continua
  -- tendo passado.
  passed boolean,

  -- Aguardando correção manual (dissertativas).
  needs_review boolean NOT NULL DEFAULT false,

  UNIQUE (quiz_id, enrollment_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS quiz_attempts_enrollment_idx ON quiz_attempts (enrollment_id);
CREATE INDEX IF NOT EXISTS quiz_attempts_quiz_idx ON quiz_attempts (quiz_id);

-- A nota só existe quando a tentativa foi enviada. Uma tentativa em andamento
-- com nota seria dado corrompido — e a tela mostraria nota de prova não feita.
ALTER TABLE quiz_attempts DROP CONSTRAINT IF EXISTS quiz_attempts_score_coherent;
ALTER TABLE quiz_attempts ADD CONSTRAINT quiz_attempts_score_coherent CHECK (
  (submitted_at IS NULL AND score_percent IS NULL AND passed IS NULL)
  OR submitted_at IS NOT NULL
);

-- ------------------------------------------------------------ respostas
CREATE TABLE IF NOT EXISTS quiz_answers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id  uuid NOT NULL REFERENCES quiz_attempts (id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions (id) ON DELETE CASCADE,

  -- A resposta, em JSON, porque a forma muda com o tipo:
  --   escolha    → ["id-da-opcao", ...]
  --   texto      → "resposta digitada"
  --   numérica   → 42.5
  --   associação → {"id-item": "id-par", ...}
  --   ordenação  → ["id1", "id2", "id3"]
  --
  -- Cinco colunas tipadas seriam quatro nulas em toda linha, e a leitura
  -- precisaria saber de qual ler antes de ler.
  response jsonb,

  -- Pontos obtidos. Nulo enquanto a dissertativa não foi corrigida.
  points_awarded numeric(6,2),

  -- Correção automática já rodou e decidiu.
  auto_graded boolean NOT NULL DEFAULT false,

  -- Feedback do corretor, na correção manual.
  feedback text,

  UNIQUE (attempt_id, question_id)
);

CREATE INDEX IF NOT EXISTS quiz_answers_question_idx ON quiz_answers (question_id);

-- A consulta quente é "as respostas desta tentativa", e o UNIQUE acima começa
-- por `attempt_id` — mas a verificação de FK exige um índice sobre a coluna, e
-- ela está certa: apagar uma tentativa percorre esta tabela inteira.
CREATE INDEX IF NOT EXISTS quiz_answers_attempt_idx ON quiz_answers (attempt_id);

COMMIT;

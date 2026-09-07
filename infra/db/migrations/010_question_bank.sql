-- 010 — Banco de questões.
--
-- O guia §7 é explícito: "precisa existir um banco REUTILIZÁVEL de questões",
-- com banco por curso e banco global, categorias, tags e randomização.
--
-- A palavra que manda é "reutilizável": a questão NÃO pertence à prova. Se
-- pertencesse, reaproveitá-la em outra prova exigiria copiá-la, e a correção de
-- um enunciado errado teria de ser repetida em cada cópia — que é exatamente o
-- problema que um banco existe para resolver.
--
-- Daí a modelagem: `questions` é independente, e `quiz_questions` liga prova e
-- questão. A mesma questão aparece em quantas provas for preciso.

BEGIN;

-- ------------------------------------------------- categorias de questão
--
-- Árvore, como as categorias de curso: o guia pede "categorizar", e um nível só
-- não organiza um banco de centenas de questões.
CREATE TABLE IF NOT EXISTS question_categories (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  parent_id uuid REFERENCES question_categories (id) ON DELETE CASCADE,
  name      text NOT NULL CHECK (length(btrim(name)) > 0),

  -- Banco POR CURSO quando preenchido; banco GLOBAL quando nulo. O guia pede
  -- os dois, e a diferença é só o alcance: uma categoria de curso não polui o
  -- banco global, e uma global serve a todos os cursos do cliente.
  course_id uuid REFERENCES courses (id) ON DELETE CASCADE,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS question_categories_tenant_idx ON question_categories (tenant_id);
CREATE INDEX IF NOT EXISTS question_categories_parent_idx ON question_categories (parent_id);
CREATE INDEX IF NOT EXISTS question_categories_course_idx ON question_categories (course_id);

-- ------------------------------------------------------------- questões
CREATE TABLE IF NOT EXISTS questions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  category_id uuid REFERENCES question_categories (id) ON DELETE SET NULL,

  -- Banco por curso ou global, como nas categorias.
  course_id   uuid REFERENCES courses (id) ON DELETE CASCADE,

  -- Os oito tipos do F3-02. `cloze` fica de fora por decisão de escopo: exige
  -- um parser de sintaxe própria, e o modelo não impede acrescentá-lo depois.
  kind text NOT NULL CHECK (kind IN (
    'single_choice',    -- múltipla escolha, uma correta
    'multiple_choice',  -- múltiplas respostas
    'true_false',
    'essay',            -- dissertativa: correção manual
    'short_answer',     -- resposta curta, comparada por texto
    'numeric',          -- numérica, com tolerância
    'matching',         -- associação
    'ordering'          -- ordenação
  )),

  -- O enunciado. Texto com imagem embutida por URL é o que atende "questões
  -- com imagem" do guia sem exigir um editor de mídia próprio.
  prompt text NOT NULL CHECK (length(btrim(prompt)) > 0),

  -- Quanto a questão vale. O peso POR QUESTÃO que o guia pede; o peso por
  -- seção fica na prova.
  points numeric(6,2) NOT NULL DEFAULT 1 CHECK (points > 0),

  -- Explicação mostrada depois de responder — o "feedback posterior" do guia.
  explanation text,

  -- Tolerância da questão numérica: |resposta - correta| <= tolerance.
  -- Sem ela, 3.14 seria errado para uma correta de 3.14159, o que torna a
  -- questão numérica inutilizável fora de inteiros.
  tolerance numeric(12,4),

  author_id  uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS questions_tenant_idx ON questions (tenant_id);
CREATE INDEX IF NOT EXISTS questions_category_idx ON questions (category_id);
CREATE INDEX IF NOT EXISTS questions_course_idx ON questions (course_id);
CREATE INDEX IF NOT EXISTS questions_author_idx ON questions (author_id);

-- ------------------------------------------------------------ alternativas
--
-- Serve aos oito tipos, com significados diferentes conforme o `kind`:
--
--   single/multiple/true_false → `is_correct` marca a(s) certa(s)
--   short_answer               → cada linha é uma resposta aceita
--   numeric                    → `text` guarda o número correto
--   matching                   → `text` é o item, `match_text` o par
--   ordering                   → `position` é a ordem correta
--
-- Uma tabela só em vez de cinco: as cinco teriam as mesmas colunas com nomes
-- diferentes, e toda leitura precisaria saber de qual ler.
CREATE TABLE IF NOT EXISTS question_options (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES questions (id) ON DELETE CASCADE,

  text        text NOT NULL,
  -- O par, na associação.
  match_text  text,
  is_correct  boolean NOT NULL DEFAULT false,
  position    integer NOT NULL DEFAULT 0,

  -- Feedback específico desta alternativa: "quase — você confundiu X com Y".
  feedback    text
);

CREATE INDEX IF NOT EXISTS question_options_question_idx ON question_options (question_id);

-- ------------------------------------------------------ tags de questão
CREATE TABLE IF NOT EXISTS question_tags (
  question_id uuid NOT NULL REFERENCES questions (id) ON DELETE CASCADE,
  tag_id      uuid NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
  PRIMARY KEY (question_id, tag_id)
);

CREATE INDEX IF NOT EXISTS question_tags_tag_idx ON question_tags (tag_id);

COMMIT;

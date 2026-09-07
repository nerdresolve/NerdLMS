-- 008 — Turmas.
--
-- O guia §14 pede turmas com instrutor próprio, datas específicas e relatórios
-- por grupo. Hoje uma matrícula liga aluno e curso e nada mais: não há como
-- dizer "a turma de março da NR-10, com o Rafael, que começa dia 3".
--
-- TURMA NÃO É CURSO NOVO. É um recorte da matrícula: mesmo conteúdo, mesma
-- trilha, mesmo progresso. Duplicar o curso para cada turma multiplicaria o
-- conteúdo por N e faria a correção de uma aula precisar ser repetida em todas
-- as turmas — que é exatamente o problema que um LMS existe para não ter.
--
-- Conteúdo específico por turma (o guia também menciona) fica de fora por
-- decisão de escopo: exigiria uma camada de sobreposição entre turma e
-- estrutura do curso, afetando player, progresso e certificado. O modelo aqui
-- não impede acrescentá-la depois.

BEGIN;

CREATE TABLE IF NOT EXISTS course_classes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- O tenant é herdado do curso, mas fica explícito aqui pelo mesmo motivo das
  -- demais tabelas raiz: toda consulta filtra por ele, e depender do JOIN para
  -- o recorte é como uma consulta esquecida vaza dado de outro cliente.
  tenant_id  uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  course_id  uuid NOT NULL REFERENCES courses (id) ON DELETE CASCADE,

  name       text NOT NULL CHECK (length(btrim(name)) > 0),

  -- O instrutor DESTA turma. Pode não ser o autor do curso: quem escreveu a
  -- NR-10 não necessariamente conduz a turma de março em Manaus.
  instructor_id uuid REFERENCES users (id) ON DELETE SET NULL,

  -- Datas da turma. Independentes das do curso (007): o curso pode estar
  -- disponível o ano inteiro e a turma acontecer em duas semanas.
  starts_on  date,
  ends_on    date,

  -- Teto de vagas. NULL é "sem limite" — a turma aberta existe e é comum.
  capacity   integer CHECK (capacity IS NULL OR capacity > 0),

  status     text NOT NULL DEFAULT 'open'
             CHECK (status IN ('open', 'closed')),

  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE course_classes DROP CONSTRAINT IF EXISTS course_classes_window_check;
ALTER TABLE course_classes ADD CONSTRAINT course_classes_window_check
  CHECK (starts_on IS NULL OR ends_on IS NULL OR ends_on >= starts_on);

-- Nome único dentro do curso: duas "Turma de março" no mesmo curso tornariam
-- o relatório ambíguo para quem lê.
CREATE UNIQUE INDEX IF NOT EXISTS course_classes_name_idx ON course_classes (course_id, name);

CREATE INDEX IF NOT EXISTS course_classes_tenant_idx ON course_classes (tenant_id);
CREATE INDEX IF NOT EXISTS course_classes_course_idx ON course_classes (course_id);
CREATE INDEX IF NOT EXISTS course_classes_instructor_idx ON course_classes (instructor_id);

-- ----------------------------------------------------- matrícula em turma
--
-- Anulável: a matrícula sem turma continua sendo o caso normal. Um curso
-- livre, em que cada um entra quando quer, não tem turma nenhuma — e tornar a
-- coluna obrigatória exigiria inventar uma turma "padrão" para todo curso
-- existente, que é ficção no banco.
ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES course_classes (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS enrollments_class_idx ON enrollments (class_id);

-- A turma precisa ser DO MESMO CURSO da matrícula.
--
-- Uma FK sozinha não garante isso: ela só exige que a turma exista. Sem esta
-- checagem, uma matrícula no curso A poderia apontar para uma turma do curso
-- B, e o relatório por turma passaria a contar gente que não está nela.
--
-- Um CHECK não pode consultar outra tabela, então é um gatilho.
CREATE OR REPLACE FUNCTION enrollment_class_matches_course() RETURNS trigger AS $$
BEGIN
  IF NEW.class_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM course_classes c
     WHERE c.id = NEW.class_id AND c.course_id = NEW.course_id
  ) THEN
    RAISE EXCEPTION 'turma % não pertence ao curso %', NEW.class_id, NEW.course_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enrollments_class_course ON enrollments;
CREATE TRIGGER enrollments_class_course
  BEFORE INSERT OR UPDATE OF class_id, course_id ON enrollments
  FOR EACH ROW EXECUTE FUNCTION enrollment_class_matches_course();

COMMIT;

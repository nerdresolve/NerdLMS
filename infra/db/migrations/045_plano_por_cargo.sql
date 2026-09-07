-- 045 — O plano de formação passa a exigir trilha e curso, e a valer por cargo.
--
-- O QUE O PLANO ERA
--
-- "Estas pessoas precisam destas COMPETÊNCIAS nestes níveis, até esta data."
-- Bom para responder "quem sabe operar uma ETA, e em que nível". A montagem é
-- indireta: alguém cria a competência, liga o curso a ela, e o plano pede a
-- competência.
--
-- O QUE FALTAVA
--
-- A pergunta que a operação faz é outra: "o que forma um Analista de
-- Desenvolvimento PLENO?" A resposta é um conjunto de TRILHAS e CURSOS, direto,
-- sem passar por competência nenhuma. Hoje isso não cabia no plano, e criar uma
-- competência por trilha só para poder exigi-la seria inventar um degrau que
-- não significa nada.
--
-- Os dois convivem. Competência continua respondendo "sabe fazer, em que
-- nível"; trilha e curso respondem "cumpriu a formação". São perguntas
-- diferentes e o mesmo plano passa a fazer as duas.
--
-- E O PLANO PASSA A ALCANÇAR POR CARGO
--
-- A atribuição era pessoa a pessoa. Numa organização onde o cargo vem do Active
-- Directory, atribuir um a um significa alguém lembrar de fazer isso a cada
-- contratação — e o esquecimento não aparece: a pessoa simplesmente não tem
-- plano, e nada acusa.
--
-- `job_title` nulo mantém o plano como era: só quem for atribuído à mão. É o
-- mesmo sentido de vazio que `tracks.job_title` já usa.

BEGIN;

ALTER TABLE learning_plans ADD COLUMN IF NOT EXISTS job_title text;

CREATE INDEX IF NOT EXISTS learning_plans_job_title_idx
  ON learning_plans (tenant_id, job_title)
  WHERE job_title IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Os itens do plano
--
-- A chave primária era (plan_id, competency_id), o que impedia um item que não
-- fosse competência. Passa a haver um `id` próprio, e cada item aponta para UMA
-- das três coisas.
-- -----------------------------------------------------------------------------

ALTER TABLE learning_plan_items ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
UPDATE learning_plan_items SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE learning_plan_items ALTER COLUMN id SET NOT NULL;

ALTER TABLE learning_plan_items ADD COLUMN IF NOT EXISTS track_id uuid
  REFERENCES tracks(id) ON DELETE CASCADE;
ALTER TABLE learning_plan_items ADD COLUMN IF NOT EXISTS course_id uuid
  REFERENCES courses(id) ON DELETE CASCADE;

-- A CHAVE PRIMÁRIA SAI PRIMEIRO.
--
-- `competency_id` faz parte dela, e o Postgres recusa afrouxar uma coluna que
-- está numa chave primária — "column is in a primary key". A ordem importa.
DO $$
BEGIN
  ALTER TABLE learning_plan_items DROP CONSTRAINT learning_plan_items_pkey;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE learning_plan_items ADD PRIMARY KEY (id);
EXCEPTION WHEN invalid_table_definition THEN NULL;
END $$;

ALTER TABLE learning_plan_items ALTER COLUMN competency_id DROP NOT NULL;

-- `required_level` só faz sentido para competência: trilha e curso se cumprem
-- ou não se cumprem, não têm grau.
--
-- O DEFAULT SAI JUNTO, e é o detalhe que custou caro. `DROP NOT NULL` sozinho
-- deixava o `DEFAULT 1` de pé: um item de curso, que não informa o nível,
-- nascia com nível 1 e batia no CHECK abaixo — "violates check constraint
-- learning_plan_items_uma_coisa", numa inserção que não menciona nível nenhum.
ALTER TABLE learning_plan_items ALTER COLUMN required_level DROP NOT NULL;
ALTER TABLE learning_plan_items ALTER COLUMN required_level DROP DEFAULT;

-- EXATAMENTE UMA das três, e o nível só com competência.
--
-- Sem isto, um item com competência E curso ao mesmo tempo seria aceito, e a
-- leitura teria de escolher um por convenção — convenção que a próxima pessoa a
-- mexer não conheceria.
DO $$
BEGIN
  ALTER TABLE learning_plan_items ADD CONSTRAINT learning_plan_items_uma_coisa
    CHECK (
      (competency_id IS NOT NULL)::int
      + (track_id IS NOT NULL)::int
      + (course_id IS NOT NULL)::int = 1
      AND (required_level IS NULL) = (competency_id IS NULL)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- O mesmo alvo não entra duas vezes no mesmo plano. Índices parciais, porque
-- as colunas são nulas na maior parte das linhas.
CREATE UNIQUE INDEX IF NOT EXISTS learning_plan_items_competencia_unica
  ON learning_plan_items (plan_id, competency_id) WHERE competency_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS learning_plan_items_trilha_unica
  ON learning_plan_items (plan_id, track_id) WHERE track_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS learning_plan_items_curso_unico
  ON learning_plan_items (plan_id, course_id) WHERE course_id IS NOT NULL;

-- Chave estrangeira sem índice faz o CASCADE varrer a tabela.
CREATE INDEX IF NOT EXISTS learning_plan_items_plan_idx ON learning_plan_items (plan_id);
CREATE INDEX IF NOT EXISTS learning_plan_items_track_idx ON learning_plan_items (track_id);
CREATE INDEX IF NOT EXISTS learning_plan_items_course_idx ON learning_plan_items (course_id);
CREATE INDEX IF NOT EXISTS learning_plan_items_competency_idx
  ON learning_plan_items (competency_id);

COMMIT;

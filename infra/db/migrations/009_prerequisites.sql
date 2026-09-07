-- 009 — Pré-requisitos e liberação progressiva.
--
-- O guia §11 pede critérios COMBINÁVEIS: curso concluído, módulo concluído,
-- aula concluída, nota mínima, competência, grupo, perfil, data, inscrição —
-- "inclusive com condições combinadas", como o Moodle.
--
-- Duas decisões que isso força:
--
--   1. PRÉ-REQUISITO É LINHA, NÃO COLUNA. "Combináveis" significa N por alvo.
--      Uma coluna `prerequisite_course_id` permitiria exatamente um critério, e
--      o segundo exigiria migration nova.
--
--   2. LIBERAÇÃO PROGRESSIVA É O MESMO MOTOR. "Esta aula abre depois daquela"
--      tem a mesma forma que "este curso abre depois daquele": um alvo, um
--      critério, uma referência. Duas tabelas seriam duas implementações da
--      mesma regra, que divergem no primeiro ajuste.
--
-- Nota mínima e competência entram no CHECK desde já, embora F3 e F6 ainda não
-- existam: incluí-los agora custa uma linha e evita uma migration depois. O
-- avaliador simplesmente não sabe resolvê-los ainda, e trata como não atendido.

BEGIN;

CREATE TABLE IF NOT EXISTS unlock_rules (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,

  -- O QUE é liberado. Exatamente um destes é preenchido — o CHECK abaixo
  -- garante. Três colunas em vez de (tipo, id) genérico porque assim a FK
  -- funciona: um id solto não teria integridade referencial, e uma aula
  -- apagada deixaria regra apontando para o nada.
  course_id uuid REFERENCES courses (id) ON DELETE CASCADE,
  module_id uuid REFERENCES modules (id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES lessons (id) ON DELETE CASCADE,

  -- QUAL a condição.
  kind text NOT NULL CHECK (kind IN (
    'course_completed',   -- concluiu outro curso
    'module_completed',   -- concluiu um módulo
    'lesson_completed',   -- concluiu uma aula
    'min_grade',          -- nota mínima (F3)
    'competency',         -- competência adquirida (F6)
    'date',               -- a partir de uma data
    'class_member'        -- pertence a uma turma
  )),

  -- A REFERÊNCIA da condição, conforme o `kind`. Também uma por vez.
  required_course_id uuid REFERENCES courses (id) ON DELETE CASCADE,
  required_module_id uuid REFERENCES modules (id) ON DELETE CASCADE,
  required_lesson_id uuid REFERENCES lessons (id) ON DELETE CASCADE,
  required_class_id  uuid REFERENCES course_classes (id) ON DELETE CASCADE,
  required_date      date,
  -- 0 a 100. Guardado como inteiro para não haver dúvida de arredondamento.
  required_grade     integer CHECK (required_grade IS NULL OR (required_grade BETWEEN 0 AND 100)),

  created_at timestamptz NOT NULL DEFAULT now()
);

-- Exatamente UM alvo. Sem isto, uma regra com curso e aula preenchidos seria
-- ambígua: libera o curso ou a aula?
ALTER TABLE unlock_rules DROP CONSTRAINT IF EXISTS unlock_rules_one_target;
ALTER TABLE unlock_rules ADD CONSTRAINT unlock_rules_one_target CHECK (
  (course_id IS NOT NULL)::int + (module_id IS NOT NULL)::int + (lesson_id IS NOT NULL)::int = 1
);

-- A referência precisa combinar com o tipo da condição. Uma regra
-- `lesson_completed` sem `required_lesson_id` seria impossível de avaliar, e o
-- avaliador teria de decidir sozinho o que fazer com ela — provavelmente
-- liberando o conteúdo, que é o erro perigoso.
ALTER TABLE unlock_rules DROP CONSTRAINT IF EXISTS unlock_rules_reference_matches;
ALTER TABLE unlock_rules ADD CONSTRAINT unlock_rules_reference_matches CHECK (
  (kind = 'course_completed' AND required_course_id IS NOT NULL)
  OR (kind = 'module_completed' AND required_module_id IS NOT NULL)
  OR (kind = 'lesson_completed' AND required_lesson_id IS NOT NULL)
  OR (kind = 'class_member'     AND required_class_id  IS NOT NULL)
  OR (kind = 'date'             AND required_date      IS NOT NULL)
  OR (kind = 'min_grade'        AND required_grade     IS NOT NULL
                                AND required_course_id IS NOT NULL)
  OR (kind = 'competency')
);

CREATE INDEX IF NOT EXISTS unlock_rules_tenant_idx ON unlock_rules (tenant_id);
CREATE INDEX IF NOT EXISTS unlock_rules_course_idx ON unlock_rules (course_id);
CREATE INDEX IF NOT EXISTS unlock_rules_module_idx ON unlock_rules (module_id);
CREATE INDEX IF NOT EXISTS unlock_rules_lesson_idx ON unlock_rules (lesson_id);
CREATE INDEX IF NOT EXISTS unlock_rules_req_course_idx ON unlock_rules (required_course_id);
CREATE INDEX IF NOT EXISTS unlock_rules_req_module_idx ON unlock_rules (required_module_id);
CREATE INDEX IF NOT EXISTS unlock_rules_req_lesson_idx ON unlock_rules (required_lesson_id);
CREATE INDEX IF NOT EXISTS unlock_rules_req_class_idx ON unlock_rules (required_class_id);

-- ------------------------------------------------ liberação sequencial
--
-- O caso mais comum de liberação progressiva não merece uma regra por aula: um
-- curso "sequencial" libera cada aula quando a anterior conclui, e escrever N-1
-- regras para isso seria trabalho manual que o instrutor esqueceria de refazer
-- ao inserir uma aula no meio.
--
-- Com a coluna, o avaliador deriva a condição da POSIÇÃO, e inserir aula no
-- meio simplesmente funciona.
ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_release_check;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS content_release text NOT NULL DEFAULT 'open';
ALTER TABLE courses ADD CONSTRAINT courses_release_check
  CHECK (content_release IN ('open', 'sequential'));

COMMIT;

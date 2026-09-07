-- 006 — Progresso de vídeo e conclusão de aula viram coisas separadas.
--
-- O guia é explícito (§5): "assistir 20% do vídeo não necessariamente
-- significa concluir uma aula". Hoje as duas coisas são o mesmo número —
-- `completed` é derivado de `watched_seconds >= 90%`, e `completed_at`
-- existe na tabela mas ninguém lê. Quem manda é o cálculo.
--
-- Isso impede três coisas que um LMS precisa ter:
--
--   1. conclusão manual — a aula que não é vídeo (leitura, presencial) não
--      tem o que assistir, e portanto nunca conclui;
--   2. desmarcar — não há como voltar atrás sem apagar o progresso;
--   3. auditar quando concluiu — a data é recalculada a cada leitura, então
--      não existe "concluiu em 12 de março".
--
-- Depois desta migration `completed_at` é a fonte da verdade. O cálculo vira
-- o GATILHO da conclusão automática, não a conclusão em si.

BEGIN;

-- ---------------------------------------------------------------- retomada
--
-- `watched_seconds` mede CONSUMO: é o maior ponto alcançado, e o upsert usa
-- GREATEST para nunca regredir. Serve para saber quanto da aula a pessoa viu.
--
-- Isso é a resposta errada para "onde eu parei". Quem assiste até 8:00, volta
-- para 2:00 para rever algo e fecha a aba, deve retomar em 2:00 — mas
-- `watched_seconds` diz 8:00. São perguntas diferentes e precisam de colunas
-- diferentes: esta pode diminuir, aquela não.
ALTER TABLE lesson_progress
  ADD COLUMN IF NOT EXISTS last_position_seconds integer NOT NULL DEFAULT 0;

-- Retomar de um ponto além do fim do vídeo deixaria o player num estado
-- estranho; o cliente também valida, mas o banco é a última linha.
ALTER TABLE lesson_progress
  DROP CONSTRAINT IF EXISTS lesson_progress_position_sane;

ALTER TABLE lesson_progress
  ADD CONSTRAINT lesson_progress_position_sane
  CHECK (last_position_seconds >= 0 AND watched_seconds >= 0);

-- O dado que já existe: quem tem progresso retoma de onde o consumo indica.
-- É a melhor aproximação disponível para linha antiga — a posição real não
-- foi guardada em momento nenhum, então não há o que recuperar.
UPDATE lesson_progress
   SET last_position_seconds = watched_seconds
 WHERE last_position_seconds = 0
   AND watched_seconds > 0;

-- ---------------------------------------------- conclusão como fato próprio
--
-- Quem concluiu. NULL na conclusão automática — ninguém apertou nada, o
-- limiar foi cruzado. Preenchido na manual, inclusive quando um instrutor
-- marca pela pessoa.
ALTER TABLE lesson_progress
  ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES users (id) ON DELETE SET NULL;

-- Como concluiu. Sem isto não dá para distinguir "o sistema detectou" de
-- "a pessoa afirmou", e a diferença importa num relatório de conformidade.
ALTER TABLE lesson_progress
  DROP CONSTRAINT IF EXISTS lesson_progress_completion_source;

ALTER TABLE lesson_progress
  ADD COLUMN IF NOT EXISTS completion_source text;

ALTER TABLE lesson_progress
  ADD CONSTRAINT lesson_progress_completion_source
  CHECK (completion_source IS NULL OR completion_source IN ('auto', 'manual'));

-- Linha antiga que já tinha `completed_at` não sabe dizer como concluiu — a
-- coluna não existia. Recebe 'auto', que é o único mecanismo que existia até
-- aqui, e portanto é a verdade histórica.
--
-- Isto vem ANTES da restrição de coerência de propósito: impor a regra com
-- dado antigo ainda meio preenchido aborta a migration inteira, que foi
-- exatamente o que aconteceu na primeira tentativa.
UPDATE lesson_progress
   SET completion_source = 'auto'
 WHERE completed_at IS NOT NULL
   AND completion_source IS NULL;

-- Retroativo: a conclusão que hoje é calculada passa a ser registrada.
--
-- O limiar de 90% está em `packages/core/src/courses/progress.ts`
-- (COMPLETION_THRESHOLD). Repeti-lo aqui é duplicação, mas é duplicação de
-- uma linha só, executada uma vez, para converter dado existente — a
-- alternativa seria deixar quem já concluiu aparecer como não-concluído logo
-- após a migration, que é pior.
UPDATE lesson_progress lp
   SET completed_at = COALESCE(lp.completed_at, lp.updated_at),
       completion_source = 'auto'
  FROM lessons l
 WHERE l.id = lp.lesson_id
   AND lp.completed_at IS NULL
   AND l.duration_seconds > 0
   AND lp.watched_seconds::numeric / l.duration_seconds >= 0.9;

-- As duas colunas andam juntas: ou a aula está concluída e sabe-se como, ou
-- não está e nenhuma das duas se aplica. Um estado meio preenchido seria dado
-- corrompido silencioso.
--
-- A restrição entra por último, depois de todo dado antigo estar coerente.
ALTER TABLE lesson_progress
  DROP CONSTRAINT IF EXISTS lesson_progress_completion_coherent;

ALTER TABLE lesson_progress
  ADD CONSTRAINT lesson_progress_completion_coherent
  CHECK (
    (completed_at IS NULL AND completion_source IS NULL)
    OR
    (completed_at IS NOT NULL AND completion_source IS NOT NULL)
  );

-- ------------------------------------------------ como a aula conclui
--
-- Aula de vídeo conclui sozinha ao cruzar o limiar. Aula de leitura ou
-- encontro presencial não tem o que medir e depende de alguém marcar.
--
-- O padrão é 'auto' porque é o comportamento de hoje: sem isto, toda aula
-- existente passaria a exigir clique e o progresso de todo mundo congelaria.
ALTER TABLE lessons
  DROP CONSTRAINT IF EXISTS lessons_completion_mode;

ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS completion_mode text NOT NULL DEFAULT 'auto';

ALTER TABLE lessons
  ADD CONSTRAINT lessons_completion_mode
  CHECK (completion_mode IN ('auto', 'manual'));

-- A consulta quente da tela de curso é "o que esta matrícula concluiu".
CREATE INDEX IF NOT EXISTS lesson_progress_completed_idx
  ON lesson_progress (enrollment_id)
  WHERE completed_at IS NOT NULL;

COMMIT;

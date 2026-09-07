-- 028 — Anonimização de statements xAPI na exclusão de conta (LGPD).
--
-- A migração 021 escreveu que "a rotina de exclusão o limpa junto", falando do
-- `actor_mbox`. A rotina não existia. O comentário descrevia uma intenção, e
-- quem lesse acreditaria que o dado saía — que é o pior tipo de documentação.
--
-- O QUE FICA E O QUE SAI
--
-- `actor_id` já é `ON DELETE SET NULL`: apagar a pessoa desliga o statement em
-- vez de apagá-lo, e o que resta é "alguém completou a simulação X". Isso é
-- proposital — os números de uso de um treinamento que rodou de verdade
-- continuam verdadeiros.
--
-- O que não saía: `actor_mbox` (o e-mail), `actor_name` (o nome) e o `raw`,
-- que guarda o statement original recebido e traz o e-mail DENTRO do JSON.
-- Limpar as duas colunas e esquecer o `raw` seria anonimizar pela metade —
-- e a metade que fica é a que uma auditoria abriria primeiro.
--
-- POR QUE UMA EXCEÇÃO NO GATILHO, E POR QUE ELA É ESTREITA
--
-- O gatilho de imutabilidade recusa qualquer UPDATE que não seja o voiding.
-- Está certo: statement é registro do que aconteceu. Mas a LGPD é lei, e o
-- titular tem direito à eliminação.
--
-- A exceção confere que SÓ os três campos de identificação mudaram, e que os
-- três ficaram nulos ou anônimos. Verbo, objeto, resultado, data — nada disso
-- pode mudar por aqui. Uma exceção larga ("permita UPDATE quando actor_id for
-- nulo") deixaria reescrever a nota de uma avaliação passada.

BEGIN;

CREATE OR REPLACE FUNCTION xapi_statements_immutable() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'xapi_statements é somente-inserção: statements não se apagam'
      USING HINT = 'Para anular um statement, envie um statement de "voided" apontando para ele.';
  END IF;

  -- Voiding: o caminho normal de anular um statement.
  IF OLD.voided_by IS NULL AND NEW.voided_by IS NOT NULL
     AND NEW.raw = OLD.raw
     AND NEW.verb_id = OLD.verb_id
     AND NEW.object_id = OLD.object_id THEN
    RETURN NEW;
  END IF;

  -- Anonimização (LGPD).
  --
  -- Cada condição existe por um motivo:
  --   * os três campos de identificação têm de ficar limpos — anonimizar pela
  --     metade não é anonimizar;
  --   * TUDO o mais tem de continuar igual, e é isso que impede esta brecha de
  --     virar um caminho para reescrever a nota de uma avaliação passada.
  IF NEW.actor_mbox IS NULL
     AND NEW.actor_name IS NULL
     AND NEW.raw ? 'anonimizado'
     AND NEW.verb_id           IS NOT DISTINCT FROM OLD.verb_id
     AND NEW.object_id         IS NOT DISTINCT FROM OLD.object_id
     AND NEW.object_name       IS NOT DISTINCT FROM OLD.object_name
     AND NEW.result_success    IS NOT DISTINCT FROM OLD.result_success
     AND NEW.result_completion IS NOT DISTINCT FROM OLD.result_completion
     AND NEW.result_score_raw  IS NOT DISTINCT FROM OLD.result_score_raw
     AND NEW.result_score_scaled IS NOT DISTINCT FROM OLD.result_score_scaled
     AND NEW.timestamp         IS NOT DISTINCT FROM OLD.timestamp
     AND NEW.course_id         IS NOT DISTINCT FROM OLD.course_id
     AND NEW.lesson_id         IS NOT DISTINCT FROM OLD.lesson_id
     AND NEW.tenant_id         IS NOT DISTINCT FROM OLD.tenant_id THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'xapi_statements é somente-inserção: statements são imutáveis por definição'
    USING HINT = 'O xAPI define statements como registro do que aconteceu. Use voiding.';
END;
$$ LANGUAGE plpgsql;

COMMIT;

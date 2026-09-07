-- 022 — A chave de API que enviou statement não é apagável (F6-03).
--
-- O DEFEITO que isto corrige, encontrado ao limpar dados de teste:
--
--   `xapi_statements.api_key_id` era `ON DELETE SET NULL`. Apagar uma chave de
--   API dispara um UPDATE nos statements dela — e o gatilho de imutabilidade
--   recusa qualquer UPDATE que não seja anulação. O resultado é que apagar a
--   chave falhava com "statements são imutáveis por definição", numa operação
--   que não menciona statement nenhum. Ninguém entenderia.
--
-- A ESCOLHA é RESTRICT, e não afrouxar o gatilho.
--
-- Afrouxar seria abrir uma exceção no que garante que statement não se altera —
-- e a exceção passaria a valer para toda coluna, não só esta. Com RESTRICT o
-- banco diz a verdade: "há statements enviados por esta chave".
--
-- E a verdade é essa mesma. Uma chave que enviou statements é a PROCEDÊNCIA
-- deles: apagá-la transformaria "veio do simulador de operação" em "veio de
-- lugar nenhum". Chave de API não se apaga, se REVOGA (`revoked_at`) — o que
-- já era o comportamento do produto desde a 017, e continua funcionando porque
-- revogar é UPDATE em `api_keys`, não DELETE.

BEGIN;

ALTER TABLE xapi_statements
  DROP CONSTRAINT IF EXISTS xapi_statements_api_key_id_fkey;

ALTER TABLE xapi_statements
  ADD CONSTRAINT xapi_statements_api_key_id_fkey
  FOREIGN KEY (api_key_id) REFERENCES api_keys (id) ON DELETE RESTRICT;

-- Mesma coisa para curso e aula: `SET NULL` neles também dispararia UPDATE.
--
-- Aqui o vínculo é mais fraco — um statement sobrevive ao curso que o originou,
-- e o `object_id` guarda o IRI de qualquer jeito —, mas o efeito do gatilho é
-- idêntico: apagar um curso falharia citando imutabilidade de statement.
ALTER TABLE xapi_statements
  DROP CONSTRAINT IF EXISTS xapi_statements_course_id_fkey;

ALTER TABLE xapi_statements
  ADD CONSTRAINT xapi_statements_course_id_fkey
  FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE RESTRICT;

ALTER TABLE xapi_statements
  DROP CONSTRAINT IF EXISTS xapi_statements_lesson_id_fkey;

ALTER TABLE xapi_statements
  ADD CONSTRAINT xapi_statements_lesson_id_fkey
  FOREIGN KEY (lesson_id) REFERENCES lessons (id) ON DELETE RESTRICT;

-- `actor_id` fica como está: `ON DELETE SET NULL` de propósito.
--
-- É a saída da LGPD — apagar a pessoa precisa funcionar — e por isso o gatilho
-- precisa deixá-la passar. Sem esta exceção, o produto não conseguiria cumprir
-- um pedido de exclusão de conta.
CREATE OR REPLACE FUNCTION xapi_statements_immutable() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'xapi_statements é somente-inserção: statements não se apagam'
      USING HINT = 'Para anular um statement, envie um statement de "voided" apontando para ele.';
  END IF;

  -- Anulação: o mecanismo que o padrão define.
  IF OLD.voided_by IS NULL AND NEW.voided_by IS NOT NULL
     AND NEW.raw = OLD.raw
     AND NEW.verb_id = OLD.verb_id
     AND NEW.object_id = OLD.object_id THEN
    RETURN NEW;
  END IF;

  -- Desligar o ATOR, e só ele: é o `ON DELETE SET NULL` de `users` passando.
  --
  -- Confere que nada mais mudou junto — sem isto, a exclusão de uma conta
  -- seria a brecha para reescrever o verbo de um statement.
  IF OLD.actor_id IS NOT NULL AND NEW.actor_id IS NULL
     AND NEW.raw = OLD.raw
     AND NEW.verb_id = OLD.verb_id
     AND NEW.object_id = OLD.object_id
     AND NEW.voided_by IS NOT DISTINCT FROM OLD.voided_by THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'xapi_statements é somente-inserção: statements são imutáveis por definição'
    USING HINT = 'O xAPI define statements como registro do que aconteceu. Use voiding.';
END;
$$ LANGUAGE plpgsql;

COMMIT;

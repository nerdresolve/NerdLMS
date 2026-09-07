-- 024 — Nota vinda de ferramenta LTI (F6-04).
--
-- O DEFEITO que isto corrige, encontrado testando o AGS:
--
--   `grade_entries` exigia que toda nota pertencesse a uma prova OU a um
--   trabalho — `grade_entries_one_activity`. Uma nota lançada por ferramenta
--   externa não é nem uma coisa nem outra, e o lançamento falhava com 500.
--
-- A SAÍDA NÃO É afrouxar o CHECK para aceitar nota sem origem.
--
-- O CHECK existe por um bom motivo: nota sem atividade é nota que ninguém sabe
-- de onde veio, e no livro de notas ela apareceria como uma linha órfã que não
-- dá para conferir nem contestar. Afrouxar resolveria o erro e criaria o
-- problema que o CHECK previne.
--
-- A saída é reconhecer a TERCEIRA origem legítima: o link LTI. Ele é uma
-- atividade do curso como as outras — tem título, vale nota, aparece no plano
-- de aula —, só que executada fora daqui.

BEGIN;

ALTER TABLE grade_entries
  -- RESTRICT, e não SET NULL.
  --
  -- Com SET NULL, apagar um link LTI deixaria a nota dele com as TRÊS origens
  -- nulas — e o CHECK abaixo, que exige exatamente uma, recusaria a operação
  -- com uma mensagem sobre `grade_entries` numa operação sobre `lti_links`.
  --
  -- E a verdade é que não se apaga: `grade_entries` é append-only, e a nota
  -- lançada por uma ferramenta precisa continuar dizendo QUAL ferramenta a
  -- lançou. Link com nota lançada se desativa junto com a ferramenta.
  ADD COLUMN IF NOT EXISTS lti_link_id uuid REFERENCES lti_links (id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS grade_entries_lti_idx
    ON grade_entries (lti_link_id) WHERE lti_link_id IS NOT NULL;

-- Exatamente UMA origem, agora entre três.
ALTER TABLE grade_entries DROP CONSTRAINT IF EXISTS grade_entries_one_activity;

ALTER TABLE grade_entries
  ADD CONSTRAINT grade_entries_one_activity CHECK (
    (quiz_id       IS NOT NULL)::integer +
    (assignment_id IS NOT NULL)::integer +
    (lti_link_id   IS NOT NULL)::integer = 1
  );

COMMIT;

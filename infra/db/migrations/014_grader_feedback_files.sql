-- 014 — Feedback por arquivo: o corretor devolve o PDF comentado.
--
-- O guia §8 pede "feedback textual E POR ARQUIVO". O textual já existia
-- (`grade_entries.feedback`); faltava o corretor poder devolver um arquivo — o
-- trabalho com anotações, a planilha corrigida, o áudio com observações.
--
-- REAPROVEITA `submission_files` em vez de criar uma tabela nova.
--
-- Um arquivo de devolução tem exatamente a mesma forma de um arquivo de
-- entrega: nome, tamanho, chave no storage, pendurado na mesma entrega. Duas
-- tabelas idênticas com nomes diferentes obrigariam toda leitura a consultar as
-- duas e concatenar — e a diferença é só a DIREÇÃO, que uma coluna expressa.

BEGIN;

ALTER TABLE submission_files
  ADD COLUMN IF NOT EXISTS from_grader boolean NOT NULL DEFAULT false;

-- O padrão `false` é o que preserva o que já existe: todo arquivo gravado até
-- aqui veio do aluno.

-- A listagem separa os dois na leitura, e o índice parcial serve à consulta
-- mais comum — "o que o corretor devolveu nesta entrega".
CREATE INDEX IF NOT EXISTS submission_files_grader_idx
  ON submission_files (submission_id) WHERE from_grader;

COMMIT;

-- 029 — SCORM 2004 (guia §23, que pede 1.2 E 2004).
--
-- O 2004 não é uma versão nova do 1.2: é outro vocabulário. Um pacote 2004
-- chama `GetValue("cmi.completion_status")` e recebe vazio de uma API 1.2, que
-- só conhece `cmi.core.lesson_status`. O conteúdo não avisa — ele simplesmente
-- não registra progresso, e o aluno refaz a aula achando que é problema dele.
--
-- POR QUE COLUNAS NOVAS, E NÃO REAPROVEITAR AS QUE EXISTEM
--
-- `lesson_status` do 1.2 guarda numa palavra só duas coisas que o 2004 separa:
-- concluiu (viu tudo) e passou (acertou). A separação é útil e não cabe na
-- coluna antiga — quem reprova numa prova VIU a aula inteira, e o progresso do
-- curso tem de reconhecer isso. Espremer os dois em `lesson_status` perderia
-- exatamente a informação que o 2004 acrescenta.
--
-- `score_scaled` também é nova: vai de -1 a 1 e é a nota que o padrão manda
-- usar para decidir aprovação. A bruta continua, e continua sem significado
-- sozinha — "80" pode ser 80 de 100 ou 80 de 500.
--
-- As colunas são NULAS para pacote 1.2, e as do 1.2 são nulas para 2004. Cada
-- linha usa o vocabulário da versão dela, e `scorm_packages.version` diz qual.

BEGIN;

ALTER TABLE scorm_tracking
  -- "Viu tudo?" — independente de ter acertado.
  ADD COLUMN IF NOT EXISTS completion_status text
    CHECK (completion_status IN ('completed', 'incomplete', 'not attempted', 'unknown')),

  -- "Acertou?" — independente de ter visto tudo.
  ADD COLUMN IF NOT EXISTS success_status text
    CHECK (success_status IN ('passed', 'failed', 'unknown')),

  -- A nota normalizada. A faixa é do padrão, e o CHECK a torna verdade aqui:
  -- um pacote que mande 85 (querendo dizer bruto) não vira aprovação absurda
  -- contra um corte de 0,7.
  ADD COLUMN IF NOT EXISTS score_scaled numeric(4, 3)
    CHECK (score_scaled IS NULL OR (score_scaled >= -1 AND score_scaled <= 1)),

  -- Como a sessão terminou. No 1.2 isso se deduzia do `suspend_data`.
  ADD COLUMN IF NOT EXISTS exit_mode text
    CHECK (exit_mode IS NULL OR exit_mode IN ('', 'time-out', 'suspend', 'logout', 'normal'));

-- A nota de corte declarada no manifesto, normalizada.
--
-- Fica no PACOTE, não no acompanhamento: é característica do conteúdo, igual
-- para todo mundo que o fizer. `mastery_score` (1.2) continua ao lado, na
-- escala bruta que aquele padrão usa.
ALTER TABLE scorm_packages
  ADD COLUMN IF NOT EXISTS scaled_passing_score numeric(4, 3)
    CHECK (scaled_passing_score IS NULL
           OR (scaled_passing_score >= -1 AND scaled_passing_score <= 1));

COMMIT;

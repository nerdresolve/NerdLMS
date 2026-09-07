-- 031 — cmi5 (guia §26).
--
-- O §26 diz para não tratar isto "apenas como mais um formato de upload; é uma
-- camada de tracking/interoperabilidade". É exatamente o que cmi5 é: uma
-- especificação SOBRE o xAPI, que o LRS deste produto já implementa.
--
-- O QUE cmi5 ACRESCENTA AO xAPI CRU
--
-- xAPI aceita qualquer verbo sobre qualquer objeto. Isso é poderoso e
-- inutilizável para responder "esta pessoa concluiu o curso?": dois conteúdos
-- relatam a mesma coisa de formas diferentes, e não há como comparar. cmi5 fixa
-- nove verbos, define quem emite cada um, e amarra tudo a uma SESSÃO.
--
-- A SESSÃO É O QUE ESTAS TABELAS GUARDAM.
--
-- Sem ela, um `completed` solto no LRS não diz de qual tentativa é. Com ela, a
-- plataforma sabe que aquele `completed` pertence à sessão que ela mesma abriu,
-- para aquela pessoa, naquela unidade — e pode recusar o que não pertence.

BEGIN;

-- ---------------------------------------------------------------------------
-- A unidade de conteúdo (AU, na linguagem do cmi5).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cmi5_units (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES lessons (id) ON DELETE CASCADE,

  -- O identificador que o autor deu à unidade, dentro do pacote.
  publisher_id text NOT NULL,
  title        text NOT NULL,
  -- Onde o conteúdo mora. A plataforma acrescenta os parâmetros de launch.
  launch_url   text NOT NULL,

  -- O critério de conclusão, declarado pelo AUTOR.
  --
  -- É a regra mais importante do cmi5, e é do conteúdo, não da plataforma: sem
  -- ela, teríamos de adivinhar se um `passed` sem `completed` vale, e a
  -- resposta muda por unidade.
  move_on text NOT NULL DEFAULT 'CompletedOrPassed'
    CHECK (move_on IN ('Passed', 'Completed', 'CompletedAndPassed',
                       'CompletedOrPassed', 'NotApplicable')),

  -- Nota de corte, de 0 a 1. Nula deixa a decisão com o conteúdo.
  mastery_score numeric(4, 3)
    CHECK (mastery_score IS NULL OR (mastery_score >= 0 AND mastery_score <= 1)),

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS cmi5_units_lesson_idx ON cmi5_units (lesson_id);
CREATE INDEX IF NOT EXISTS cmi5_units_tenant_idx ON cmi5_units (tenant_id);

-- ---------------------------------------------------------------------------
-- A sessão: uma tentativa de uma pessoa numa unidade.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cmi5_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  unit_id       uuid NOT NULL REFERENCES cmi5_units (id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  enrollment_id uuid REFERENCES enrollments (id) ON DELETE SET NULL,

  -- O token que o conteúdo usa para falar com o LRS.
  --
  -- É por sessão, e não por pessoa: um token vazado dá acesso a UMA tentativa
  -- de UMA unidade, e não à conta inteira. É o mesmo raciocínio da URL
  -- assinada do storage.
  auth_token text NOT NULL UNIQUE,

  -- Os verbos já registrados, na ordem. É o que a validação de sequência lê.
  --
  -- Array e não tabela filha: a sequência é lida inteira a cada statement, tem
  -- no máximo nove elementos, e uma tabela obrigaria a um JOIN por statement
  -- para responder "este verbo já veio?".
  verbs text[] NOT NULL DEFAULT '{}',

  -- Preenchido quando o `moveOn` é satisfeito. É o que a plataforma consulta
  -- para saber se a aula conta como feita.
  satisfied_at timestamptz,
  -- Dispensa administrativa: não passou pela sessão, mas conta.
  waived_at    timestamptz,

  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at   timestamptz,
  -- Passado este instante, o token não vale mais.
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS cmi5_sessions_tenant_idx ON cmi5_sessions (tenant_id);
CREATE INDEX IF NOT EXISTS cmi5_sessions_unit_idx ON cmi5_sessions (unit_id);
CREATE INDEX IF NOT EXISTS cmi5_sessions_user_idx ON cmi5_sessions (user_id);
CREATE INDEX IF NOT EXISTS cmi5_sessions_enrollment_idx ON cmi5_sessions (enrollment_id);

-- A pergunta que a tela faz: "esta pessoa já cumpriu esta unidade?"
CREATE INDEX IF NOT EXISTS cmi5_sessions_cumprida_idx
  ON cmi5_sessions (user_id, unit_id)
  WHERE satisfied_at IS NOT NULL;

COMMIT;

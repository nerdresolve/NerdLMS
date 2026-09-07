-- 020 — Competências, evidências e planos de desenvolvimento (F6-02, guia §20).
--
-- O guia pede framework, competência, nível de domínio, evidência, competência
-- por curso e por atividade, progressão, learning plans e relatório de gaps.
--
-- A PERGUNTA QUE ISTO RESPONDE, e que o produto ainda não respondia:
--
--   "Quem na minha equipe sabe operar uma ETA?" — não "quem fez o curso de
--   ETA". São coisas diferentes: alguém pode ter a competência por experiência
--   e nunca ter feito o curso, e alguém pode ter feito o curso há seis anos.
--
-- Curso e competência não são a mesma coisa, e é por isso que são tabelas
-- separadas com um vínculo no meio. Um curso pode desenvolver várias
-- competências; uma competência pode vir de vários cursos, ou de nenhum.

BEGIN;

-- ---------------------------------------------------------------------------
-- O framework: o conjunto de competências de um cliente.
--
-- Existe porque uma empresa tem mais de um: "Competências Técnicas de
-- Operação" e "Competências de Liderança" não se comparam nem se somam, e
-- misturá-las num relatório de gaps produziria um número que não significa
-- nada.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS competency_frameworks (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,

  name        text NOT NULL CHECK (length(btrim(name)) > 0),
  description text,

  -- Os níveis de domínio, do menor para o maior.
  --
  -- Array e não tabela: os níveis são uma ESCALA — "Básico, Intermediário,
  -- Avançado" —, e o que importa deles é a ORDEM. Uma tabela exigiria uma
  -- coluna de posição e uma junção para responder "que nível é maior", que é
  -- a única pergunta que se faz sobre eles.
  --
  -- O ÍNDICE no array é o nível: 1 é o primeiro, e é assim que se compara.
  levels text[] NOT NULL DEFAULT ARRAY['Básico', 'Intermediário', 'Avançado'],

  active boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Uma escala precisa de pelo menos dois degraus para ser escala.
  CONSTRAINT frameworks_levels_min CHECK (cardinality(levels) >= 2)
);

CREATE INDEX IF NOT EXISTS frameworks_tenant_idx ON competency_frameworks (tenant_id);

CREATE UNIQUE INDEX IF NOT EXISTS frameworks_tenant_name_key
    ON competency_frameworks (tenant_id, lower(btrim(name)));


-- ---------------------------------------------------------------------------
-- A competência em si.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS competencies (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  framework_id uuid NOT NULL REFERENCES competency_frameworks (id) ON DELETE CASCADE,

  -- Hierarquia: "Tratamento de água" contém "Coagulação e floculação".
  --
  -- Uma competência-mãe é atingida quando as filhas são — mas isso é regra de
  -- domínio, calculada, não coluna. Guardar "atingida" aqui exigiria recalcular
  -- a árvore inteira a cada evidência nova.
  parent_id uuid REFERENCES competencies (id) ON DELETE CASCADE,

  code        text,
  name        text NOT NULL CHECK (length(btrim(name)) > 0),
  description text,

  -- O resultado de aprendizagem: o que a pessoa consegue FAZER.
  --
  -- É o "learning outcome" do §20, e é o que distingue competência de assunto:
  -- "saneamento" é assunto; "dimensionar uma rede de distribuição" é
  -- competência, porque dá para observar se aconteceu.
  learning_outcome text,

  active boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS competencies_tenant_idx    ON competencies (tenant_id);
CREATE INDEX IF NOT EXISTS competencies_framework_idx ON competencies (framework_id);
CREATE INDEX IF NOT EXISTS competencies_parent_idx    ON competencies (parent_id);

CREATE UNIQUE INDEX IF NOT EXISTS competencies_framework_name_key
    ON competencies (framework_id, lower(btrim(name)));


-- ---------------------------------------------------------------------------
-- O vínculo com o que se aprende: curso, aula, prova ou trabalho.
--
-- UMA tabela para os quatro, e não quatro tabelas: a pergunta é sempre a mesma
-- — "concluir isto desenvolve qual competência, em que nível?" —, e a fonte só
-- muda o nome da coluna.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS competency_links (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competency_id uuid NOT NULL REFERENCES competencies (id) ON DELETE CASCADE,

  course_id     uuid REFERENCES courses (id)     ON DELETE CASCADE,
  lesson_id     uuid REFERENCES lessons (id)     ON DELETE CASCADE,
  quiz_id       uuid REFERENCES quizzes (id)     ON DELETE CASCADE,
  assignment_id uuid REFERENCES assignments (id) ON DELETE CASCADE,

  -- O nível que concluir esta atividade concede. 1 é o primeiro do framework.
  --
  -- Um curso introdutório dá o nível 1; o avançado dá o 3. Sem isto, todo curso
  -- concederia "a competência" inteira, e a escala do framework não teria uso.
  grants_level integer NOT NULL DEFAULT 1 CHECK (grants_level >= 1),

  created_at timestamptz NOT NULL DEFAULT now(),

  -- Exatamente UMA fonte por vínculo.
  --
  -- Sem isto caberia uma linha com curso E prova, e ninguém saberia qual delas
  -- concede o nível — nem o código, que teria de escolher em silêncio.
  CONSTRAINT competency_links_one_source CHECK (
    (CASE WHEN course_id     IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN lesson_id     IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN quiz_id       IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN assignment_id IS NOT NULL THEN 1 ELSE 0 END) = 1
  )
);

CREATE INDEX IF NOT EXISTS competency_links_comp_idx   ON competency_links (competency_id);
CREATE INDEX IF NOT EXISTS competency_links_course_idx ON competency_links (course_id);

-- O mesmo curso não desenvolve a mesma competência duas vezes.
CREATE UNIQUE INDEX IF NOT EXISTS competency_links_course_key
    ON competency_links (competency_id, course_id) WHERE course_id IS NOT NULL;


-- ---------------------------------------------------------------------------
-- A EVIDÊNCIA: por que se afirma que alguém tem a competência.
--
-- Append-only pelo mesmo motivo de `grade_entries`: "esta pessoa tem esta
-- competência" é afirmação que alguém pode precisar defender numa auditoria de
-- compliance, e uma afirmação que se pode reescrever não prova nada.
--
-- O nível VIGENTE é a maior evidência não revogada — calculado, nunca guardado.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS competency_evidence (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  -- RESTRICT, e não CASCADE.
  --
  -- A evidência é append-only: o gatilho abaixo recusa DELETE. Com CASCADE,
  -- apagar a competência tentaria apagar a evidência, o gatilho recusaria, e o
  -- erro chegaria como "somente-inserção" — numa operação que não menciona
  -- evidência nenhuma. Ninguém entenderia.
  --
  -- Com RESTRICT o banco diz a verdade na hora certa: "há evidência
  -- referenciando esta competência". E a verdade é essa mesma — competência com
  -- evidência não se apaga, se DESATIVA (`active = false`), porque a afirmação
  -- "fulano tinha esta competência" continua tendo de ser defensável.
  competency_id uuid NOT NULL REFERENCES competencies (id) ON DELETE RESTRICT,

  -- Pessoa é o único CASCADE que sobra: LGPD manda apagar tudo de quem pede
  -- exclusão, e evidência de alguém que não existe mais não prova nada sobre
  -- ninguém.
  user_id       uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,

  level integer NOT NULL CHECK (level >= 1),

  -- De onde veio.
  source text NOT NULL CHECK (source IN (
    'course',      -- concluiu um curso vinculado
    'lesson',      -- concluiu uma aula vinculada
    'quiz',        -- passou numa prova vinculada
    'assignment',  -- entregou um trabalho vinculado
    'manual',      -- alguém atestou
    'external'     -- formação de fora da plataforma
  )),

  -- O que originou, quando é da plataforma.
  course_id     uuid REFERENCES courses (id)     ON DELETE SET NULL,
  lesson_id     uuid REFERENCES lessons (id)     ON DELETE SET NULL,
  quiz_id       uuid REFERENCES quizzes (id)     ON DELETE SET NULL,
  assignment_id uuid REFERENCES assignments (id) ON DELETE SET NULL,

  -- A justificativa, para evidência manual ou externa.
  note text,

  -- Quem atestou. Nulo quando foi a plataforma.
  attested_by uuid REFERENCES users (id) ON DELETE SET NULL,

  -- Quando a competência precisa ser revalidada.
  --
  -- Competência técnica envelhece: quem operou uma ETA em 2019 e nunca mais
  -- voltou não opera hoje. É o que sustenta o relatório de recertificação.
  expires_at timestamptz,

  -- Revogação: a evidência deixa de contar, mas continua registrada.
  revoked_at     timestamptz,
  revoked_reason text,

  created_at timestamptz NOT NULL DEFAULT now(),

  -- Evidência manual ou externa exige justificativa: sem ela, ninguém sabe
  -- depois por que a competência foi atribuída, que é justamente o que uma
  -- auditoria pergunta.
  CONSTRAINT evidence_manual_needs_note CHECK (
    source NOT IN ('manual', 'external') OR length(btrim(coalesce(note, ''))) > 0
  )
);

CREATE INDEX IF NOT EXISTS evidence_user_idx   ON competency_evidence (user_id, competency_id);
CREATE INDEX IF NOT EXISTS evidence_tenant_idx ON competency_evidence (tenant_id);
CREATE INDEX IF NOT EXISTS evidence_comp_idx   ON competency_evidence (competency_id);

-- A mesma origem não gera evidência duas vezes.
--
-- Parcial sobre as não revogadas, como em `badge_awards`: depois de revogar,
-- reconquistar tem de ser possível.
CREATE UNIQUE INDEX IF NOT EXISTS evidence_no_duplicate_course
    ON competency_evidence (user_id, competency_id, course_id)
 WHERE course_id IS NOT NULL AND revoked_at IS NULL;

-- Append-only: alterar uma evidência é reescrever a prova.
CREATE OR REPLACE FUNCTION competency_evidence_append_only() RETURNS trigger AS $$
BEGIN
  -- Exclusão da PESSOA passa: é o CASCADE de `users`, e é o que a LGPD exige
  -- quando alguém pede para ser apagado. Sem esta saída, o produto não
  -- conseguiria cumprir um pedido de exclusão — e o gatilho, feito para
  -- proteger a prova, viraria o motivo de descumprir a lei.
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM users WHERE id = OLD.user_id) THEN
    RETURN OLD;
  END IF;

  -- A revogação é a ÚNICA alteração permitida: ela não reescreve o que
  -- aconteceu, acrescenta que deixou de valer.
  IF TG_OP = 'UPDATE'
     AND OLD.revoked_at IS NULL
     AND NEW.revoked_at IS NOT NULL
     AND NEW.level = OLD.level
     AND NEW.competency_id = OLD.competency_id
     AND NEW.user_id = OLD.user_id
     AND NEW.source = OLD.source THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'competency_evidence é somente-inserção: para mudar o nível, registre outra evidência'
    USING HINT = 'Evidência alterável não prova competência nenhuma. Mesma regra de grade_entries.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS competency_evidence_immutable ON competency_evidence;
CREATE TRIGGER competency_evidence_immutable
  BEFORE UPDATE OR DELETE ON competency_evidence
  FOR EACH ROW EXECUTE FUNCTION competency_evidence_append_only();


-- ---------------------------------------------------------------------------
-- O plano de desenvolvimento: que competências esta pessoa PRECISA ter.
--
-- É o outro lado da evidência. A evidência diz o que a pessoa tem; o plano diz
-- o que ela deveria ter — e a diferença entre os dois é o RELATÓRIO DE GAPS que
-- o §20 pede.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS learning_plans (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,

  name        text NOT NULL CHECK (length(btrim(name)) > 0),
  description text,

  -- Prazo para completar o plano.
  due_date date,

  active boolean NOT NULL DEFAULT true,

  created_by uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS learning_plans_tenant_idx ON learning_plans (tenant_id);

CREATE UNIQUE INDEX IF NOT EXISTS learning_plans_tenant_name_key
    ON learning_plans (tenant_id, lower(btrim(name)));


-- O que o plano exige.
CREATE TABLE IF NOT EXISTS learning_plan_items (
  plan_id       uuid NOT NULL REFERENCES learning_plans (id) ON DELETE CASCADE,
  competency_id uuid NOT NULL REFERENCES competencies (id) ON DELETE CASCADE,

  -- O nível exigido. Ter nível 1 não cumpre um item que pede 3.
  required_level integer NOT NULL DEFAULT 1 CHECK (required_level >= 1),

  PRIMARY KEY (plan_id, competency_id)
);


-- Quem segue o plano.
--
-- Por PESSOA, e não por cargo ou unidade: cargo muda, e um plano amarrado a
-- cargo transferiria o plano de alguém para o sucessor dele sem ninguém pedir.
-- Atribuir a uma equipe inteira é atribuir a cada pessoa dela, numa operação.
CREATE TABLE IF NOT EXISTS learning_plan_assignments (
  plan_id     uuid NOT NULL REFERENCES learning_plans (id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,

  assigned_by uuid REFERENCES users (id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (plan_id, user_id)
);

CREATE INDEX IF NOT EXISTS plan_assignments_user_idx ON learning_plan_assignments (user_id);

COMMIT;

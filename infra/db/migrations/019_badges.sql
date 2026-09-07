-- 019 — Badges configuráveis, emissão e verificação pública (F6-01, guia §19).
--
-- O produto JÁ TEM medalhas, em `courses/gamification.ts`: uma lista fixa no
-- código, calculada na hora a partir do progresso. Elas continuam — são a
-- gamificação, e funcionam bem para o que fazem.
--
-- O que o §19 pede é outra coisa, e é por isso que estas tabelas existem:
--
--   * badge que o CLIENTE cria, não que vem no produto;
--   * critério configurável, inclusive emissão à mão;
--   * data de emissão registrada — a medalha calculada não tem "quando";
--   * expiração e revogação;
--   * verificação por quem está de FORA, sem conta na plataforma.
--
-- A diferença de fundo é essa última. Uma medalha calculada existe enquanto a
-- consulta a recalcular; um badge emitido é um FATO com data, que alguém de
-- fora precisa poder conferir anos depois — inclusive depois de a pessoa sair
-- da empresa. Por isso ele é linha em tabela, e não função.

BEGIN;

CREATE TABLE IF NOT EXISTS badges (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,

  name        text NOT NULL CHECK (length(btrim(name)) > 0),
  description text NOT NULL CHECK (length(btrim(description)) > 0),

  -- Ícone do catálogo do produto (lucide), não arquivo. Um upload por badge
  -- traria storage, tamanho, formato e moderação para um problema que um
  -- catálogo resolve — e o Open Badges aceita a imagem por URL, que a
  -- plataforma gera a partir daqui.
  icon text NOT NULL DEFAULT 'award',

  -- Como se ganha. `manual` é o único que não se calcula: alguém decide.
  criterion text NOT NULL DEFAULT 'manual'
    CHECK (criterion IN (
      'manual',           -- emitido à mão por instrutor ou admin
      'course_completed', -- concluiu UM curso específico
      'track_completed',  -- concluiu uma trilha
      'courses_count',    -- concluiu N cursos quaisquer
      'lessons_count',    -- concluiu N aulas
      'grade_above'       -- tirou nota >= X num curso
    )),

  -- O alvo do critério: o curso, a trilha. Nulo quando o critério não precisa.
  course_id uuid REFERENCES courses (id) ON DELETE CASCADE,
  track_id  uuid REFERENCES tracks (id) ON DELETE CASCADE,

  -- O número do critério: N cursos, N aulas, nota mínima.
  threshold numeric(6,2),

  -- Quanto tempo o badge vale, em meses. NULO É PARA SEMPRE.
  --
  -- Existe por causa de treinamento obrigatório: NR-10 vence, e um badge que
  -- não vence afirmaria que alguém está em dia quando não está. O guia §19 pede
  -- expiração, e a recertificação (§33) depende dela.
  validity_months integer CHECK (validity_months IS NULL OR validity_months > 0),

  active boolean NOT NULL DEFAULT true,

  created_by uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- O critério e o alvo precisam combinar. Sem isto, um badge de
  -- `course_completed` sem curso nunca seria emitido, e ninguém saberia por
  -- quê: ele apareceria na lista, correto, e simplesmente não aconteceria.
  CONSTRAINT badges_criterion_target CHECK (
    CASE criterion
      WHEN 'course_completed' THEN course_id IS NOT NULL
      WHEN 'track_completed'  THEN track_id  IS NOT NULL
      WHEN 'grade_above'      THEN course_id IS NOT NULL AND threshold IS NOT NULL
      WHEN 'courses_count'    THEN threshold IS NOT NULL AND threshold > 0
      WHEN 'lessons_count'    THEN threshold IS NOT NULL AND threshold > 0
      ELSE true
    END
  )
);

CREATE INDEX IF NOT EXISTS badges_tenant_idx ON badges (tenant_id);
CREATE INDEX IF NOT EXISTS badges_course_idx ON badges (course_id);

-- Nome único por cliente: dois badges "Segurança NR-10" no mesmo cliente são
-- indistinguíveis para quem os recebe e para quem os confere.
CREATE UNIQUE INDEX IF NOT EXISTS badges_tenant_name_key
    ON badges (tenant_id, lower(btrim(name)));


CREATE TABLE IF NOT EXISTS badge_awards (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  badge_id uuid NOT NULL REFERENCES badges (id) ON DELETE CASCADE,
  user_id  uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,

  -- O código que aparece na URL pública de verificação.
  --
  -- Aleatório, e não derivado do id: um código previsível deixaria alguém
  -- enumerar emissões e descobrir quem tem o quê. Mesma decisão da chave de
  -- API na 017 — mas aqui o valor FICA no banco, porque é ele que se procura.
  code text NOT NULL UNIQUE,

  awarded_at timestamptz NOT NULL DEFAULT now(),

  -- Calculado na emissão a partir de `validity_months`, e GRAVADO.
  --
  -- Não recalculado na leitura de propósito: mudar a validade do badge não pode
  -- alterar retroativamente a data de vencimento de quem já o recebeu — quem
  -- ganhou um badge de 12 meses ganhou 12 meses.
  expires_at timestamptz,

  -- Quem emitiu, quando é manual. Nulo quando foi o critério automático.
  awarded_by uuid REFERENCES users (id) ON DELETE SET NULL,

  -- Revogação: some do perfil e a verificação passa a dizer "revogado".
  --
  -- Não apaga. Quem verificar um badge revogado precisa saber que ele EXISTIU e
  -- foi revogado — apagar transformaria a revogação em "nunca existiu", e um
  -- código que some sem explicação parece falha da plataforma.
  revoked_at timestamptz,
  revoked_reason text,

  -- A mesma pessoa não ganha o mesmo badge duas vezes.
  --
  -- Parcial, sobre as não revogadas: depois de revogar, emitir de novo tem de
  -- ser possível — é como se corrige uma revogação feita por engano.
  CONSTRAINT badge_awards_no_duplicate EXCLUDE (badge_id WITH =, user_id WITH =)
    WHERE (revoked_at IS NULL)
);

CREATE INDEX IF NOT EXISTS badge_awards_user_idx ON badge_awards (user_id, awarded_at DESC);
CREATE INDEX IF NOT EXISTS badge_awards_badge_idx ON badge_awards (badge_id);

COMMIT;

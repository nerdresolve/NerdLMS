-- 017 — API pública, webhooks e SCORM.
--
-- Três coisas na mesma migration porque respondem à mesma pergunta: como o
-- produto conversa com o que está fora dele.
--
-- A CHAVE DE API NÃO É GUARDADA.
--
-- Só o hash. Uma chave que o banco conhece é uma chave que vaza com o banco —
-- e diferente de senha, ela não tem dono para trocá-la quando isso acontece.
-- Mesma regra do `password_hash` da 001.

BEGIN;

CREATE TABLE IF NOT EXISTS api_keys (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,

  name text NOT NULL CHECK (length(btrim(name)) > 0),

  -- SHA-256 da chave. O texto só existe uma vez, na tela de criação.
  key_hash text NOT NULL,

  -- Os quatro primeiros caracteres, para a pessoa reconhecer qual é qual na
  -- lista sem que isso ajude a adivinhar o resto.
  key_prefix text NOT NULL,

  -- O que esta chave pode fazer. Array e não booleanos: os escopos crescem, e
  -- uma coluna por escopo exigiria migration a cada um.
  scopes text[] NOT NULL DEFAULT '{}',

  created_by  uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,

  -- Revogar não apaga: o histórico de uso continua fazendo sentido, e apagar
  -- impediria auditar o que aquela chave fez.
  revoked_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS api_keys_hash_idx ON api_keys (key_hash);
CREATE INDEX IF NOT EXISTS api_keys_tenant_idx ON api_keys (tenant_id);
CREATE INDEX IF NOT EXISTS api_keys_created_by_idx ON api_keys (created_by);

-- ------------------------------------------------------------ webhooks
CREATE TABLE IF NOT EXISTS webhooks (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,

  url text NOT NULL CHECK (url ~ '^https://'),

  -- Quais eventos disparam. Vazio é "todos" — o caso comum de quem quer
  -- espelhar tudo num sistema próprio.
  events text[] NOT NULL DEFAULT '{}',

  -- Segredo da assinatura HMAC. Quem recebe confere que o corpo veio daqui;
  -- sem isso, qualquer um que descobrir a URL pode forjar eventos.
  secret text NOT NULL,

  active boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webhooks_tenant_idx ON webhooks (tenant_id);

-- As entregas, para depurar integração.
--
-- Sem isto, "o webhook não chegou" é indepurável: não se sabe se o produto
-- tentou, o que mandou, nem o que o outro lado respondeu.
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid NOT NULL REFERENCES webhooks (id) ON DELETE CASCADE,

  event   text NOT NULL,
  payload jsonb NOT NULL,

  status_code integer,
  error       text,
  attempts    integer NOT NULL DEFAULT 1 CHECK (attempts > 0),

  delivered_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webhook_deliveries_webhook_idx ON webhook_deliveries (webhook_id);
CREATE INDEX IF NOT EXISTS webhook_deliveries_pending_idx
  ON webhook_deliveries (created_at) WHERE delivered_at IS NULL;

-- --------------------------------------------------------------- SCORM
--
-- O guia §25 lista o que precisa ser rastreado: completion, success status,
-- score, session time, total time, suspend data, interactions, attempts.
--
-- Esses nomes vêm do modelo de dados do próprio SCORM (`cmi.*`), e é por isso
-- que as colunas os espelham em vez de reinterpretá-los: o runtime recebe
-- exatamente essas chaves do conteúdo e precisa devolvê-las intactas na
-- retomada. Traduzir para um vocabulário próprio criaria uma camada de
-- conversão que erra na primeira divergência.
CREATE TABLE IF NOT EXISTS scorm_packages (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES lessons (id) ON DELETE CASCADE,

  -- Onde o pacote descompactado vive no storage.
  storage_prefix text NOT NULL,

  -- O arquivo que abre o conteúdo, lido do `imsmanifest.xml`.
  entry_point text NOT NULL,

  version text NOT NULL DEFAULT '1.2' CHECK (version IN ('1.2', '2004')),

  title text,

  -- Nota de corte declarada pelo próprio pacote, quando há.
  mastery_score numeric(5,2),

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scorm_packages_tenant_idx ON scorm_packages (tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS scorm_packages_lesson_idx ON scorm_packages (lesson_id);

-- O estado de UMA pessoa num pacote.
CREATE TABLE IF NOT EXISTS scorm_tracking (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id    uuid NOT NULL REFERENCES scorm_packages (id) ON DELETE CASCADE,
  enrollment_id uuid NOT NULL REFERENCES enrollments (id) ON DELETE CASCADE,

  -- `cmi.core.lesson_status` no 1.2.
  lesson_status text NOT NULL DEFAULT 'not attempted',

  -- `cmi.core.score.raw`, `.min`, `.max`.
  score_raw numeric(8,2),
  score_min numeric(8,2),
  score_max numeric(8,2),

  -- `cmi.core.session_time` acumulado, em segundos.
  total_time_seconds integer NOT NULL DEFAULT 0 CHECK (total_time_seconds >= 0),

  -- `cmi.suspend_data`: o estado interno do conteúdo, opaco para nós.
  --
  -- É o que permite retomar de onde parou dentro de um SCORM de trinta telas.
  -- O padrão permite 4096 caracteres no 1.2; guardamos como texto sem limite
  -- porque cortar aqui corromperia a retomada silenciosamente.
  suspend_data text,

  -- `cmi.core.lesson_location`: onde o conteúdo diz que estava.
  lesson_location text,

  attempts integer NOT NULL DEFAULT 1 CHECK (attempts > 0),

  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (package_id, enrollment_id)
);

CREATE INDEX IF NOT EXISTS scorm_tracking_enrollment_idx ON scorm_tracking (enrollment_id);
CREATE INDEX IF NOT EXISTS scorm_tracking_package_idx ON scorm_tracking (package_id);

-- As interações que o conteúdo registra (`cmi.interactions.n.*`).
--
-- Tabela à parte porque são N por tentativa e o número não se conhece de
-- antemão: um SCORM pode registrar duas ou duzentas.
CREATE TABLE IF NOT EXISTS scorm_interactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_id uuid NOT NULL REFERENCES scorm_tracking (id) ON DELETE CASCADE,

  interaction_id text NOT NULL,
  type           text,
  student_response text,
  result         text,
  weighting      numeric(8,2),
  latency        text,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scorm_interactions_tracking_idx ON scorm_interactions (tracking_id);

COMMIT;

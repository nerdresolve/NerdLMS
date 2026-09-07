-- 016 — Notificações por evento, preferências e templates.
--
-- O guia §15 pede notificação in-app E por e-mail, disparada por evento, com
-- preferências individuais e administrativas, e templates com variáveis.
--
-- Hoje `notifications` existe mas só o seed escreve nela: nenhum evento real do
-- produto gera aviso. Matricular alguém, publicar uma nota, emitir um
-- certificado — nada disso avisa ninguém.
--
-- A DECISÃO: o tipo de evento é uma lista fechada no CHECK.
--
-- Uma tabela de tipos convidaria a inventar um evento que nenhum código dispara
-- e nenhum template renderiza. A lista muda com o produto, não com o cliente —
-- o que o cliente escolhe é RECEBER ou não, e isso são as preferências.

BEGIN;

-- Os eventos que o guia lista, mais os que o produto já tem como disparar.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check CHECK (kind IN (
  -- os três que já existiam, do seed
  'announcement',
  'reminder',
  'achievement',
  -- os eventos do guia §15
  'enrollment',        -- matriculado num curso
  'course_available',  -- curso liberado (pré-requisito cumprido)
  'lesson_available',  -- aula liberada
  'deadline_near',     -- prazo próximo
  'assessment_open',   -- avaliação disponível
  'grade_posted',      -- nota publicada
  'course_completed',
  'certificate_issued',
  'forum_reply',       -- resposta no tópico que acompanha
  'forum_mention'      -- mencionado numa mensagem
));

-- De onde veio a notificação, para a tela poder levar de volta ao lugar.
-- Sem isto o aviso "sua nota saiu" não tem para onde clicar.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link text;

-- Já foi enviada por e-mail? Nulo quando não se aplica (preferência desligada).
-- Evita reenviar no reprocessamento e permite auditar o que saiu.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS emailed_at timestamptz;

-- ------------------------------------------------------- preferências
--
-- Guarda só o que a pessoa MUDOU, como `tenant_features`: o padrão vive no
-- código, e uma linha por pessoa por evento seria a maior tabela do banco
-- guardando, quase toda ela, o valor padrão.
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind    text NOT NULL,

  -- Os dois canais são independentes: receber in-app e não por e-mail é a
  -- escolha mais comum de quem já vive no sistema.
  in_app  boolean NOT NULL DEFAULT true,
  email   boolean NOT NULL DEFAULT true,

  updated_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (user_id, kind)
);

CREATE INDEX IF NOT EXISTS notification_preferences_user_idx ON notification_preferences (user_id);

-- --------------------------------------------- templates por tenant
--
-- F4-05. O guia §2 pede "templates de e-mail por tenant" junto do branding: o
-- e-mail é a parte do produto que chega fora dele, e mandar uma mensagem com a
-- voz errada é pior que não mandar.
--
-- Sem linha aqui, vale o texto padrão do código — mesma regra das features.
CREATE TABLE IF NOT EXISTS email_templates (
  tenant_id uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  kind      text NOT NULL,

  subject text NOT NULL CHECK (length(btrim(subject)) > 0),
  -- Corpo em texto, com variáveis {{nome}}, {{curso}}. Não é HTML: o HTML do
  -- e-mail é montado pelo produto, com a marca do cliente, e deixar o cliente
  -- escrever HTML abriria a porta para e-mail quebrado em metade dos leitores.
  body    text NOT NULL CHECK (length(btrim(body)) > 0),

  updated_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (tenant_id, kind)
);

CREATE INDEX IF NOT EXISTS email_templates_tenant_idx ON email_templates (tenant_id);

COMMIT;

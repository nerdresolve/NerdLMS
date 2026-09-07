-- 015 — Fórum do curso.
--
-- O guia §16 pede fórum com tópicos, respostas, menções, anexos, moderação,
-- fixar, fechar, denunciar, assinatura, notificações, busca e histórico.
--
-- POR QUE NÃO REAPROVEITAR `comments`.
--
-- Os comentários de aula já existem e têm respostas aninhadas — a tentação é
-- usá-los como fórum. Mas são coisas diferentes em três pontos que importam:
--
--   1. comentário pertence a uma AULA; tópico pertence ao CURSO. Um fórum
--      preso à aula obrigaria a escolher uma aula para perguntar sobre a prova;
--   2. tópico tem TÍTULO, e é por ele que a busca funciona. Comentário não tem;
--   3. tópico se fixa e se fecha. Um comentário fixado no meio de uma aula não
--      significa nada.
--
-- Forçar uma tabela a ser as duas coisas deixaria metade das colunas nulas em
-- metade das linhas, e toda consulta precisaria saber de qual metade falava.

BEGIN;

CREATE TABLE IF NOT EXISTS forum_topics (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses (id) ON DELETE CASCADE,

  author_id uuid REFERENCES users (id) ON DELETE SET NULL,

  title text NOT NULL CHECK (length(btrim(title)) > 0),
  body  text NOT NULL CHECK (length(btrim(body)) > 0),

  -- Fixar sobe o tópico para o topo da lista. É como o instrutor destaca o
  -- aviso que todo mundo precisa ler antes de perguntar.
  pinned boolean NOT NULL DEFAULT false,

  -- Fechado aceita leitura, recusa resposta. Diferente de apagar: a conversa
  -- continua servindo a quem chega depois com a mesma dúvida.
  closed boolean NOT NULL DEFAULT false,

  created_at timestamptz NOT NULL DEFAULT now(),
  -- Última atividade: é por ela que a lista ordena, não por criação. Um tópico
  -- de março com resposta hoje é mais relevante que um de ontem sem nenhuma.
  last_activity_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS forum_topics_tenant_idx ON forum_topics (tenant_id);
CREATE INDEX IF NOT EXISTS forum_topics_course_idx ON forum_topics (course_id);
CREATE INDEX IF NOT EXISTS forum_topics_author_idx ON forum_topics (author_id);

-- A lista do fórum ordena por fixado e depois por atividade.
CREATE INDEX IF NOT EXISTS forum_topics_order_idx
  ON forum_topics (course_id, pinned DESC, last_activity_at DESC);

-- ------------------------------------------------------------- respostas
CREATE TABLE IF NOT EXISTS forum_posts (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES forum_topics (id) ON DELETE CASCADE,

  author_id uuid REFERENCES users (id) ON DELETE SET NULL,
  body      text NOT NULL CHECK (length(btrim(body)) > 0),

  -- Resposta a outra resposta. A profundidade não é limitada no banco; a tela
  -- achata em dois níveis, que é o que se lê sem rolar para o lado.
  parent_id uuid REFERENCES forum_posts (id) ON DELETE CASCADE,

  -- Moderação: some da lista sem sumir do banco. Apagar impediria auditar por
  -- que uma mensagem saiu, e o guia pede histórico.
  hidden_at  timestamptz,
  hidden_by  uuid REFERENCES users (id) ON DELETE SET NULL,
  hidden_reason text,

  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at  timestamptz
);

CREATE INDEX IF NOT EXISTS forum_posts_topic_idx ON forum_posts (topic_id);
CREATE INDEX IF NOT EXISTS forum_posts_author_idx ON forum_posts (author_id);
CREATE INDEX IF NOT EXISTS forum_posts_parent_idx ON forum_posts (parent_id);
CREATE INDEX IF NOT EXISTS forum_posts_hidden_by_idx ON forum_posts (hidden_by);

-- As três colunas de moderação andam juntas: ou a mensagem está oculta e
-- sabe-se por quem e por quê, ou não está. Meio preenchido seria dado
-- corrompido — mesma regra de `completed_at` na 006.
ALTER TABLE forum_posts DROP CONSTRAINT IF EXISTS forum_posts_hidden_coherent;
ALTER TABLE forum_posts ADD CONSTRAINT forum_posts_hidden_coherent CHECK (
  (hidden_at IS NULL AND hidden_by IS NULL)
  OR (hidden_at IS NOT NULL AND hidden_by IS NOT NULL)
);

-- ------------------------------------------------------------ denúncias
--
-- O guia pede "denunciar". Uma tabela e não um contador: quem denunciou e por
-- quê é o que o moderador precisa para decidir, e um número sozinho não diz
-- nada.
CREATE TABLE IF NOT EXISTS forum_reports (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid NOT NULL REFERENCES forum_posts (id) ON DELETE CASCADE,
  reporter_id uuid REFERENCES users (id) ON DELETE SET NULL,
  reason     text NOT NULL CHECK (length(btrim(reason)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Uma denúncia por pessoa por mensagem: denunciar dez vezes não torna a
  -- mensagem dez vezes pior, e inflaria a fila do moderador.
  UNIQUE (post_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS forum_reports_post_idx ON forum_reports (post_id);
CREATE INDEX IF NOT EXISTS forum_reports_reporter_idx ON forum_reports (reporter_id);

-- --------------------------------------------------------- assinatura
--
-- Quem acompanha o tópico recebe aviso de resposta nova (F4-02).
CREATE TABLE IF NOT EXISTS forum_subscriptions (
  topic_id uuid NOT NULL REFERENCES forum_topics (id) ON DELETE CASCADE,
  user_id  uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (topic_id, user_id)
);

CREATE INDEX IF NOT EXISTS forum_subscriptions_user_idx ON forum_subscriptions (user_id);

-- ------------------------------------------------------- anexos do fórum
CREATE TABLE IF NOT EXISTS forum_attachments (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id  uuid REFERENCES forum_posts (id) ON DELETE CASCADE,
  topic_id uuid REFERENCES forum_topics (id) ON DELETE CASCADE,

  name        text NOT NULL,
  size_bytes  bigint NOT NULL,
  storage_key text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- O anexo pende do tópico OU de uma resposta, nunca dos dois.
ALTER TABLE forum_attachments DROP CONSTRAINT IF EXISTS forum_attachments_one_target;
ALTER TABLE forum_attachments ADD CONSTRAINT forum_attachments_one_target CHECK (
  (post_id IS NOT NULL)::int + (topic_id IS NOT NULL)::int = 1
);

CREATE INDEX IF NOT EXISTS forum_attachments_post_idx ON forum_attachments (post_id);
CREATE INDEX IF NOT EXISTS forum_attachments_topic_idx ON forum_attachments (topic_id);

COMMIT;

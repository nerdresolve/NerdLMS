-- 023 — LTI 1.3 e LTI Advantage (F6-04, guia §27).
--
-- O que o LTI resolve: uma ferramenta de fora — um simulador, um laboratório
-- virtual, um banco de exercícios — abre DENTRO do curso, já sabendo quem é o
-- aluno e em que contexto ele está, sem pedir login de novo. E devolve a nota.
--
-- Este produto é a PLATAFORMA (Tool Platform), não a ferramenta: outros
-- sistemas se registram aqui e são lançados a partir dos nossos cursos.
--
-- A CHAVE PRIVADA FICA NO BANCO.
--
-- Foi decisão do usuário, e é o padrão de mercado para LMS — o Moodle faz
-- assim. A implicação está escrita para quem operar: quem acessa o banco
-- consegue assinar tokens em nome desta plataforma. As mitigações que dependem
-- do schema estão aqui: a chave é POR CLIENTE (o vazamento de uma não
-- compromete as outras) e ROTACIONÁVEL sem perder o histórico (`active`).
--
-- Ao contrário do Open Badges, aqui a assinatura NÃO é opcional: o LTI 1.3 é
-- OIDC + JWT, e sem par de chaves não há launch. Era assinar ou não ter LTI.

BEGIN;

-- ---------------------------------------------------------------------------
-- O par de chaves desta plataforma, por cliente.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lti_keys (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,

  -- O `kid` que vai no cabeçalho do JWT e no JWKS público.
  --
  -- É ele que diz à ferramenta QUAL chave usar para conferir a assinatura — e
  -- é o que torna a rotação possível: as duas chaves ficam no JWKS, e o token
  -- antigo continua verificável enquanto a nova já assina.
  kid text NOT NULL UNIQUE,

  -- PKCS#8, PEM. Fica no banco por decisão registrada acima.
  private_key text NOT NULL,
  -- SPKI, PEM. Esta é pública por definição — vai no JWKS.
  public_key  text NOT NULL,

  -- Só uma ativa por cliente assina; as demais só verificam.
  active boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  retired_at timestamptz
);

CREATE INDEX IF NOT EXISTS lti_keys_tenant_idx ON lti_keys (tenant_id, active);

-- Uma chave ATIVA por cliente. Duas assinando ao mesmo tempo tornaria
-- indeterminado qual assinou o quê.
CREATE UNIQUE INDEX IF NOT EXISTS lti_keys_one_active
    ON lti_keys (tenant_id) WHERE active;


-- ---------------------------------------------------------------------------
-- As ferramentas registradas: quem pode ser lançado a partir daqui.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lti_tools (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,

  name        text NOT NULL CHECK (length(btrim(name)) > 0),
  description text,

  -- O que a ferramenta declara sobre si (o "tool configuration" do padrão).
  --
  -- `client_id` é o identificador que ESTA plataforma dá a ela. `issuer` é o
  -- que a ferramenta espera ver no `iss` do token — normalmente a nossa URL.
  client_id text NOT NULL,

  -- Onde a ferramenta recebe o launch.
  target_link_uri text NOT NULL CHECK (target_link_uri ~ '^https://'),

  -- Onde ela recebe o redirecionamento do OIDC. Array porque o padrão permite
  -- mais de uma, e uma ferramenta com ambientes distintos usa isso.
  redirect_uris text[] NOT NULL DEFAULT '{}',

  -- O endereço de login OIDC da ferramenta: é para lá que mandamos a
  -- iniciação do launch.
  oidc_login_uri text NOT NULL CHECK (oidc_login_uri ~ '^https://'),

  -- Onde buscar as chaves PÚBLICAS da ferramenta, para conferir o que ela
  -- assina (Deep Linking responde assinado).
  jwks_uri text CHECK (jwks_uri IS NULL OR jwks_uri ~ '^https://'),

  -- Os serviços do LTI Advantage que esta ferramenta usa.
  --
  -- Booleanos e não array: são exatamente três, definidos pelo padrão, e não
  -- crescem com o produto. Um array convidaria a inventar um quarto.
  allow_grades   boolean NOT NULL DEFAULT false,  -- AGS
  allow_roster   boolean NOT NULL DEFAULT false,  -- NRPS
  allow_deeplink boolean NOT NULL DEFAULT false,  -- Deep Linking

  active boolean NOT NULL DEFAULT true,

  created_by uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lti_tools_tenant_idx ON lti_tools (tenant_id, active);

CREATE UNIQUE INDEX IF NOT EXISTS lti_tools_client_id_key
    ON lti_tools (tenant_id, client_id);

CREATE UNIQUE INDEX IF NOT EXISTS lti_tools_tenant_name_key
    ON lti_tools (tenant_id, lower(btrim(name)));


-- ---------------------------------------------------------------------------
-- Onde a ferramenta foi colocada: um link dentro de um curso.
--
-- É o que o padrão chama de "resource link". A mesma ferramenta pode aparecer
-- em vários cursos, e cada aparição é um recurso distinto do ponto de vista da
-- nota — "o laboratório virtual do módulo 2" não é "o do módulo 5".
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lti_links (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id uuid NOT NULL REFERENCES lti_tools (id) ON DELETE CASCADE,

  course_id uuid NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES lessons (id) ON DELETE CASCADE,

  title text NOT NULL CHECK (length(btrim(title)) > 0),

  -- URL específica deste link, quando o Deep Linking escolheu um conteúdo
  -- dentro da ferramenta. Nulo usa a `target_link_uri` da ferramenta.
  target_link_uri text,

  -- Vale nota? Quando sim, a ferramenta pode lançar via AGS.
  graded          boolean NOT NULL DEFAULT false,
  points_possible numeric(8,2) CHECK (points_possible IS NULL OR points_possible > 0),

  created_at timestamptz NOT NULL DEFAULT now(),

  -- Link que vale nota precisa dizer quanto vale: sem isso, a nota que a
  -- ferramenta lançar não teria denominador.
  CONSTRAINT lti_links_graded_needs_points CHECK (
    NOT graded OR points_possible IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS lti_links_tool_idx   ON lti_links (tool_id);
CREATE INDEX IF NOT EXISTS lti_links_course_idx ON lti_links (course_id);


-- ---------------------------------------------------------------------------
-- O nonce do OIDC: usado UMA vez, e descartado.
--
-- É o que impede replay do launch — sem ele, alguém que capturasse uma
-- requisição de launch poderia reapresentá-la e entrar como a pessoa.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lti_nonces (
  nonce      text PRIMARY KEY,
  tenant_id  uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  -- O `state` que amarra a resposta do OIDC ao pedido que a originou.
  state      text NOT NULL,
  link_id    uuid REFERENCES lti_links (id) ON DELETE CASCADE,
  user_id    uuid REFERENCES users (id) ON DELETE CASCADE,

  created_at timestamptz NOT NULL DEFAULT now(),
  -- Curto de propósito: um launch leva segundos, não minutos.
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  used_at    timestamptz
);

CREATE INDEX IF NOT EXISTS lti_nonces_expiry_idx ON lti_nonces (expires_at);


COMMIT;

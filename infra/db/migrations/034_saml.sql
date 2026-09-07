-- 034 — SSO por SAML 2.0 (guia §32).
--
-- O §32 diz que "para white-label corporativo, SAML/OIDC é quase
-- indispensável". O OIDC cobre Google e Microsoft; o SAML cobre o resto do
-- mundo corporativo — ADFS, Okta, OneLogin, Shibboleth — e é o que uma
-- universidade ou um órgão público pede por padrão.
--
-- O QUE MUDA EM RELAÇÃO AO OIDC
--
-- Não há chave secreta compartilhada. A confiança vem de um CERTIFICADO: o
-- provedor assina a asserção com a chave privada dele, e nós conferimos com o
-- certificado que o cliente cadastrou aqui. Isso inverte a direção do segredo
-- — não guardamos nada que possa vazar e permitir a alguém se passar por nós.
--
-- POR QUE OS CERTIFICADOS SÃO UMA LISTA
--
-- Rotação. Quando o provedor troca de chave, há uma janela em que ele já assina
-- com a nova e o cliente ainda não cadastrou. Com uma coluna só, essa janela é
-- indisponibilidade; com uma lista, é transparente — as duas valem enquanto a
-- troca acontece.

BEGIN;

CREATE TABLE IF NOT EXISTS saml_providers (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,

  display_name text NOT NULL,

  -- O `entityId` do provedor: como ele se identifica na asserção.
  idp_entity_id text NOT NULL,
  -- Para onde mandamos a pessoa autenticar.
  sso_url text NOT NULL,

  -- Os certificados que validam a assinatura, em PEM.
  --
  -- Array, e não coluna: ver o comentário sobre rotação acima. Vazio significa
  -- que NADA é aceito — uma lista vazia não pode virar "aceite qualquer
  -- coisa", que é o defeito mais perigoso que este produto poderia ter.
  certificates text[] NOT NULL DEFAULT '{}',

  -- Como NÓS nos identificamos para o provedor. O cliente cadastra este valor
  -- lá do outro lado, e ele volta na asserção como `Audience`.
  sp_entity_id text NOT NULL,

  allowed_domains text NOT NULL DEFAULT '',
  allow_jit boolean NOT NULL DEFAULT false,
  jit_role text NOT NULL DEFAULT 'learner'
    CHECK (jit_role IN ('admin', 'manager', 'instructor', 'learner')),

  enabled boolean NOT NULL DEFAULT false,
  allow_password_login boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Ligado sem certificado seria um botão que sempre falha na validação.
  -- Melhor recusar na configuração do que na cara de quem for entrar.
  CONSTRAINT saml_ligado_tem_certificado CHECK (
    enabled = false OR cardinality(certificates) > 0
  )
);

-- Um provedor SAML por cliente: dois botões iguais confundiriam quem entra.
-- O índice único já atende a busca por `tenant_id`; escrito em uma linha para
-- que a verificação estrutural o reconheça como o índice da chave estrangeira.
CREATE UNIQUE INDEX IF NOT EXISTS saml_providers_tenant_idx ON saml_providers (tenant_id);

-- ---------------------------------------------------------------------------
-- O pedido em andamento.
-- ---------------------------------------------------------------------------
--
-- Guarda o `ID` que mandamos, para conferir o `InResponseTo` que volta. Sem
-- isso, alguém entregaria ao navegador de outra pessoa uma asserção legítima
-- obtida em outro lugar — e ela entraria como se fosse dela.
CREATE TABLE IF NOT EXISTS saml_requests (
  id          text PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES saml_providers (id) ON DELETE CASCADE,

  -- Só o caminho, nunca a URL inteira: guardar URL completa e redirecionar
  -- para ela abriria um redirecionamento aberto.
  redirect_path text NOT NULL DEFAULT '/',

  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  consumed_at timestamptz
);

CREATE INDEX IF NOT EXISTS saml_requests_tenant_idx ON saml_requests (tenant_id);
CREATE INDEX IF NOT EXISTS saml_requests_provider_idx ON saml_requests (provider_id);
CREATE INDEX IF NOT EXISTS saml_requests_expires_idx ON saml_requests (expires_at);

COMMIT;

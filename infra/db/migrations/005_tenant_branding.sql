-- =============================================================================
-- Identidade visual por cliente — F0-11
--
-- Um white-label sem branding é software com o nome de outra empresa na tela.
-- Cada cliente precisa da própria marca: logo, cor, favicon, remetente.
--
-- As colunas ficam em `tenants` e não em tabela separada: são poucos campos,
-- um por cliente, sempre lidos juntos com o resto do tenant. Uma tabela à
-- parte custaria um JOIN em toda requisição para não guardar nada além do que
-- cabe aqui.
--
-- Tudo é NULO por padrão, e nulo significa "usa o padrão do produto". Assim a
-- NerdResolve continua com a identidade atual sem precisar cadastrar nada, e um
-- cliente novo customiza só o que quiser.
-- =============================================================================

BEGIN;

ALTER TABLE tenants
  -- Logo clara e escura: a barra lateral é azul-escura e a do topo é clara.
  -- Uma logo só não serve aos dois fundos sem perder contraste.
  ADD COLUMN IF NOT EXISTS logo_light_url text,
  ADD COLUMN IF NOT EXISTS logo_dark_url  text,
  ADD COLUMN IF NOT EXISTS favicon_url    text,

  -- A cor de marca. As demais (hover, ativo, gradiente) são DERIVADAS dela no
  -- domínio: pedir seis cores ao cliente convida a combinações que reprovam em
  -- contraste, e a régua WCAG AA é do produto, não opcional por cliente.
  ADD COLUMN IF NOT EXISTS brand_color text
    CHECK (brand_color IS NULL OR brand_color ~ '^#[0-9a-fA-F]{6}$'),

  -- Remetente dos e-mails. Sem isto, o convite de um cliente chega assinado
  -- pelo nome de outro.
  ADD COLUMN IF NOT EXISTS mail_from_name  text,
  ADD COLUMN IF NOT EXISTS mail_from_email text
    CHECK (mail_from_email IS NULL OR mail_from_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');

COMMIT;

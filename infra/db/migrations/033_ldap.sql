-- 033 — Acesso por diretório LDAP / Active Directory (guia §32).
--
-- O §32 lista LDAP e Active Directory ao lado de OIDC e SAML. É o mais antigo
-- dos quatro e continua sendo o que empresa com infraestrutura própria pede
-- primeiro: o diretório já existe, já tem todo mundo, e já é onde o
-- desligamento acontece.
--
-- POR QUE UMA TABELA SEPARADA DE `sso_providers`
--
-- LDAP não é OAuth. Não há `client_id`, `client_secret`, `redirect_uri` nem
-- token: há um servidor, uma porta e um molde de DN. Espremer os dois na mesma
-- tabela deixaria metade das colunas nulas de cada lado, e a leitura teria de
-- adivinhar quais valem — que é como nascem os defeitos silenciosos.
--
-- O QUE NÃO ESTÁ AQUI
--
-- Credencial de serviço para BUSCAR dados no diretório. Este produto só
-- pergunta "esta senha está certa?", e a resposta não exige conta de serviço.
-- Guardar uma credencial que abre o diretório inteiro para não usá-la seria
-- criar risco sem contrapartida.

BEGIN;

CREATE TABLE IF NOT EXISTS ldap_directories (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,

  -- `ad`, `openldap` ou `generico`. Decide o molde do DN.
  kind text NOT NULL CHECK (kind IN ('ad', 'openldap', 'generico')),

  -- O que aparece no botão: "Entrar com a conta da rede".
  display_name text NOT NULL,

  host text NOT NULL,
  -- 636 é a porta com TLS. A 389 é em claro, e o produto não a oferece: o
  -- bind simples manda a senha do diretório corporativo em texto.
  port integer NOT NULL DEFAULT 636 CHECK (port > 0 AND port <= 65535),

  -- O domínio (Active Directory) ou a base (OpenLDAP). Um dos dois, conforme
  -- o tipo — e o CHECK abaixo garante que o certo esteja preenchido.
  domain text,
  base_dn text,

  -- Molde próprio, só para o genérico. Nulo nos outros, que usam o do catálogo.
  dn_template text,

  -- Aceitar certificado emitido pela própria empresa.
  --
  -- Diretório corporativo raramente usa certificado de autoridade pública, e
  -- recusá-lo impediria o SSO em boa parte dos clientes. O padrão é VALIDAR:
  -- quem precisa desligar faz a escolha, e ela fica registrada aqui.
  allow_self_signed boolean NOT NULL DEFAULT false,

  allowed_domains text NOT NULL DEFAULT '',
  allow_jit boolean NOT NULL DEFAULT false,
  jit_role text NOT NULL DEFAULT 'learner'
    CHECK (jit_role IN ('admin', 'manager', 'instructor', 'learner')),

  enabled boolean NOT NULL DEFAULT false,
  allow_password_login boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Cada tipo exige o seu campo, e o CHECK recusa a configuração pela metade
  -- na ESCRITA em vez de no login de alguém.
  CONSTRAINT ldap_config_completa CHECK (
    (kind = 'ad' AND domain IS NOT NULL AND btrim(domain) <> '')
    OR (kind = 'openldap' AND base_dn IS NOT NULL AND btrim(base_dn) <> '')
    OR (kind = 'generico' AND dn_template IS NOT NULL AND dn_template LIKE '%{user}%')
  )
);

-- Um diretório de cada tipo por cliente: dois "Active Directory" seriam dois
-- botões iguais, e ninguém saberia qual usar.
CREATE UNIQUE INDEX IF NOT EXISTS ldap_directories_tenant_kind_idx
  ON ldap_directories (tenant_id, kind);

CREATE INDEX IF NOT EXISTS ldap_directories_tenant_idx ON ldap_directories (tenant_id);

COMMIT;

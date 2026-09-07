-- 026 — SSO com OpenID Connect (F5-04, guia §32).
--
-- O §32 diz que "para white-label corporativo, SAML/OIDC é quase
-- indispensável". Empresa de porte não quer mais uma senha para gerenciar: quer
-- que o desligamento no diretório dela feche o acesso aqui, no mesmo dia.
--
-- O QUE FICA PRONTO E O QUE O CLIENTE PREENCHE
--
-- Os endereços do Google e da Microsoft são públicos, estáveis e iguais para
-- todo mundo — vivem no código (`packages/core/src/sso/providers.ts`), não
-- aqui. Nesta tabela fica só o que muda por cliente: as credenciais e as
-- escolhas. Quem implanta escolhe o provedor e cola dois valores.
--
-- A CHAVE SECRETA FICA NO BANCO
--
-- Mesma decisão já registrada na 023 para o LTI, e pela mesma razão: é onde o
-- Moodle e o Keycloak guardam. A implicação, escrita para quem operar: quem lê
-- o banco consegue se passar por esta plataforma diante do provedor. As
-- mitigações que dependem do schema estão aqui — a credencial é POR CLIENTE, e
-- a coluna é uma só, fácil de rotacionar e de excluir do backup.

BEGIN;

-- ---------------------------------------------------------------------------
-- O provedor de identidade de cada cliente.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sso_providers (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,

  -- `google`, `microsoft` ou `generico`. Decide de onde vêm os endereços.
  provider text NOT NULL CHECK (provider IN ('google', 'microsoft', 'generico')),

  -- O que aparece no botão: "Entrar com a conta ACME".
  --
  -- Personalizável porque "Entrar com a Microsoft" não diz nada a quem só
  -- conhece o sistema pelo nome interno da empresa.
  display_name text NOT NULL,

  client_id     text NOT NULL,
  client_secret text NOT NULL,

  -- O diretório do Entra. Obrigatório para a Microsoft, ignorado no resto.
  provider_tenant_id text,

  -- Endereços do provedor genérico. Nulos para Google e Microsoft, que os
  -- trazem do catálogo — guardar uma cópia criaria duas verdades e um dia
  -- elas discordariam.
  authorization_url text,
  token_url         text,
  jwks_url          text,
  issuer            text,

  -- Domínios aceitos, separados por vírgula e sem arroba.
  --
  -- Vazio aceita qualquer um. Preenchido, é o que impede uma conta pessoal do
  -- Gmail de entrar num ambiente corporativo que usa o Google como provedor.
  allowed_domains text NOT NULL DEFAULT '',

  -- O SSO pode criar conta para quem nunca entrou.
  --
  -- Desligado por padrão, e de propósito: ligado, qualquer pessoa do diretório
  -- da empresa vira usuário na primeira visita. Boa parte dos clientes quer
  -- isso; nenhum quer descobrir depois que aconteceu sem ter pedido.
  allow_jit boolean NOT NULL DEFAULT false,
  -- Os mesmos papéis que `users.role` aceita. Repetir a lista num CHECK segue o
  -- que o schema já faz: não existe tabela de papéis, e inventar uma aqui
  -- criaria duas fontes para a mesma pergunta.
  jit_role  text NOT NULL DEFAULT 'learner'
    CHECK (jit_role IN ('admin', 'manager', 'instructor', 'learner')),

  -- Desligar sem apagar: some o botão, o histórico de quem entrou fica.
  enabled boolean NOT NULL DEFAULT false,

  -- Senha local ainda funciona quando há SSO.
  --
  -- Existe porque desligar a senha e errar a configuração do provedor tranca
  -- todo mundo do lado de fora, inclusive o administrador. Quem quiser exigir
  -- só SSO desliga aqui — depois de testar.
  allow_password_login boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Um provedor de cada tipo por cliente. Dois "Google" no mesmo cliente seriam
-- dois botões iguais, e ninguém saberia qual usar.
CREATE UNIQUE INDEX IF NOT EXISTS sso_providers_tenant_provider_idx
  ON sso_providers (tenant_id, provider);
-- O índice acima já atende a busca por `tenant_id` sozinho: o Postgres usa o
-- prefixo de um índice composto. Este existe para a exclusão de um cliente, que
-- procura pela chave estrangeira e sem índice varreria a tabela.
CREATE INDEX IF NOT EXISTS sso_providers_tenant_idx ON sso_providers (tenant_id);

-- ---------------------------------------------------------------------------
-- O vínculo entre uma pessoa daqui e a identidade dela no provedor.
-- ---------------------------------------------------------------------------
--
-- O vínculo é por `subject`, não por e-mail. E-mail muda: quem casa e troca de
-- sobrenome recebe outro endereço e continua a mesma pessoa. Pior, um endereço
-- desligado pode ser reatribuído a outro funcionário — e aí seguir o e-mail
-- entregaria a conta antiga ao novo dono do endereço.
CREATE TABLE IF NOT EXISTS sso_identities (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,

  provider text NOT NULL,
  -- O `sub` do id_token. O provedor promete não reaproveitar.
  subject  text NOT NULL,

  -- O e-mail no dia do vínculo, para auditoria.
  --
  -- Não é usado para autenticar: serve para responder "com que endereço esta
  -- conta foi vinculada", quando o endereço de hoje é outro.
  email_at_link text NOT NULL,

  created_at    timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

-- O mesmo `sub` não pode apontar para duas contas do mesmo cliente: seria uma
-- pessoa com dois acessos, e o login escolheria um ao acaso.
CREATE UNIQUE INDEX IF NOT EXISTS sso_identities_provider_subject_idx
  ON sso_identities (tenant_id, provider, subject);

-- Uma conta tem no máximo um vínculo por provedor.
CREATE UNIQUE INDEX IF NOT EXISTS sso_identities_user_provider_idx
  ON sso_identities (user_id, provider);

-- Pelas chaves estrangeiras: excluir um cliente ou uma pessoa procura por
-- estas colunas, e sem índice a busca varre a tabela inteira.
CREATE INDEX IF NOT EXISTS sso_identities_tenant_idx ON sso_identities (tenant_id);
CREATE INDEX IF NOT EXISTS sso_identities_user_idx ON sso_identities (user_id);

-- ---------------------------------------------------------------------------
-- O estado de um login em andamento.
-- ---------------------------------------------------------------------------
--
-- Guarda `state` e `nonce` entre a ida ao provedor e a volta. Podia viver num
-- cookie assinado; fica no banco porque o retorno do provedor é uma navegação
-- de terceiro site, e cookie `SameSite=Lax` nem sempre acompanha — o login
-- falharia em alguns navegadores e não em outros, que é o pior tipo de defeito
-- para diagnosticar.
CREATE TABLE IF NOT EXISTS sso_login_states (
  state      text PRIMARY KEY,
  tenant_id  uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES sso_providers (id) ON DELETE CASCADE,

  nonce text NOT NULL,

  -- Para onde levar depois do login, dentro do site.
  --
  -- Só o caminho, nunca a URL inteira: guardar URL completa e redirecionar
  -- para ela abriria um redirecionamento aberto, com o nosso domínio dando
  -- credibilidade ao destino de outra pessoa.
  redirect_path text NOT NULL DEFAULT '/',

  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,

  -- Marcado ao ser usado. Um `state` serve uma vez.
  consumed_at timestamptz
);

CREATE INDEX IF NOT EXISTS sso_login_states_expires_idx
  ON sso_login_states (expires_at);

-- Idem: desligar um provedor ou excluir um cliente apaga os estados abertos,
-- e a busca é por estas colunas.
CREATE INDEX IF NOT EXISTS sso_login_states_tenant_idx ON sso_login_states (tenant_id);
CREATE INDEX IF NOT EXISTS sso_login_states_provider_idx ON sso_login_states (provider_id);

COMMIT;

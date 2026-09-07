-- =============================================================================
-- Funcionalidades por cliente — F0-08
--
-- A plataforma é white-label: nem toda empresa quer tudo. Uma pode não querer
-- comentários; outra quer comentários mas não o marcador de "útil".
--
-- A tabela guarda só o que o cliente MEXEU, não o estado completo. Quem não
-- tem linha usa o padrão do catálogo (`packages/core/src/tenancy/features.ts`),
-- e é isso que permite acrescentar funcionalidade nova sem escrever uma linha
-- para cada tenant existente.
--
-- A chave é hierárquica e a herança é resolvida no domínio, não aqui: `SQL`
-- não é lugar para "pai desligado desliga o filho" — a regra tem exceções que
-- ficam ilegíveis em consulta e são triviais em código testado.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS tenant_features (
  tenant_id  uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  -- A chave do catálogo: `comentarios`, `comentarios.upvotes`.
  --
  -- Sem FK para lugar nenhum de propósito: o catálogo vive em código, não em
  -- tabela. Uma tabela de catálogo exigiria migração a cada funcionalidade
  -- nova e abriria espaço para o banco e o código discordarem sobre o que
  -- existe.
  feature    text NOT NULL CHECK (feature ~ '^[a-z]+(\.[a-z]+)*$'),
  enabled    boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, feature)
);

-- A consulta é sempre "todas as escolhas deste cliente": a tela de
-- administração e o contexto das páginas carregam o conjunto de uma vez.
CREATE INDEX IF NOT EXISTS tenant_features_tenant_idx ON tenant_features (tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_features TO lms_app;

COMMIT;

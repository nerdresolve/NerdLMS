-- =============================================================================
-- Multi-tenant — F0-01
--
-- A plataforma passa a servir mais de uma empresa. O isolamento não é um campo
-- decorativo: ele precisa existir no domínio, na autorização, nas consultas e
-- em tudo que vier depois. Esta migração é a parte estrutural.
--
-- DUAS DIMENSÕES, e a distinção importa:
--
--   tenant     a empresa cliente. NerdResolve hoje; outra amanhã. Nada atravessa
--              esta fronteira.
--   org_unit   a unidade DENTRO da empresa. Para a NerdResolve são as
--              concessionárias — Águas do Rio, Prolagos, Regenera Rio. Elas
--              NÃO são clientes diferentes: a Holding precisa enxergar todas.
--
-- O que hoje é `project text` vira referência a `org_units`. Tratar `project`
-- como tenant seria errado — a Holding deixaria de ver as próprias
-- concessionárias, e o relatório consolidado quebraria.
--
-- A HIERARQUIA É DADO, não código: `org_units.parent_id` é recursivo. A NerdResolve
-- configura "Holding → concessionárias"; outro cliente pode ter três níveis
-- (Grupo → Empresa → Filial) ou nenhum, sem exigir migração nova.
--
-- ONDE `tenant_id` ENTRA, E ONDE NÃO ENTRA
--
-- Só nas tabelas RAIZ — as que não herdam o tenant de um pai. `lessons` não
-- recebe: ela pertence a um módulo, que pertence a um curso, que tem tenant.
-- Duplicar ali abriria espaço para divergência (uma aula com tenant diferente
-- do curso dela), e não há consulta que a alcance sem passar pelo curso.
--
-- Recebem: users, courses, tracks, events, audit_log, login_attempts.
-- Herdam:  sessions, password_reset_tokens, modules, lessons, materials,
--          track_courses, enrollments, lesson_progress, comments,
--          comment_votes, coin_spends, notifications.
-- =============================================================================

BEGIN;

-- ------------------------------------------------------------------ tenants
CREATE TABLE IF NOT EXISTS tenants (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Identificador curto para URL e configuração. `citext` porque ninguém deve
  -- errar o tenant por ter digitado maiúscula.
  slug       citext NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name       text NOT NULL CHECK (length(btrim(name)) > 0),
  -- Domínio próprio, quando houver. Nulo enquanto o cliente usa o domínio
  -- compartilhado.
  domain     citext UNIQUE,
  -- Como este cliente chama as próprias unidades: "Concessionária" para a
  -- NerdResolve, "Filial" ou "Diretoria" para outro. A palavra "projeto" estava
  -- escrita na interface, e não é vocabulário universal.
  unit_label text NOT NULL DEFAULT 'Unidade',
  status     text NOT NULL DEFAULT 'active'
             CHECK (status IN ('active', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- org_units
CREATE TABLE IF NOT EXISTS org_units (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  -- Recursivo: é isto que torna a hierarquia configurável em vez de fixa.
  -- Nulo é a raiz (para a NerdResolve, a Holding).
  parent_id  uuid REFERENCES org_units (id) ON DELETE RESTRICT,
  name       text NOT NULL CHECK (length(btrim(name)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Dois irmãos não podem ter o mesmo nome sob o mesmo pai.
--
-- São DOIS índices, não um `UNIQUE (tenant_id, parent_id, name)`: naquele
-- índice, `parent_id` nulo nunca colide — NULL não é igual a NULL — e duas
-- raízes homônimas passavam. Reaplicar a migração criava uma segunda
-- "Holding", que foi o que apareceu no teste.
CREATE UNIQUE INDEX IF NOT EXISTS org_units_sibling_idx
  ON org_units (tenant_id, parent_id, name) WHERE parent_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS org_units_root_idx
  ON org_units (tenant_id, name) WHERE parent_id IS NULL;

CREATE INDEX IF NOT EXISTS org_units_tenant_idx ON org_units (tenant_id);
CREATE INDEX IF NOT EXISTS org_units_parent_idx ON org_units (parent_id);

-- =============================================================================
-- O tenant da instalação atual
--
-- Os dados existentes pertencem a alguém. Criar o tenant e apontar tudo para
-- ele é o que permite `NOT NULL` no fim desta migração — sem isso, a coluna
-- ficaria opcional para sempre e o isolamento seria uma sugestão.
-- =============================================================================

-- "Se ainda não houver tenant NENHUM", e não "se não houver um chamado nerdlms".
--
-- As duas frases significavam a mesma coisa até a 035 renomear este tenant para
-- `exemplo`. Dali em diante, `ON CONFLICT (slug)` deixou de disparar — não
-- existe mais nenhum `nerdlms` para conflitar — e a reexecução das migrações
-- RECRIAVA o tenant antigo. A 035 então tentava renomear o recriado para
-- `exemplo`, que já existia, e a chave única abortava a execução inteira:
-- da 035 em diante nada mais era aplicado, e sobrava um tenant vazio no banco.
--
-- O executor roda todos os arquivos toda vez. Um seed precisa dizer o que
-- realmente quer dizer, ou ele envelhece junto com o dado que semeou.
INSERT INTO tenants (slug, name, unit_label)
SELECT 'lms', 'NerdResolve Saneamento', 'Concessionária'
 WHERE NOT EXISTS (SELECT 1 FROM tenants);

-- As unidades saem dos valores que já existem em `users.project`. A Holding
-- vira raiz e as demais penduram nela: é a estrutura real da empresa, e é
-- também a que o relatório consolidado pressupõe.
INSERT INTO org_units (tenant_id, parent_id, name)
SELECT t.id, NULL, 'Holding'
  FROM tenants t
 WHERE t.slug = 'lms'
ON CONFLICT (tenant_id, name) WHERE parent_id IS NULL DO NOTHING;

INSERT INTO org_units (tenant_id, parent_id, name)
SELECT t.id, raiz.id, p.project
  FROM tenants t
  JOIN org_units raiz ON raiz.tenant_id = t.id AND raiz.name = 'Holding'
  CROSS JOIN LATERAL (
    SELECT DISTINCT project FROM users WHERE project IS NOT NULL
  ) p
 WHERE t.slug = 'lms'
   AND p.project <> 'Holding'
ON CONFLICT (tenant_id, parent_id, name) WHERE parent_id IS NOT NULL DO NOTHING;

-- =============================================================================
-- `tenant_id` nas tabelas raiz
--
-- Em três passos por tabela: adiciona opcional, preenche, torna obrigatória.
-- Fazer direto com NOT NULL falharia — a tabela já tem linhas.
-- =============================================================================

ALTER TABLE users          ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants (id) ON DELETE RESTRICT;
ALTER TABLE courses        ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants (id) ON DELETE RESTRICT;
ALTER TABLE tracks         ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants (id) ON DELETE RESTRICT;
ALTER TABLE events         ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants (id) ON DELETE RESTRICT;
ALTER TABLE audit_log      ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants (id) ON DELETE RESTRICT;
ALTER TABLE login_attempts ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants (id) ON DELETE RESTRICT;

UPDATE users          SET tenant_id = (SELECT id FROM tenants WHERE slug = 'lms') WHERE tenant_id IS NULL;
UPDATE courses        SET tenant_id = (SELECT id FROM tenants WHERE slug = 'lms') WHERE tenant_id IS NULL;
UPDATE tracks         SET tenant_id = (SELECT id FROM tenants WHERE slug = 'lms') WHERE tenant_id IS NULL;
UPDATE events         SET tenant_id = (SELECT id FROM tenants WHERE slug = 'lms') WHERE tenant_id IS NULL;
UPDATE login_attempts SET tenant_id = (SELECT id FROM tenants WHERE slug = 'lms') WHERE tenant_id IS NULL;

ALTER TABLE users          ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE courses        ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE tracks         ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE events         ALTER COLUMN tenant_id SET NOT NULL;
-- O histórico da auditoria é preenchido com a trigger DESABILITADA por um
-- instante, dentro da mesma transação.
--
-- `DEFAULT` não serve: o Postgres não aceita subconsulta em default, e o id do
-- tenant não é conhecido em tempo de escrita da migração. Desabilitar a trigger
-- é o único caminho — e é seguro aqui porque o escopo é uma transação que ou
-- aplica tudo ou nada, o valor escrito é o mesmo para todas as linhas, e
-- nenhum conteúdo de auditoria muda: só se acrescenta a qual cliente o
-- registro sempre pertenceu.
ALTER TABLE audit_log DISABLE TRIGGER audit_log_no_update;
UPDATE audit_log SET tenant_id = (SELECT id FROM tenants WHERE slug = 'lms') WHERE tenant_id IS NULL;
ALTER TABLE audit_log ENABLE TRIGGER audit_log_no_update;

ALTER TABLE audit_log      ALTER COLUMN tenant_id SET NOT NULL;
-- `login_attempts` fica opcional: a tentativa é registrada ANTES de saber quem
-- é a pessoa, e num login com e-mail inexistente não há tenant a atribuir.
-- Exigir NOT NULL aqui obrigaria a inventar um.

-- Índice em toda coluna nova: `tenant_id` entra em praticamente toda consulta
-- daqui em diante, e sem índice cada uma varre a tabela.
CREATE INDEX IF NOT EXISTS users_tenant_idx          ON users (tenant_id);
CREATE INDEX IF NOT EXISTS courses_tenant_idx        ON courses (tenant_id);
CREATE INDEX IF NOT EXISTS tracks_tenant_idx         ON tracks (tenant_id);
CREATE INDEX IF NOT EXISTS events_tenant_idx         ON events (tenant_id);
CREATE INDEX IF NOT EXISTS audit_log_tenant_idx      ON audit_log (tenant_id);
CREATE INDEX IF NOT EXISTS login_attempts_tenant_idx ON login_attempts (tenant_id);

-- =============================================================================
-- `project` (texto) vira `org_unit_id` (referência) — F0-02
--
-- As duas colunas convivem nesta migração. Remover `project` agora quebraria a
-- aplicação em produção no instante em que o SQL rodasse, antes do deploy do
-- código novo. A remoção fica para a migração seguinte, depois que nada mais
-- lê o texto.
-- =============================================================================

ALTER TABLE users   ADD COLUMN IF NOT EXISTS org_unit_id uuid REFERENCES org_units (id) ON DELETE SET NULL;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS org_unit_id uuid REFERENCES org_units (id) ON DELETE SET NULL;
ALTER TABLE tracks  ADD COLUMN IF NOT EXISTS org_unit_id uuid REFERENCES org_units (id) ON DELETE SET NULL;
ALTER TABLE events  ADD COLUMN IF NOT EXISTS org_unit_id uuid REFERENCES org_units (id) ON DELETE SET NULL;

UPDATE users u
   SET org_unit_id = ou.id
  FROM org_units ou
 WHERE ou.tenant_id = u.tenant_id AND ou.name = u.project AND u.org_unit_id IS NULL;

UPDATE courses c
   SET org_unit_id = ou.id
  FROM org_units ou
 WHERE ou.tenant_id = c.tenant_id AND ou.name = c.project AND c.org_unit_id IS NULL;

UPDATE tracks t
   SET org_unit_id = ou.id
  FROM org_units ou
 WHERE ou.tenant_id = t.tenant_id AND ou.name = t.project AND t.org_unit_id IS NULL;

UPDATE events e
   SET org_unit_id = ou.id
  FROM org_units ou
 WHERE ou.tenant_id = e.tenant_id AND ou.name = e.project AND e.org_unit_id IS NULL;

CREATE INDEX IF NOT EXISTS users_org_unit_idx   ON users (org_unit_id);
CREATE INDEX IF NOT EXISTS courses_org_unit_idx ON courses (org_unit_id);
CREATE INDEX IF NOT EXISTS tracks_org_unit_idx  ON tracks (org_unit_id);
CREATE INDEX IF NOT EXISTS events_org_unit_idx  ON events (org_unit_id);

-- =============================================================================
-- Unicidade passa a ser POR TENANT
--
-- `users.email` era único no banco inteiro. Com mais de um cliente, duas
-- empresas podem legitimamente ter a mesma pessoa — ou o mesmo endereço
-- genérico (contato@, treinamento@). Manter global impediria o segundo cliente
-- de cadastrar alguém que o primeiro já tem.
--
-- O mesmo vale para o slug do curso: "integracao" existe em toda empresa.
-- =============================================================================

-- A CONSTRAINT sai primeiro, e o índice vai junto: um índice que sustenta
-- constraint não pode ser removido sozinho — o Postgres recusa com
-- "cannot drop index ... because constraint ... requires it". Só depois, se
-- sobrar um índice solto (criado sem constraint), o DROP INDEX o alcança.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
DROP INDEX IF EXISTS users_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS users_tenant_email_idx ON users (tenant_id, email);

ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_slug_key;
DROP INDEX IF EXISTS courses_slug_key;
CREATE UNIQUE INDEX IF NOT EXISTS courses_tenant_slug_idx ON courses (tenant_id, slug);

ALTER TABLE tracks DROP CONSTRAINT IF EXISTS tracks_slug_key;
DROP INDEX IF EXISTS tracks_slug_key;
CREATE UNIQUE INDEX IF NOT EXISTS tracks_tenant_slug_idx ON tracks (tenant_id, slug);

-- =============================================================================
-- Permissões do papel da aplicação
--
-- As tabelas novas precisam do mesmo GRANT das antigas, senão a aplicação
-- conecta e não lê nada — falha silenciosa até a primeira consulta.
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON tenants   TO lms_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON org_units TO lms_app;

COMMIT;

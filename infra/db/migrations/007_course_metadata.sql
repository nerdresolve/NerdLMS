-- 007 — Categorias, tags e os metadados que o guia §3 exige.
--
-- Hoje um curso tem título, resumo, autor, situação e modo de matrícula. O guia
-- lista dezoito campos, e a falta deles não é cosmética: sem categoria não há
-- navegação por assunto, sem carga horária o aluno não sabe no que está se
-- metendo, e sem código o RH não casa o curso com a matriz de treinamento.
--
-- Duas decisões de modelagem que valem explicação:
--
--   1. CATEGORIA É ÁRVORE. O guia diz "categoria e subcategoria", e duas
--      tabelas — ou duas colunas — fixariam exatamente dois níveis. É o mesmo
--      erro que `org_units` evitou: um cliente vai querer três níveis
--      (Área → Disciplina → Tema) e outro vai querer um só. `parent_id`
--      recursivo resolve os dois sem código novo.
--
--   2. TAG É TABELA, NÃO ARRAY. `text[]` em `courses` pareceria mais simples e
--      impediria duas coisas necessárias: renomear uma tag em todos os cursos
--      de uma vez, e oferecer ao instrutor a lista do que já existe — sem isso
--      nascem "NR-10", "NR10" e "nr 10" como três tags distintas.

BEGIN;

-- ------------------------------------------------------------- categorias
CREATE TABLE IF NOT EXISTS course_categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,

  -- Recursivo: a subcategoria aponta para a categoria mãe. NULL é raiz.
  -- `ON DELETE CASCADE` porque apagar uma categoria com filhas e deixá-las
  -- órfãs produziria categorias invisíveis — nenhuma tela navega para um
  -- `parent_id` que não existe mais.
  parent_id  uuid REFERENCES course_categories (id) ON DELETE CASCADE,

  name       text NOT NULL CHECK (length(btrim(name)) > 0),
  slug       text NOT NULL CHECK (slug ~ '^[a-z0-9-]+$'),

  -- Ordem de exibição. Categoria é navegação, e ordem alfabética nem sempre é
  -- a ordem que o cliente quer mostrar.
  position   integer NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now()
);

-- O slug é único por tenant, não global: dois clientes podem ter "seguranca".
CREATE UNIQUE INDEX IF NOT EXISTS course_categories_slug_idx
  ON course_categories (tenant_id, slug);

-- Nome único entre irmãs. Dois índices parciais pela mesma razão de
-- `org_units`: NULL nunca é igual a NULL num índice único, então uma restrição
-- sobre (tenant_id, parent_id, name) não impediria duas raízes homônimas.
CREATE UNIQUE INDEX IF NOT EXISTS course_categories_sibling_idx
  ON course_categories (tenant_id, parent_id, name) WHERE parent_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS course_categories_root_idx
  ON course_categories (tenant_id, name) WHERE parent_id IS NULL;

-- O parcial acima cobre a navegação (filhas de uma categoria), mas a
-- verificação de FK exige um índice sobre a coluna inteira: a checagem de
-- integridade ao apagar uma categoria percorre TODAS as linhas, inclusive as
-- de `parent_id` nulo, e um índice parcial não a atende.
CREATE INDEX IF NOT EXISTS course_categories_parent_idx ON course_categories (parent_id);

-- Toda consulta de categoria filtra por tenant; sem este índice, cada uma
-- varre a tabela inteira.
CREATE INDEX IF NOT EXISTS course_categories_tenant_idx ON course_categories (tenant_id);

-- ------------------------------------------------------------------ tags
CREATE TABLE IF NOT EXISTS tags (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  name      text NOT NULL CHECK (length(btrim(name)) > 0),
  slug      text NOT NULL CHECK (slug ~ '^[a-z0-9-]+$')
);

CREATE UNIQUE INDEX IF NOT EXISTS tags_slug_idx ON tags (tenant_id, slug);

-- O índice único acima começa por `tenant_id`, então já serve de índice para a
-- chave estrangeira — um índice composto atende consultas pelo prefixo.

CREATE TABLE IF NOT EXISTS course_tags (
  course_id uuid NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  tag_id    uuid NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
  PRIMARY KEY (course_id, tag_id)
);

CREATE INDEX IF NOT EXISTS course_tags_tag_idx ON course_tags (tag_id);

-- --------------------------------------------------- metadados do curso
--
-- Tudo anulável e sem padrão obrigatório: são 341 cursos... na verdade 7, mas
-- o princípio vale igual. Exigir preenchimento retroativo transformaria uma
-- migration em trabalho de curadoria, e um curso sem carga horária declarada
-- continua sendo um curso válido.

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES course_categories (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS courses_category_idx ON courses (category_id) WHERE category_id IS NOT NULL;

-- Código do curso: o identificador que o RH usa (NR-10, INT-001). Único por
-- tenant quando informado — dois cursos com o mesmo código tornariam a matriz
-- de treinamento ambígua.
ALTER TABLE courses ADD COLUMN IF NOT EXISTS code text;

CREATE UNIQUE INDEX IF NOT EXISTS courses_code_idx
  ON courses (tenant_id, code) WHERE code IS NOT NULL;

-- Carga horária DECLARADA, em minutos.
--
-- Não é a soma da duração dos vídeos: um curso de 40 minutos de vídeo pode ser
-- de "4 horas" no certificado, contando leitura e exercício. É esse número
-- declarado que vai para o certificado e para o relatório de compliance.
ALTER TABLE courses ADD COLUMN IF NOT EXISTS workload_minutes integer
  CHECK (workload_minutes IS NULL OR workload_minutes > 0);

ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_level_check;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS level text;
ALTER TABLE courses ADD CONSTRAINT courses_level_check
  CHECK (level IS NULL OR level IN ('basic', 'intermediate', 'advanced'));

-- Idioma em BCP 47 ('pt-BR', 'en'). Texto livre com CHECK de formato em vez de
-- enum: a lista de idiomas do mundo não cabe num CHECK que se mantém.
ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_language_check;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS language text;
ALTER TABLE courses ADD CONSTRAINT courses_language_check
  CHECK (language IS NULL OR language ~ '^[a-z]{2}(-[A-Z]{2})?$');

-- Objetivos de aprendizagem e público-alvo: texto corrido, exibido na página do
-- curso. Um objetivo por linha é convenção da interface, não do banco —
-- normalizar em tabela daria pouco e custaria uma junção em toda leitura.
ALTER TABLE courses ADD COLUMN IF NOT EXISTS objectives text;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS audience text;

-- Janela do curso. Datas, não instantes: "começa em 3 de março" não tem hora, e
-- guardar timestamp obrigaria a escolher um fuso que não significa nada aqui.
ALTER TABLE courses ADD COLUMN IF NOT EXISTS starts_on date;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS ends_on date;

ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_window_check;
ALTER TABLE courses ADD CONSTRAINT courses_window_check
  CHECK (starts_on IS NULL OR ends_on IS NULL OR ends_on >= starts_on);

-- Visibilidade no catálogo.
--
-- Separada de `status` porque respondem coisas diferentes: `status` é o ciclo
-- editorial (rascunho → publicado → arquivado), visibilidade é quem enxerga um
-- curso JÁ publicado. Um treinamento sigiloso pode estar publicado e fora do
-- catálogo, e hoje não há como expressar isso.
ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_visibility_check;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'catalog';
ALTER TABLE courses ADD CONSTRAINT courses_visibility_check
  CHECK (visibility IN ('catalog', 'unlisted'));

COMMIT;

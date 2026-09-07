-- 027 — Índices nas chaves estrangeiras que ficaram sem.
--
-- O Postgres cria índice sozinho para a chave PRIMÁRIA e para restrições
-- únicas. Para chave ESTRANGEIRA, não cria. A diferença é fácil de esquecer, e
-- foi: as migrações 019 a 025 trouxeram 34 referências sem índice do lado que
-- referencia.
--
-- Duas consequências, e a segunda é a que morde:
--
--   BUSCA — "as evidências desta competência" varre `competency_evidence`
--   inteira em vez de ir direto. Com poucos registros ninguém nota; com o
--   volume de uma operação de 27 mil pessoas, aparece.
--
--   EXCLUSÃO — e esta é pior. Apagar uma linha do lado referenciado obriga o
--   Postgres a procurar filhos em CADA tabela que aponta para ela. Sem índice,
--   é uma varredura completa por tabela filha, dentro de uma transação que
--   segura bloqueio. Excluir um cliente — que é `ON DELETE CASCADE` descendo
--   por dezenas de tabelas — passa de instantâneo a minutos, com o banco
--   travado no caminho.
--
-- `infra/tools/check-sql.mjs` cobra isto desde o começo do projeto e vinha
-- acusando as 34 sem que ninguém rodasse a verificação até o fim. Esta migração
-- zera a lista.

BEGIN;

-- ---------------------------------------------------------------------------
-- Badges (019)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS badges_created_by_idx ON badges (created_by);
CREATE INDEX IF NOT EXISTS badges_track_idx ON badges (track_id);
CREATE INDEX IF NOT EXISTS badge_awards_awarded_by_idx ON badge_awards (awarded_by);

-- ---------------------------------------------------------------------------
-- Competências (020)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS competencies_tenant_idx ON competencies (tenant_id);
-- `parent_id` é a árvore: "os filhos desta competência" é a consulta que monta
-- a tela inteira, e o nível derivado do pai depende dela.
CREATE INDEX IF NOT EXISTS competencies_parent_idx ON competencies (parent_id);

CREATE INDEX IF NOT EXISTS competency_evidence_competency_idx ON competency_evidence (competency_id);
CREATE INDEX IF NOT EXISTS competency_evidence_user_idx ON competency_evidence (user_id);
CREATE INDEX IF NOT EXISTS competency_evidence_course_idx ON competency_evidence (course_id);
CREATE INDEX IF NOT EXISTS competency_evidence_lesson_idx ON competency_evidence (lesson_id);
CREATE INDEX IF NOT EXISTS competency_evidence_quiz_idx ON competency_evidence (quiz_id);
CREATE INDEX IF NOT EXISTS competency_evidence_assignment_idx ON competency_evidence (assignment_id);
CREATE INDEX IF NOT EXISTS competency_evidence_attested_by_idx ON competency_evidence (attested_by);

CREATE INDEX IF NOT EXISTS competency_links_competency_idx ON competency_links (competency_id);
CREATE INDEX IF NOT EXISTS competency_links_lesson_idx ON competency_links (lesson_id);
CREATE INDEX IF NOT EXISTS competency_links_quiz_idx ON competency_links (quiz_id);
CREATE INDEX IF NOT EXISTS competency_links_assignment_idx ON competency_links (assignment_id);

CREATE INDEX IF NOT EXISTS learning_plans_created_by_idx ON learning_plans (created_by);
CREATE INDEX IF NOT EXISTS learning_plan_items_competency_idx ON learning_plan_items (competency_id);
CREATE INDEX IF NOT EXISTS learning_plan_assignments_assigned_by_idx ON learning_plan_assignments (assigned_by);

-- ---------------------------------------------------------------------------
-- xAPI (021)
-- ---------------------------------------------------------------------------
-- O LRS é a tabela que mais cresce do produto: uma declaração por interação,
-- de todo mundo. É onde a varredura dói primeiro.
CREATE INDEX IF NOT EXISTS xapi_statements_tenant_idx ON xapi_statements (tenant_id);
CREATE INDEX IF NOT EXISTS xapi_statements_actor_idx ON xapi_statements (actor_id);
CREATE INDEX IF NOT EXISTS xapi_statements_course_idx ON xapi_statements (course_id);
CREATE INDEX IF NOT EXISTS xapi_statements_lesson_idx ON xapi_statements (lesson_id);
CREATE INDEX IF NOT EXISTS xapi_statements_api_key_idx ON xapi_statements (api_key_id);
CREATE INDEX IF NOT EXISTS xapi_statements_voided_by_idx ON xapi_statements (voided_by);

-- ---------------------------------------------------------------------------
-- LTI (023)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS lti_tools_created_by_idx ON lti_tools (created_by);
CREATE INDEX IF NOT EXISTS lti_links_tool_idx ON lti_links (tool_id);
CREATE INDEX IF NOT EXISTS lti_links_lesson_idx ON lti_links (lesson_id);

-- `lti_nonces` recebe uma linha por launch e é limpa por tempo; sem índice, a
-- limpeza e a exclusão de cliente varrem tudo.
CREATE INDEX IF NOT EXISTS lti_nonces_tenant_idx ON lti_nonces (tenant_id);
CREATE INDEX IF NOT EXISTS lti_nonces_link_idx ON lti_nonces (link_id);
CREATE INDEX IF NOT EXISTS lti_nonces_user_idx ON lti_nonces (user_id);

-- ---------------------------------------------------------------------------
-- Conteúdo interativo (025)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS interactive_items_content_idx ON interactive_items (content_id);
CREATE INDEX IF NOT EXISTS interactive_responses_item_idx ON interactive_responses (item_id);
CREATE INDEX IF NOT EXISTS interactive_responses_enrollment_idx ON interactive_responses (enrollment_id);

COMMIT;

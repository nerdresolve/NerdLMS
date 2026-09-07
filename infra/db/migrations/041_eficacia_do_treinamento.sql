-- 041 — Avaliação de eficácia do treinamento.
--
-- Concluir o curso prova que a pessoa assistiu e passou na prova. Não prova que
-- ela trabalha diferente por causa disso, e é essa a pergunta que a fiscalização
-- faz. O instrutor volta algum tempo depois e registra se o treinamento surtiu
-- efeito — a regra de prazo está em `core/assessment/eficacia.ts`.
--
-- POR QUE A FILA NÃO É UMA TABELA
--
-- Não há linha "fulano concluiu o curso X": a conclusão é derivada de todas as
-- aulas vistas mais, quando o curso exige, a nota mínima. Materializar isso
-- criaria duas verdades e deixaria de fora todo mundo que concluiu antes desta
-- migração. A fila sai de consulta; o que vira registro é a avaliação.
--
-- POR QUE ELA É SOMENTE-INSERÇÃO
--
-- É evidência de conformidade — mesma natureza de `grade_entries` e
-- `competency_evidence`, e a mesma regra: avaliação que se reescreve não prova
-- nada. Corrigir um veredito equivocado se faz REVOGANDO e registrando outro,
-- com o motivo escrito. O histórico mostra as duas.
--
-- O índice único é PARCIAL, sobre as não revogadas: é o que impede duas
-- avaliações valendo ao mesmo tempo sem impedir a correção.

BEGIN;

CREATE TABLE IF NOT EXISTS effectiveness_reviews (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- A matrícula, e não o par (pessoa, curso): é ela que carrega a conclusão, e
  -- é ela que some quando a pessoa é eliminada.
  enrollment_id  uuid NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,

  -- Quando a pessoa concluiu, guardado no momento da avaliação.
  --
  -- Copiado de propósito, e não recalculado depois: é o que o prazo mediu. Uma
  -- aula acrescentada ao curso no ano seguinte mudaria a conclusão derivada e
  -- faria uma avaliação feita no prazo parecer atrasada.
  completed_at   timestamptz NOT NULL,

  verdict        text NOT NULL CHECK (verdict IN ('efetivo', 'parcial', 'inefetivo')),

  -- O que foi observado. Obrigatório: um veredito sem justificativa não
  -- responde "por quê" a ninguém que abrir o registro depois.
  observation    text NOT NULL CHECK (length(btrim(observation)) >= 10),

  reviewed_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at    timestamptz NOT NULL DEFAULT now(),

  revoked_at     timestamptz,
  revoked_reason text,

  -- Revogar exige dizer por quê, e as duas colunas andam juntas.
  CONSTRAINT effectiveness_reviews_revogacao_completa
    CHECK ((revoked_at IS NULL AND revoked_reason IS NULL)
        OR (revoked_at IS NOT NULL AND length(btrim(revoked_reason)) >= 10))
);

-- Uma avaliação valendo por matrícula; revogadas não contam.
CREATE UNIQUE INDEX IF NOT EXISTS effectiveness_reviews_uma_por_matricula
  ON effectiveness_reviews (enrollment_id)
  WHERE revoked_at IS NULL;

-- E um índice cheio sobre a mesma coluna, porque o de cima é PARCIAL: quem
-- pergunta pelo histórico de uma matrícula quer as revogadas junto, e nenhuma
-- consulta assim usaria o índice condicional.
CREATE INDEX IF NOT EXISTS effectiveness_reviews_por_matricula
  ON effectiveness_reviews (enrollment_id);

-- A fila do instrutor lê por tenant e ordena por conclusão.
CREATE INDEX IF NOT EXISTS effectiveness_reviews_por_tenant
  ON effectiveness_reviews (tenant_id, completed_at);

-- Chave estrangeira sem índice faz o `SET NULL` da exclusão de conta varrer a
-- tabela inteira. Vale para qualquer FK, e é o que `npm run check:sql` cobra.
CREATE INDEX IF NOT EXISTS effectiveness_reviews_por_avaliador
  ON effectiveness_reviews (reviewed_by);

-- -----------------------------------------------------------------------------
-- Somente-inserção, com as duas saídas que a 040 ensinou a abrir
--
--   1. revogação — a única alteração de conteúdo, e ela não reescreve nada:
--      acrescenta que deixou de valer;
--   2. soltar quem avaliou, quando essa conta é eliminada (`reviewed_by` é
--      `ON DELETE SET NULL`, e sem esta saída a exclusão de conta voltaria a
--      travar — foi exatamente o defeito da 040).
--
-- O DELETE passa quando a matrícula já não tem dono: é o CASCADE da exclusão de
-- conta, mesma regra de `grade_entries`.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION effectiveness_reviews_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF NOT EXISTS (
      SELECT 1 FROM enrollments e
        JOIN users u ON u.id = e.learner_id
       WHERE e.id = OLD.enrollment_id
    ) THEN
      RETURN OLD;
    END IF;

    RAISE EXCEPTION 'effectiveness_reviews é somente-inserção: para corrigir, revogue e registre outra'
      USING HINT = 'Avaliação de eficácia apagável não prova conformidade nenhuma.';
  END IF;

  -- Revogação.
  IF OLD.revoked_at IS NULL
     AND NEW.revoked_at IS NOT NULL
     AND NEW.verdict       IS NOT DISTINCT FROM OLD.verdict
     AND NEW.observation   IS NOT DISTINCT FROM OLD.observation
     AND NEW.completed_at  IS NOT DISTINCT FROM OLD.completed_at
     AND NEW.enrollment_id IS NOT DISTINCT FROM OLD.enrollment_id
     AND NEW.reviewed_by   IS NOT DISTINCT FROM OLD.reviewed_by
     AND NEW.reviewed_at   IS NOT DISTINCT FROM OLD.reviewed_at
     AND NEW.tenant_id     IS NOT DISTINCT FROM OLD.tenant_id THEN
    RETURN NEW;
  END IF;

  -- Soltar quem avaliou, na eliminação da conta.
  IF OLD.reviewed_by IS NOT NULL
     AND NEW.reviewed_by IS NULL
     AND NEW.id             IS NOT DISTINCT FROM OLD.id
     AND NEW.tenant_id      IS NOT DISTINCT FROM OLD.tenant_id
     AND NEW.enrollment_id  IS NOT DISTINCT FROM OLD.enrollment_id
     AND NEW.completed_at   IS NOT DISTINCT FROM OLD.completed_at
     AND NEW.verdict        IS NOT DISTINCT FROM OLD.verdict
     AND NEW.observation    IS NOT DISTINCT FROM OLD.observation
     AND NEW.reviewed_at    IS NOT DISTINCT FROM OLD.reviewed_at
     AND NEW.revoked_at     IS NOT DISTINCT FROM OLD.revoked_at
     AND NEW.revoked_reason IS NOT DISTINCT FROM OLD.revoked_reason THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'effectiveness_reviews é somente-inserção: para corrigir, revogue e registre outra'
    USING HINT = 'Avaliação de eficácia alterável não prova conformidade nenhuma.';
END;
$$;

CREATE OR REPLACE TRIGGER effectiveness_reviews_no_update
  BEFORE UPDATE OR DELETE ON effectiveness_reviews
  FOR EACH ROW EXECUTE FUNCTION effectiveness_reviews_append_only();

COMMIT;

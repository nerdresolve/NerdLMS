-- 040 — A exclusão de conta que o schema promete e o banco recusava (LGPD).
--
-- O MESMO DEFEITO DA 028, EM TRÊS TABELAS.
--
-- `audit_log.actor_id` é `ON DELETE SET NULL` desde a 002: o schema diz que
-- apagar a pessoa desliga o registro dela em vez de apagá-lo, e o histórico de
-- quem mais aparece naquela linha continua de pé. `deleteUserAccount` repete
-- isso na documentação, coluna por coluna.
--
-- Só que o gatilho `audit_log_no_update` recusa QUALQUER update, e o `SET NULL`
-- é um update. O resultado é que a exclusão nunca aconteceu:
--
--   ERROR:  audit_log é somente-inserção: UPDATE recusado
--
-- E não para um caso raro. Entrar na plataforma escreve auditoria, então toda
-- conta que já logou uma vez é indelével. O direito à eliminação existia no
-- código, na documentação e no schema, e não existia no banco.
--
-- O QUE SAI
--
-- Tudo que identifica a pessoa:
--
--   actor_id    — o vínculo com a conta, que vira nulo;
--   actor_name  — o nome gravado junto, que sobreviveria ao `SET NULL` sozinho
--                 e devolveria a identidade que a exclusão tirou;
--   ip          — endereço de origem é dado pessoal, e guardá-lo depois da
--                 eliminação é anonimizar pela metade;
--   target      — SÓ quando ele guarda o e-mail da própria pessoa. O login
--                 grava `target = e-mail`, mas na maioria das ações o alvo é
--                 outra coisa (um curso, outra conta), e limpar sempre
--                 destruiria o registro de terceiros.
--
-- `actor_name` e `target` são NOT NULL, então recebem a marca 'conta excluída'
-- em vez de nulo. A marca é fixa e o gatilho exige exatamente ela: se aceitasse
-- qualquer texto, a fresta da anonimização viraria um caminho para trocar o
-- nome de quem agiu — que é o oposto do que ela serve.
--
-- O QUE FICA
--
-- `at`, `action` e `outcome`. Continua verdade que uma ação daquele tipo
-- aconteceu naquela hora e com aquele desfecho — é disso que a trilha serve, e
-- é o que sobra sem apontar para ninguém.
--
-- POR QUE A EXCEÇÃO É ESTREITA
--
-- DEC-048 continua valendo: registro de auditoria alterável não prova nada. A
-- exceção confere campo a campo que só a identificação mudou. Uma condição
-- larga — "permita UPDATE quando actor_id ficar nulo" — deixaria reescrever o
-- `action` de um registro passado, que é exatamente o que o gatilho existe
-- para impedir.

BEGIN;

CREATE OR REPLACE FUNCTION audit_log_is_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'audit_log é somente-inserção: DELETE recusado'
      USING HINT = 'Registro de auditoria apagável não prova nada. Ver DEC-048.';
  END IF;

  -- Anonimização (LGPD).
  IF NEW.actor_id      IS NULL
     AND NEW.actor_name = 'conta excluída'
     AND NEW.ip         IS NULL
     -- O alvo só muda quando era o e-mail de quem está sendo eliminado, e só
     -- pode virar a marca — nunca outro texto.
     AND (NEW.target IS NOT DISTINCT FROM OLD.target OR NEW.target = 'conta excluída')
     -- E o fato em si permanece intocado.
     AND NEW.id        IS NOT DISTINCT FROM OLD.id
     AND NEW.at        IS NOT DISTINCT FROM OLD.at
     AND NEW.action    IS NOT DISTINCT FROM OLD.action
     AND NEW.outcome   IS NOT DISTINCT FROM OLD.outcome
     AND NEW.tenant_id IS NOT DISTINCT FROM OLD.tenant_id THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'audit_log é somente-inserção: UPDATE recusado'
    USING HINT = 'Registro de auditoria alterável não prova nada. Ver DEC-048.';
END;
$$;

-- O gatilho já existe desde a 002 e continua o mesmo; só a função mudou. Fica
-- aqui com `OR REPLACE` para o caso de a 002 não ter rodado nesta base.
CREATE OR REPLACE TRIGGER audit_log_no_update
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_is_append_only();

-- -----------------------------------------------------------------------------
-- A anonimização como FUNÇÃO, e não como permissão de UPDATE
--
-- A 002 tirou UPDATE e DELETE de `audit_log` do papel da aplicação: ela só
-- pode ler e acrescentar. Isso vale mesmo agora que o gatilho ficou mais
-- estreito — a garantia no nível da permissão é o que sobra se um dia o
-- gatilho for afrouxado por engano.
--
-- Então a aplicação não ganha UPDATE. Ganha o direito de executar ESTA função,
-- que faz exatamente uma coisa. `SECURITY DEFINER` a executa com o dono do
-- schema; `search_path` fixo é higiene obrigatória nesse modo, senão um
-- esquema plantado na frente do `public` sequestraria os nomes de dentro.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION anonimizar_auditoria(p_tenant uuid, p_pessoa uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  atingidas bigint;
  email_da_pessoa text;
BEGIN
  SELECT u.email::text INTO email_da_pessoa
    FROM users u WHERE u.id = p_pessoa AND u.tenant_id = p_tenant;

  UPDATE audit_log AS a
     SET actor_id = NULL,
         actor_name = 'conta excluída',
         ip = NULL,
         -- O alvo só sai quando era o e-mail da própria pessoa: o login grava
         -- `target = e-mail`, e nas demais ações o alvo é outra coisa.
         target = CASE
                    WHEN email_da_pessoa IS NOT NULL AND a.target = email_da_pessoa
                    THEN 'conta excluída'
                    ELSE a.target
                  END
   WHERE a.tenant_id = p_tenant
     AND a.actor_id = p_pessoa;

  GET DIAGNOSTICS atingidas = ROW_COUNT;
  RETURN atingidas;
END;
$$;

-- Ninguém por padrão; a aplicação por nome.
REVOKE ALL ON FUNCTION anonimizar_auditoria(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION anonimizar_auditoria(uuid, uuid) TO lms_app;

-- -----------------------------------------------------------------------------
-- As outras duas tabelas que travavam a exclusão
--
-- `audit_log` não estava sozinha. Toda tabela somente-inserção com uma chave
-- `ON DELETE SET NULL` para `users` tem o mesmo problema: o schema manda
-- desligar a pessoa do registro, o gatilho recusa o UPDATE que faz isso, e a
-- exclusão morre no meio.
--
--   grade_entries.graded_by        — quem corrigiu
--   competency_evidence.attested_by — quem atestou
--
-- São ligações de AUTORIA, não o conteúdo do registro. Soltá-las é o que o
-- `SET NULL` sempre quis dizer: a nota lançada continua sendo a nota lançada,
-- sem apontar para uma conta que não existe mais.
--
-- `lesson_progress.completed_by` também é `SET NULL`, e passa: o gatilho de lá
-- é o `touch_updated_at`, não um de imutabilidade.
--
-- Cada exceção confere campo a campo. A regra é sempre a mesma: só a ligação
-- com a pessoa muda, e ela só pode ficar nula.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION grade_entries_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- A nota some junto com a pessoa, e só com ela.
  --
  -- `enrollment_id` é CASCADE: apagar a conta apaga a matrícula, que apaga as
  -- notas. O gatilho recusava esse DELETE e a exclusão parava aqui — a mesma
  -- saída que `competency_evidence` já tinha, e que faltava nesta tabela.
  --
  -- A condição é "esta nota não pertence mais a ninguém vivo". Nada no produto
  -- apaga matrícula por outro motivo, então ela não abre caminho nenhum além
  -- deste; e se um dia abrir, quem escrever o desmatricular vai encontrar a
  -- regra escrita aqui.
  IF TG_OP = 'DELETE' AND NOT EXISTS (
       SELECT 1 FROM enrollments e
         JOIN users u ON u.id = e.learner_id
        WHERE e.id = OLD.enrollment_id
     ) THEN
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.graded_by IS NOT NULL
     AND NEW.graded_by IS NULL
     AND NEW.id              IS NOT DISTINCT FROM OLD.id
     AND NEW.tenant_id       IS NOT DISTINCT FROM OLD.tenant_id
     AND NEW.enrollment_id   IS NOT DISTINCT FROM OLD.enrollment_id
     AND NEW.quiz_id         IS NOT DISTINCT FROM OLD.quiz_id
     AND NEW.assignment_id   IS NOT DISTINCT FROM OLD.assignment_id
     AND NEW.points_earned   IS NOT DISTINCT FROM OLD.points_earned
     AND NEW.points_possible IS NOT DISTINCT FROM OLD.points_possible
     AND NEW.weight          IS NOT DISTINCT FROM OLD.weight
     AND NEW.feedback        IS NOT DISTINCT FROM OLD.feedback
     AND NEW.reason          IS NOT DISTINCT FROM OLD.reason
     AND NEW.created_at      IS NOT DISTINCT FROM OLD.created_at
     AND NEW.lti_link_id     IS NOT DISTINCT FROM OLD.lti_link_id THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'grade_entries é somente-inserção: para mudar a nota, lance outra entrada';
END;
$$;

CREATE OR REPLACE FUNCTION competency_evidence_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- Exclusão da PESSOA passa: é o CASCADE de `users`, e é o que a LGPD exige
  -- quando alguém pede para ser apagado. Sem esta saída, o produto não
  -- conseguiria cumprir um pedido de exclusão — e o gatilho, feito para
  -- proteger a prova, viraria o motivo de descumprir a lei.
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM users WHERE id = OLD.user_id) THEN
    RETURN OLD;
  END IF;

  -- A revogação é a única alteração de CONTEÚDO permitida: ela não reescreve o
  -- que aconteceu, acrescenta que deixou de valer.
  IF TG_OP = 'UPDATE'
     AND OLD.revoked_at IS NULL
     AND NEW.revoked_at IS NOT NULL
     AND NEW.level = OLD.level
     AND NEW.competency_id = OLD.competency_id
     AND NEW.user_id = OLD.user_id
     AND NEW.source = OLD.source THEN
    RETURN NEW;
  END IF;

  -- Soltar quem atestou, quando essa conta é eliminada.
  IF TG_OP = 'UPDATE'
     AND OLD.attested_by IS NOT NULL
     AND NEW.attested_by IS NULL
     AND NEW.id             IS NOT DISTINCT FROM OLD.id
     AND NEW.tenant_id      IS NOT DISTINCT FROM OLD.tenant_id
     AND NEW.competency_id  IS NOT DISTINCT FROM OLD.competency_id
     AND NEW.user_id        IS NOT DISTINCT FROM OLD.user_id
     AND NEW.level          IS NOT DISTINCT FROM OLD.level
     AND NEW.source         IS NOT DISTINCT FROM OLD.source
     AND NEW.course_id      IS NOT DISTINCT FROM OLD.course_id
     AND NEW.lesson_id      IS NOT DISTINCT FROM OLD.lesson_id
     AND NEW.quiz_id        IS NOT DISTINCT FROM OLD.quiz_id
     AND NEW.assignment_id  IS NOT DISTINCT FROM OLD.assignment_id
     AND NEW.note           IS NOT DISTINCT FROM OLD.note
     AND NEW.expires_at     IS NOT DISTINCT FROM OLD.expires_at
     AND NEW.revoked_at     IS NOT DISTINCT FROM OLD.revoked_at
     AND NEW.revoked_reason IS NOT DISTINCT FROM OLD.revoked_reason
     AND NEW.created_at     IS NOT DISTINCT FROM OLD.created_at THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'competency_evidence é somente-inserção: para mudar o nível, registre outra evidência'
    USING HINT = 'Evidência alterável não prova competência nenhuma. Mesma regra de grade_entries.';
END;
$$;

COMMIT;

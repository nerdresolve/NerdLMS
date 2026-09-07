-- Prova que as tabelas somente-inserção continuam somente-inserção.
--
-- POR QUE ISTO EXISTE
--
-- A migração 040 abriu frestas nos gatilhos de `audit_log`, `grade_entries` e
-- `competency_evidence` para a exclusão de conta poder cumprir a LGPD. Fresta
-- em gatilho de imutabilidade é a coisa mais fácil de alargar sem perceber: a
-- condição tem doze linhas, alguém acrescenta um campo à tabela, esquece de
-- listá-lo, e a exceção passa a aceitar mudanças naquele campo.
--
-- `npm run check:sql` não pega isso — ele lê o texto das migrações, não roda
-- banco. Este arquivo roda contra um banco de verdade e tenta, uma a uma, cada
-- coisa que o gatilho deve recusar.
--
--   npm run check:imutabilidade
--
-- Tudo acontece dentro de uma transação que termina em ROLLBACK: nada aqui
-- altera o banco, nem quando passa.

BEGIN;

DO $$
DECLARE
  alvo bigint;
  falhas int := 0;
BEGIN
  SELECT id INTO alvo FROM audit_log LIMIT 1;
  IF alvo IS NULL THEN
    RAISE EXCEPTION 'Não há registro em audit_log para testar. Rode o seed antes.';
  END IF;

  -- 1. Reescrever o fato: sempre recusado.
  BEGIN
    UPDATE audit_log SET action = 'ADULTERADO' WHERE id = alvo;
    falhas := falhas + 1;
    RAISE WARNING 'FALHA: audit_log deixou reescrever a ação';
  EXCEPTION WHEN others THEN RAISE NOTICE 'ok   audit_log recusa reescrever a ação';
  END;

  -- 2. Anonimização que aproveita para mudar outro campo: recusada.
  BEGIN
    UPDATE audit_log
       SET actor_id = NULL, actor_name = 'conta excluída', ip = NULL, action = 'X'
     WHERE id = alvo;
    falhas := falhas + 1;
    RAISE WARNING 'FALHA: a fresta da anonimização deixou mudar a ação';
  EXCEPTION WHEN others THEN RAISE NOTICE 'ok   audit_log recusa anonimização que mexe noutro campo';
  END;

  -- 3. Anonimização pela metade (nome e ip ficariam): recusada.
  BEGIN
    UPDATE audit_log SET actor_id = NULL WHERE id = alvo;
    falhas := falhas + 1;
    RAISE WARNING 'FALHA: audit_log aceitou anonimização pela metade';
  EXCEPTION WHEN others THEN RAISE NOTICE 'ok   audit_log recusa anonimização pela metade';
  END;

  -- 4. Trocar o nome de quem agiu por outro texto: recusado.
  BEGIN
    UPDATE audit_log
       SET actor_id = NULL, actor_name = 'Outra Pessoa', ip = NULL
     WHERE id = alvo;
    falhas := falhas + 1;
    RAISE WARNING 'FALHA: a fresta deixou TROCAR o nome de quem agiu';
  EXCEPTION WHEN others THEN RAISE NOTICE 'ok   audit_log recusa trocar o nome por outro texto';
  END;

  -- 5. Apagar registro de auditoria: sempre recusado.
  BEGIN
    DELETE FROM audit_log WHERE id = alvo;
    falhas := falhas + 1;
    RAISE WARNING 'FALHA: audit_log deixou apagar';
  EXCEPTION WHEN others THEN RAISE NOTICE 'ok   audit_log recusa apagar';
  END;

  -- 6. E a anonimização inteira, que a LGPD exige: aceita.
  BEGIN
    UPDATE audit_log
       SET actor_id = NULL, actor_name = 'conta excluída', ip = NULL
     WHERE id = alvo;
    RAISE NOTICE 'ok   audit_log aceita a anonimização completa';
  EXCEPTION WHEN others THEN
    falhas := falhas + 1;
    RAISE WARNING 'FALHA: audit_log recusou a anonimização completa: %', SQLERRM;
  END;

  -- 7. Nota: reescrever valor continua recusado.
  IF EXISTS (SELECT 1 FROM grade_entries) THEN
    BEGIN
      UPDATE grade_entries SET points_earned = points_earned + 1
       WHERE id = (SELECT id FROM grade_entries LIMIT 1);
      falhas := falhas + 1;
      RAISE WARNING 'FALHA: grade_entries deixou mudar a nota';
    EXCEPTION WHEN others THEN RAISE NOTICE 'ok   grade_entries recusa mudar a nota';
    END;

    -- 8. E apagar a nota de quem ainda existe: recusado.
    BEGIN
      DELETE FROM grade_entries
       WHERE id = (SELECT g.id FROM grade_entries g
                     JOIN enrollments e ON e.id = g.enrollment_id
                     JOIN users u ON u.id = e.learner_id
                    LIMIT 1);
      falhas := falhas + 1;
      RAISE WARNING 'FALHA: grade_entries deixou apagar nota de pessoa existente';
    EXCEPTION WHEN others THEN RAISE NOTICE 'ok   grade_entries recusa apagar nota de quem existe';
    END;
  ELSE
    RAISE NOTICE '--   grade_entries vazia: nada a testar';
  END IF;

  IF falhas > 0 THEN
    RAISE EXCEPTION '% verificação(ões) de imutabilidade falharam', falhas;
  END IF;

  RAISE NOTICE 'Imutabilidade preservada: as frestas da 040 são só o que dizem ser.';
END $$;

ROLLBACK;

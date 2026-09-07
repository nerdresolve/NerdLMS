-- 046 — Um plano de formação pode continuar outro.
--
-- O PROBLEMA
--
-- O cargo é um valor só — "Analista de Desenvolvimento PLENO" —, porque é isso
-- que o `title` do Active Directory entrega. Bom para alcançar as pessoas certas
-- e ruim para escrever o programa: o que vale para JR, PLENO e SÊNIOR precisa
-- ser repetido nos três planos, e a primeira vez que alguém mudar o comum vai
-- mudá-lo em um e esquecer os outros dois.
--
-- A HERANÇA
--
-- "PLENO continua JR, e acrescenta isto." O comum se escreve uma vez, no plano
-- de baixo, e os de cima só declaram o que muda.
--
-- POR QUE UM PAI SÓ, E NÃO VÁRIOS
--
-- Uma cadeia — JR → PLENO → SÊNIOR — é o que a progressão de carreira é, e ela
-- se lê de cima a baixo sem ambiguidade. Herança múltipla precisaria decidir o
-- que fazer quando dois pais exigem a mesma competência em níveis diferentes, e
-- essa decisão não tem resposta óbvia para quem monta o plano.
--
-- O CICLO
--
-- O banco impede o caso direto (um plano continuando a si mesmo). O indireto —
-- A continua B que continua A — não cabe num CHECK, e é conferido no caso de
-- uso; a resolução também para sozinha ao revisitar um plano, para um dado
-- estragado por outro caminho não travar a tela.

BEGIN;

ALTER TABLE learning_plans ADD COLUMN IF NOT EXISTS extends_plan_id uuid
  REFERENCES learning_plans(id) ON DELETE SET NULL;

DO $$
BEGIN
  ALTER TABLE learning_plans ADD CONSTRAINT learning_plans_nao_continua_a_si
    CHECK (extends_plan_id IS NULL OR extends_plan_id <> id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- `ON DELETE SET NULL` precisa de índice, senão apagar um plano varre a tabela.
CREATE INDEX IF NOT EXISTS learning_plans_extends_idx ON learning_plans (extends_plan_id);

COMMIT;

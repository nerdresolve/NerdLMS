-- 038 — Reteste por pedido, liberado pelo instrutor.
--
-- Antes, refazer a prova era autosserviço: `max_attempts` dava três tentativas
-- e cada um usava como quisesse. Passa a ser um PEDIDO, que alguém decide.
--
-- POR QUE ISSO MUDA O DESENHO, E NÃO SÓ UM NÚMERO
--
-- Três tentativas livres tornam a primeira um rascunho: quem reprova tenta de
-- novo no mesmo minuto, sem que ninguém saiba. Com pedido e aprovação, reprovar
-- vira um fato que alguém vê — e o instrutor decide se houve motivo, deixando
-- por escrito o porquê.
--
-- O COMENTÁRIO É OBRIGATÓRIO NA DECISÃO, e é a parte que importa. Uma
-- aprovação sem justificativa é um clique; com ela, existe registro de por que
-- aquela pessoa teve uma chance a mais — que é exatamente o que se quer poder
-- explicar depois, quando alguém perguntar.
--
-- O QUE NÃO ESTÁ AQUI
--
-- Limite de pedidos. Um aluno pode pedir quantas vezes quiser, e o instrutor
-- recusa quantas quiser — a recusa também fica registrada, com motivo. Um teto
-- automático decidiria, em silêncio, o que a regra quer que uma PESSOA decida.

BEGIN;

CREATE TABLE IF NOT EXISTS quiz_retake_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  quiz_id       uuid NOT NULL REFERENCES quizzes (id) ON DELETE CASCADE,
  -- O pedido pertence à MATRÍCULA, como a tentativa: quem sai do curso e
  -- volta começa outro vínculo, e o pedido antigo não o acompanha.
  enrollment_id uuid NOT NULL REFERENCES enrollments (id) ON DELETE CASCADE,

  -- O que o aluno escreveu ao pedir. Opcional: exigir justificativa de quem
  -- reprovou é pedir que ele argumente contra si mesmo.
  learner_note text,

  status text NOT NULL DEFAULT 'pending'
         CHECK (status IN ('pending', 'approved', 'denied')),

  -- Quem decidiu, quando, e por quê. O comentário é EXIGIDO na decisão pelo
  -- CHECK abaixo — é o que separa um registro explicável de um clique.
  decided_by uuid REFERENCES users (id) ON DELETE SET NULL,
  decided_at timestamptz,
  comment    text,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT retake_decisao_completa CHECK (
    (status = 'pending' AND decided_at IS NULL AND comment IS NULL)
    OR (status <> 'pending' AND decided_at IS NOT NULL
        AND comment IS NOT NULL AND length(btrim(comment)) > 0)
  )
);

CREATE INDEX IF NOT EXISTS quiz_retake_requests_quiz_idx ON quiz_retake_requests (quiz_id);
CREATE INDEX IF NOT EXISTS quiz_retake_requests_enrollment_idx ON quiz_retake_requests (enrollment_id);
CREATE INDEX IF NOT EXISTS quiz_retake_requests_tenant_idx ON quiz_retake_requests (tenant_id);
-- Quem decidiu: a consulta existe para responder "o que este instrutor
-- liberou?", que é a pergunta de quem audita uma concessão.
CREATE INDEX IF NOT EXISTS quiz_retake_requests_decided_by_idx ON quiz_retake_requests (decided_by);

-- Um pedido em aberto por vez, por prova e matrícula.
--
-- Sem isto, clicar duas vezes cria dois pedidos e o instrutor vê o mesmo aluno
-- duas vezes na fila — e aprovar os dois daria duas tentativas por engano.
-- Parcial porque decididos podem se acumular: é o histórico.
CREATE UNIQUE INDEX IF NOT EXISTS quiz_retake_um_pendente_idx
  ON quiz_retake_requests (quiz_id, enrollment_id)
  WHERE status = 'pending';

-- ---------------------------------------------------------------------------
-- Uma tentativa, e mais uma por reteste aprovado.
--
-- `max_attempts = 1` deixa de ser configuração de conveniência e passa a ser a
-- regra: a segunda chance existe, mas alguém precisa concedê-la.
-- ---------------------------------------------------------------------------
UPDATE quizzes SET max_attempts = 1, updated_at = now() WHERE max_attempts <> 1;

-- Aprovação em 8,0 numa escala de 0 a 10 — que é 80% dos pontos.
--
-- A tabela guarda percentual, e continua guardando: converter a coluna
-- reescreveria toda nota já lançada. O que muda é a APRESENTAÇÃO, que passa a
-- ser de zero a dez em toda tela onde alguém lê uma nota.
UPDATE quizzes SET passing_score = 80, updated_at = now() WHERE passing_score <> 80;

COMMIT;

-- 021 — xAPI: Learning Record Store (F6-03, guia §26).
--
-- O guia é explícito: "não trataria apenas como mais um formato de upload; é
-- uma camada de tracking/interoperabilidade". Então isto é um LRS de verdade —
-- statements entram e saem —, não um importador.
--
-- O QUE MUDA COM ISSO: hoje o produto só sabe o que aconteceu DENTRO dele. Com
-- xAPI ele passa a registrar o que aconteceu fora: um simulador de operação,
-- um treinamento presencial apontado por tablet, um app de campo. O §26 lista
-- exatamente isso — "atividades fora da LMS", "aprendizagem mobile",
-- "simulações", "experiências externas".
--
-- A FORMA DO STATEMENT é "ator VERBO objeto": "Maria completou a simulação de
-- parada de bomba". É a mesma frase que a plataforma já sabe montar para as
-- próprias ações, e é por isso que o LRS recebe as duas coisas — o que veio de
-- fora e o que a plataforma gerou.

BEGIN;

CREATE TABLE IF NOT EXISTS xapi_statements (
  -- O id vem de QUEM ENVIA, quando envia.
  --
  -- É assim que o padrão define: o cliente pode gerar o UUID para conseguir
  -- reenviar sem duplicar depois de uma queda de rede. Só geramos quando falta.
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,

  -- ATOR — quem fez.
  --
  -- `actor_id` é a pessoa daqui, quando dá para identificá-la. Statement de
  -- sistema externo pode chegar com um e-mail que não é de ninguém cadastrado:
  -- guardá-lo mesmo assim é o certo, porque o dado existe e um dia a conta pode
  -- ser criada. Perder o statement seria perder o que aconteceu.
  actor_id    uuid REFERENCES users (id) ON DELETE SET NULL,
  actor_mbox  text,
  actor_name  text,

  -- VERBO — o que fez. IRI, como o padrão manda.
  --
  -- "http://adlnet.gov/expapi/verbs/completed", não "completed": o IRI é o que
  -- torna o verbo comparável entre sistemas diferentes, que é o ponto do xAPI.
  verb_id      text NOT NULL CHECK (verb_id ~ '^https?://'),
  verb_display text NOT NULL,

  -- OBJETO — sobre o quê. Também IRI.
  object_id   text NOT NULL CHECK (object_id ~ '^https?://'),
  object_name text,
  object_type text NOT NULL DEFAULT 'Activity',

  -- RESULTADO — como foi. Tudo opcional: "assistiu" não tem nota.
  result_success   boolean,
  result_completion boolean,
  result_score_scaled numeric(4,3) CHECK (
    result_score_scaled IS NULL OR (result_score_scaled >= -1 AND result_score_scaled <= 1)
  ),
  result_score_raw numeric(10,2),
  result_score_min numeric(10,2),
  result_score_max numeric(10,2),
  -- Duração em segundos. O padrão usa ISO 8601 ("PT1H30M"); guardamos em
  -- segundos porque é o que se soma num relatório, e a conversão é trivial.
  result_duration_seconds integer CHECK (
    result_duration_seconds IS NULL OR result_duration_seconds >= 0
  ),
  result_response text,

  -- CONTEXTO — a que isto se liga na plataforma, quando se liga.
  --
  -- Um statement de fora pode não se ligar a nada, e está certo: é justamente
  -- o "aprendizagem fora da LMS" do §26.
  course_id uuid REFERENCES courses (id) ON DELETE SET NULL,
  lesson_id uuid REFERENCES lessons (id) ON DELETE SET NULL,

  -- O statement completo, como chegou.
  --
  -- Guardar o JSON inteiro ALÉM das colunas extraídas não é redundância: o
  -- padrão permite extensões arbitrárias, e um LRS que descarta o que não
  -- entende deixa de ser um LRS — quem consulta espera receber de volta o que
  -- mandou, inteiro.
  raw jsonb NOT NULL,

  -- Quando ACONTECEU (do statement) e quando CHEGOU (nosso).
  --
  -- São diferentes de propósito: um app de campo sem rede envia na segunda-feira
  -- o que aconteceu no sábado. Um relatório de atividade usa `timestamp`; a
  -- sincronização usa `stored`.
  timestamp timestamptz NOT NULL DEFAULT now(),
  stored    timestamptz NOT NULL DEFAULT now(),

  -- Quem enviou: a chave de API, quando veio de fora.
  api_key_id uuid REFERENCES api_keys (id) ON DELETE SET NULL,

  -- O statement é IMUTÁVEL por definição do padrão: "statements são
  -- registros do que aconteceu e não podem ser alterados". Voided é o
  -- mecanismo previsto — outro statement que anula este.
  voided_by uuid REFERENCES xapi_statements (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS xapi_tenant_idx    ON xapi_statements (tenant_id, stored DESC);
CREATE INDEX IF NOT EXISTS xapi_actor_idx     ON xapi_statements (actor_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS xapi_verb_idx      ON xapi_statements (tenant_id, verb_id);
CREATE INDEX IF NOT EXISTS xapi_course_idx    ON xapi_statements (course_id) WHERE course_id IS NOT NULL;
-- O objeto é consultado por IRI exato — "quantas vezes esta simulação rodou".
CREATE INDEX IF NOT EXISTS xapi_object_idx    ON xapi_statements (tenant_id, object_id);

-- Imutável, como o padrão exige.
--
-- A ÚNICA alteração permitida é marcar como anulado (`voided_by`), que é o
-- mecanismo que o próprio xAPI define para "este statement não vale mais" —
-- ele não apaga, acrescenta a anulação.
CREATE OR REPLACE FUNCTION xapi_statements_immutable() RETURNS trigger AS $$
BEGIN
  -- DELETE é sempre recusado, e isso NÃO conflita com a LGPD.
  --
  -- `actor_id` é `ON DELETE SET NULL`: apagar a pessoa desliga o statement dela
  -- em vez de apagá-lo. O que resta é "alguém completou a simulação X" sem
  -- dizer quem — dado anônimo, e é o que mantém verdadeiros os números de uso
  -- de uma simulação que rodou de verdade.
  --
  -- O `actor_mbox` ainda identificaria, e a rotina de exclusão o limpa junto.
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'xapi_statements é somente-inserção: statements não se apagam'
      USING HINT = 'Para anular um statement, envie um statement de "voided" apontando para ele.';
  END IF;

  IF OLD.voided_by IS NULL AND NEW.voided_by IS NOT NULL
     AND NEW.raw = OLD.raw
     AND NEW.verb_id = OLD.verb_id
     AND NEW.object_id = OLD.object_id THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'xapi_statements é somente-inserção: statements são imutáveis por definição'
    USING HINT = 'O xAPI define statements como registro do que aconteceu. Use voiding.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS xapi_statements_no_update ON xapi_statements;
CREATE TRIGGER xapi_statements_no_update
  BEFORE UPDATE OR DELETE ON xapi_statements
  FOR EACH ROW EXECUTE FUNCTION xapi_statements_immutable();

COMMIT;

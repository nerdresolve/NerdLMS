-- 025 — Conteúdo interativo (F6-05, guia §4 "conteúdo interativo" e §6 "H5P").
--
-- O guia lista H5P entre os tipos de conteúdo que uma LMS precisa suportar. A
-- decisão do usuário foi construir um player PRÓPRIO com os tipos essenciais,
-- em vez de embarcar a biblioteca oficial — que é GPL, e a proposta exclui
-- licença de terceiro do escopo.
--
-- O QUE ISSO É E O QUE NÃO É:
--
--   É  — vídeo com perguntas no meio, imagem com pontos clicáveis, e cartões
--        de memorização. São os três tipos que respondem ao que o §4 chama de
--        "conteúdo interativo": conteúdo que a pessoa RESPONDE, não só assiste.
--
--   NÃO é H5P de verdade: não importa arquivo `.h5p` nem roda os 50+ tipos da
--        biblioteca. Uma instituição que já tem conteúdo H5P pronto não vai
--        conseguir trazê-lo. Está registrado como lacuna no plano.
--
-- POR QUE UMA TABELA, E NÃO UM JSON NA AULA:
--
-- As respostas precisam ser CONSULTÁVEIS — "quantas pessoas erraram a pergunta
-- dos 4 minutos?" é a pergunta que justifica ter conteúdo interativo em vez de
-- vídeo comum. Guardar tudo num blob deixaria isso fora de alcance.

BEGIN;

-- O conteúdo interativo de uma aula.
CREATE TABLE IF NOT EXISTS interactive_content (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES lessons (id) ON DELETE CASCADE,

  kind text NOT NULL CHECK (kind IN (
    'interactive_video',  -- vídeo com perguntas em pontos do tempo
    'image_hotspots',     -- imagem com regiões clicáveis
    'flashcards'          -- cartões frente/verso
  )),

  title text NOT NULL CHECK (length(btrim(title)) > 0),

  -- A mídia de base: o vídeo ou a imagem. Nulo em flashcards.
  media_key text,
  media_url text,

  -- Quantas interações a pessoa precisa responder para concluir.
  --
  -- NULO É TODAS. Um número menor permite "responda 3 das 5", que é o que faz
  -- sentido em flashcards — decorar 3 cartões já demonstra estudo.
  required_interactions integer CHECK (
    required_interactions IS NULL OR required_interactions > 0
  ),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Vídeo interativo e hotspots precisam de mídia; flashcards não.
  CONSTRAINT interactive_needs_media CHECK (
    kind = 'flashcards' OR media_key IS NOT NULL OR media_url IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS interactive_lesson_idx ON interactive_content (lesson_id);
CREATE INDEX IF NOT EXISTS interactive_tenant_idx ON interactive_content (tenant_id);

-- Uma aula tem no máximo um conteúdo interativo: a aula É o conteúdo.
CREATE UNIQUE INDEX IF NOT EXISTS interactive_one_per_lesson
    ON interactive_content (lesson_id);


-- As interações: as perguntas, os pontos clicáveis, os cartões.
CREATE TABLE IF NOT EXISTS interactive_items (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES interactive_content (id) ON DELETE CASCADE,

  position integer NOT NULL DEFAULT 0,

  -- QUANDO aparece, em segundos — só no vídeo interativo.
  at_seconds integer CHECK (at_seconds IS NULL OR at_seconds >= 0),

  -- ONDE fica, em porcentagem da imagem — só em hotspots.
  --
  -- Porcentagem e não pixel: a imagem é responsiva, e coordenada em pixel
  -- apontaria para o lugar errado em qualquer largura diferente da do editor.
  x_percent numeric(5,2) CHECK (x_percent IS NULL OR (x_percent >= 0 AND x_percent <= 100)),
  y_percent numeric(5,2) CHECK (y_percent IS NULL OR (y_percent >= 0 AND y_percent <= 100)),

  -- O texto da frente: a pergunta, o rótulo do ponto, a frente do cartão.
  prompt text NOT NULL CHECK (length(btrim(prompt)) > 0),

  -- O texto do verso: a explicação, o conteúdo do ponto, o verso do cartão.
  body text,

  -- As alternativas, quando é pergunta. Vazio em hotspot e flashcard.
  --
  -- JSON e não tabela: uma alternativa não existe fora da pergunta, ninguém
  -- consulta alternativa isolada, e uma tabela custaria uma junção em toda
  -- leitura para responder o que o JSON já responde.
  options jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Pausa o vídeo até responder? Só no vídeo interativo.
  --
  -- É a diferença entre pergunta que interrompe e pergunta que passa: a
  -- primeira garante que foi vista, a segunda não atrapalha quem revisa.
  blocking boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS interactive_items_content_idx
    ON interactive_items (content_id, position);


-- As respostas: o que cada pessoa fez em cada interação.
CREATE TABLE IF NOT EXISTS interactive_responses (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES interactive_items (id) ON DELETE CASCADE,

  -- Por MATRÍCULA, não por pessoa: a mesma pessoa pode refazer o curso, e as
  -- respostas de uma edição não devem contar na outra.
  enrollment_id uuid NOT NULL REFERENCES enrollments (id) ON DELETE CASCADE,

  -- O que respondeu. Índice da alternativa, id do hotspot, ou nulo em
  -- flashcard (onde só importa ter visto).
  answer text,

  correct boolean,

  -- Quantas vezes tentou. Interativo permite tentar de novo — o objetivo é
  -- aprender, não medir.
  attempts integer NOT NULL DEFAULT 1 CHECK (attempts > 0),

  first_at timestamptz NOT NULL DEFAULT now(),
  last_at  timestamptz NOT NULL DEFAULT now(),

  -- Uma resposta por interação por matrícula. Tentar de novo atualiza.
  CONSTRAINT interactive_responses_unique UNIQUE (item_id, enrollment_id)
);

CREATE INDEX IF NOT EXISTS interactive_responses_enrollment_idx
    ON interactive_responses (enrollment_id);


-- O tipo de aula `interactive` passa a existir.
ALTER TABLE lessons DROP CONSTRAINT IF EXISTS lessons_kind_check;

ALTER TABLE lessons
  ADD CONSTRAINT lessons_kind_check CHECK (kind = ANY (ARRAY[
    'video', 'pdf', 'slides', 'document', 'spreadsheet',
    'image', 'audio', 'text', 'link', 'scorm',
    'interactive'
  ]));

COMMIT;

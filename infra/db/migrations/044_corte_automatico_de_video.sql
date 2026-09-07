-- 044 — Corte automático do vídeo enviado, em aulas de no máximo 15 minutos.
--
-- O corte existia como FERRAMENTA de linha de comando, rodada à mão sobre os
-- vídeos que já estavam prontos. Vídeo novo entrava inteiro: um arquivo de 56
-- minutos virava uma aula de 56 minutos, e a regra dos 15 valia só para o que
-- alguém lembrasse de cortar antes.
--
-- POR QUE UMA FILA, E NÃO NO MEIO DA REQUISIÇÃO
--
-- Cortar exige baixar o arquivo do storage, ler os quadros-chave, remuxar cada
-- parte e subir de volta. São minutos para um vídeo longo. Fazer isso dentro do
-- POST que registra a aula deixaria o instrutor olhando uma tela travada, e
-- qualquer tempo limite no caminho — proxy, navegador — perderia o trabalho
-- todo com o arquivo já no bucket.
--
-- A fila também é o que faz o corte SOBREVIVER a um reinício. Sem ela, um
-- deploy no meio do processamento deixaria a aula com o vídeo inteiro e
-- ninguém saberia que faltou cortar.
--
-- O ESTADO FICA NA AULA, E NÃO SÓ NA FILA
--
-- `media_status` é o que a tela lê para dizer "dividindo o vídeo". Deixar isso
-- só na fila obrigaria toda leitura de aula a consultar a fila junto — e a
-- aula é lida em toda tela do produto.

BEGIN;

-- 'ready' é o padrão e cobre tudo que já existe: aula sem vídeo, vídeo curto,
-- e os vídeos que a ferramenta já cortou à mão.
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS media_status text NOT NULL DEFAULT 'ready';

DO $$
BEGIN
  ALTER TABLE lessons ADD CONSTRAINT lessons_media_status
    CHECK (media_status IN ('ready', 'splitting', 'failed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS video_split_jobs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- A aula que recebeu o vídeo inteiro. Apagar a aula cancela o trabalho: não
  -- há o que cortar para uma aula que não existe mais.
  lesson_id   uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  course_id   uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,

  -- A chave do arquivo original no storage.
  media_key   text NOT NULL,

  status      text NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'running', 'done', 'failed')),

  -- Quantas vezes já se tentou. O trabalhador desiste depois de algumas: um
  -- vídeo corrompido falharia para sempre, e uma fila que nunca esvazia esconde
  -- os trabalhos que ainda dariam certo.
  attempts    integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),

  -- O que deu errado, para quem for olhar depois. Nulo enquanto vai bem.
  error       text,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- O trabalhador pergunta "o que está pendente?", em ordem de chegada.
CREATE INDEX IF NOT EXISTS video_split_jobs_pendentes
  ON video_split_jobs (status, created_at);

-- Chaves estrangeiras sem índice fazem o CASCADE varrer a tabela.
CREATE INDEX IF NOT EXISTS video_split_jobs_lesson_idx ON video_split_jobs (lesson_id);
CREATE INDEX IF NOT EXISTS video_split_jobs_course_idx ON video_split_jobs (course_id);
CREATE INDEX IF NOT EXISTS video_split_jobs_tenant_idx ON video_split_jobs (tenant_id);

-- Um trabalho por aula enquanto ele não termina. Sem isto, dois cliques em
-- "Aula" com o mesmo arquivo enfileirariam dois cortes do mesmo vídeo, e o
-- segundo trabalharia sobre uma aula que o primeiro já substituiu.
CREATE UNIQUE INDEX IF NOT EXISTS video_split_jobs_um_por_aula
  ON video_split_jobs (lesson_id)
  WHERE status IN ('pending', 'running');

COMMIT;

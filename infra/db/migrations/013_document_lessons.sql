-- 013 — Aula de documento: o curso que se lê, não se assiste.
--
-- O guia §4 pede que a LMS aceite "muito mais que vídeo": texto, HTML, PDF,
-- DOC, XLS, PPT, imagens, áudio, links, ZIP. O produto só atendia vídeo — o
-- tipo `pdf` existia no CHECK da 001 desde sempre e nunca foi implementado.
--
-- O CRITÉRIO DE CONCLUSÃO é o ponto.
--
-- Vídeo conclui com 90% assistido. Documento não tem equivalente óbvio, e o
-- guia §10 lista "visualização" e "tempo mínimo" entre os critérios. Mas um
-- botão que qualquer um clica sem abrir o arquivo não mede nada — e há cursos
-- que existem justamente para a pessoa PASSAR PELO DOCUMENTO INTEIRO.
--
-- Por isso `pages_seen`: quais páginas a pessoa realmente abriu. O botão de
-- concluir só habilita quando ela chegou ao fim de verdade.

BEGIN;

-- Os tipos que o guia pede. `video`, `pdf` e `scorm` já existiam; entram os
-- formatos de escritório, imagem, áudio, texto e link.
--
-- Um CHECK e não uma tabela de tipos: a lista muda com o produto, não com o
-- cliente, e uma tabela convidaria alguém a inventar um tipo que nenhuma tela
-- sabe renderizar.
ALTER TABLE lessons DROP CONSTRAINT IF EXISTS lessons_kind_check;
ALTER TABLE lessons ADD CONSTRAINT lessons_kind_check CHECK (kind IN (
  'video',
  'pdf',
  'slides',     -- PPT/PPTX/ODP
  'document',   -- DOC/DOCX/ODT
  'spreadsheet',-- XLS/XLSX/ODS
  'image',
  'audio',
  'text',       -- texto rico, escrito no editor
  'link',       -- conteúdo externo
  'scorm'
));

-- Conteúdo escrito direto no editor, para a aula de texto. Nulo nos demais
-- tipos, onde o conteúdo é o arquivo.
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS text_content text;

-- URL externa, para a aula de link.
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS external_url text;

-- Quantas páginas o documento tem.
--
-- É o denominador de "chegou ao fim": sem ele, não há como distinguir quem leu
-- as 40 páginas de quem abriu a primeira. Preenchido no envio, quando o
-- servidor conta as páginas do PDF.
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS page_count integer
  CHECK (page_count IS NULL OR page_count > 0);

-- Tempo mínimo na aula, em segundos, antes de poder concluir.
--
-- O guia §10 lista "tempo mínimo" como critério. Vale para os tipos que não
-- têm páginas — imagem, áudio, link — onde não há o que percorrer.
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS min_seconds integer
  CHECK (min_seconds IS NULL OR min_seconds >= 0);

-- --------------------------------------------- páginas efetivamente vistas
--
-- Um array de inteiros, não uma tabela de linhas: são poucas dezenas de
-- números por aula, sempre lidos juntos, e uma tabela daria uma linha por
-- página virada — milhares de linhas para responder "já viu tudo?".
--
-- O array também torna a checagem trivial no banco:
--   cardinality(pages_seen) >= l.page_count
ALTER TABLE lesson_progress
  ADD COLUMN IF NOT EXISTS pages_seen integer[] NOT NULL DEFAULT '{}';

-- Segundos efetivamente na aula. Distinto de `watched_seconds`, que é posição
-- no vídeo: aqui é tempo de permanência, e uma aula de imagem não tem posição.
ALTER TABLE lesson_progress
  ADD COLUMN IF NOT EXISTS seconds_on_page integer NOT NULL DEFAULT 0
  CHECK (seconds_on_page >= 0);

COMMIT;

-- 039 — A trava do player passa a ser decidida por curso.
--
-- Até aqui a trava valia para todo curso: 90% de cobertura, tempo plausível e
-- avanço bloqueado. É o comportamento certo para treinamento obrigatório, e é
-- excessivo para conteúdo informativo, como o comunicado de uma campanha ou a
-- orientação de acesso a um sistema. Quem já sabe usar o ponto eletrônico não
-- precisa assistir a 90% do vídeo para registrar que leu o aviso.
--
-- POR QUE O PADRÃO É LIGADO
--
-- Porque desligado seria afrouxar, de uma vez e em silêncio, todo curso que já
-- existe. A coluna nasce `true` e os sete cursos importados seguem exatamente
-- como estavam; desligar passa a ser um ato deliberado, por curso, registrado
-- em auditoria como qualquer edição.
--
-- A escolha de QUAIS cursos ficam sem trava é da área de treinamento, não do
-- desenvolvimento. Esta migração cria a chave; ela continua ligada em todos.
--
-- O QUE A COLUNA NÃO FAZ
--
-- Ela não desliga o registro de progresso. Sem trava, a aula continua gravando
-- quanto foi assistido e continua concluindo em 90% automaticamente. O que
-- muda é que o avanço deixa de ser bloqueado e a conclusão manual deixa de
-- exigir cobertura. A diferença é entre "não podemos provar que assistiu" e
-- "não registramos nada", e a segunda seria pior para qualquer relatório.

BEGIN;

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS watch_guard boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN courses.watch_guard IS
  'Trava do player: bloqueia avanço e exige cobertura para concluir. '
  'Ligada por padrão; desligar é decisão de treinamento, curso a curso.';

COMMIT;

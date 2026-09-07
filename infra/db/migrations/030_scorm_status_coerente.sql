-- 030 — Uma linha de acompanhamento fala UMA versão do SCORM.
--
-- A migração 029 acrescentou `completion_status` e `success_status` para o
-- 2004, e deixou `lesson_status` como estava: NOT NULL, com default
-- `'not attempted'`.
--
-- O resultado, que só apareceu ao testar contra o banco: uma aula 2004
-- concluída fica com `completion_status = 'completed'` e, ao lado,
-- `lesson_status = 'not attempted'` — o default, que ninguém escreveu e que
-- afirma o contrário. Duas respostas para "esta aula foi concluída?" na mesma
-- linha. Um relatório que leia a coluna do 1.2 diria que ninguém fez a aula.
--
-- A CORREÇÃO NÃO É REMOVER O `NOT NULL`.
--
-- As linhas de pacote 1.2 dependem dele: sem `lesson_status` elas não dizem
-- nada. O que estava errado era o DEFAULT valer para quem não usa a coluna.
--
-- Agora `lesson_status` aceita nulo, e um CHECK garante o que realmente
-- importa: cada linha preenche o vocabulário de UMA versão, e nunca nenhum.

BEGIN;

ALTER TABLE scorm_tracking ALTER COLUMN lesson_status DROP DEFAULT;
ALTER TABLE scorm_tracking ALTER COLUMN lesson_status DROP NOT NULL;

-- Linhas antigas são todas 1.2 — o 2004 não existia quando foram escritas.
UPDATE scorm_tracking
   SET lesson_status = COALESCE(lesson_status, 'not attempted')
 WHERE completion_status IS NULL;

-- Uma versão, nunca as duas, nunca nenhuma.
--
-- Sem a segunda metade, uma linha vazia dos dois lados passaria — e seria um
-- acompanhamento que não acompanha nada, difícil de notar até alguém abrir um
-- relatório e ver a coluna em branco.
-- `ADD CONSTRAINT` não aceita `IF NOT EXISTS`, e o executor roda TODOS os
-- arquivos toda vez: sem o `DROP` antes, reaplicar esta migração falhava aqui
-- com "constraint already exists" — e, com `ON_ERROR_STOP=1`, tudo o que vem
-- depois da 030 nunca chegava a rodar. É a convenção que as outras treze
-- migrações com restrição já seguiam; esta era a única fora dela.
ALTER TABLE scorm_tracking
  DROP CONSTRAINT IF EXISTS scorm_tracking_uma_versao;

ALTER TABLE scorm_tracking
  ADD CONSTRAINT scorm_tracking_uma_versao CHECK (
    (lesson_status IS NOT NULL AND completion_status IS NULL)
    OR
    (lesson_status IS NULL AND completion_status IS NOT NULL)
  );

COMMIT;

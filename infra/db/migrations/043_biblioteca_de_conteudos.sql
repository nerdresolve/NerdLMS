-- 043 — Biblioteca de conteúdos: material que não pertence a uma aula.
--
-- Hoje todo material é anexo de aula: `lesson_id` é obrigatório, e o recorte
-- por cliente vem pela cadeia aula → módulo → curso → tenant. Serve bem para o
-- PDF que acompanha a aula 3.
--
-- Não serve para o que a operação pede: procedimento, norma interna, ficha de
-- segurança — documento que vale por si, que se procura por assunto, e que não
-- está pendurado em nenhuma aula. Hoje o único jeito de publicá-lo seria criar
-- uma aula falsa para segurá-lo.
--
-- UMA TABELA, DOIS USOS
--
-- `lesson_id` passa a ser opcional, e é ele que distingue os dois: preenchido é
-- anexo de aula, nulo é documento de biblioteca. A alternativa era uma segunda
-- tabela, com as mesmas sete colunas, o mesmo upload, a mesma rota de download
-- assinado e a mesma remoção — duas cópias que divergiriam na primeira mudança.
--
-- POR QUE `tenant_id` VIRA COLUNA
--
-- Sem aula não há cadeia até o cliente. O recorte por tenant é a fronteira que
-- nada atravessa, e derivá-lo de uma coluna que agora pode ser nula seria
-- exatamente o jeito de furá-la. A coluna é preenchida para o que já existe e
-- passa a ser obrigatória.
--
-- O TEMA REUSA AS CATEGORIAS DOS CURSOS
--
-- "Segurança", "Operação", "Meio ambiente" já existem em `course_categories` e
-- é assim que a organização nomeia os assuntos dela. Uma lista separada de
-- temas para documentos criaria duas taxonomias para a mesma coisa, e a
-- primeira divergência entre as duas seria a última vez que alguém confiaria em
-- qualquer uma.

BEGIN;

ALTER TABLE materials ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;

-- Preenche o que já existe, pela cadeia que existia até agora.
UPDATE materials m
   SET tenant_id = c.tenant_id
  FROM lessons l
  JOIN modules mo ON mo.id = l.module_id
  JOIN courses c ON c.id = mo.course_id
 WHERE l.id = m.lesson_id
   AND m.tenant_id IS NULL;

ALTER TABLE materials ALTER COLUMN tenant_id SET NOT NULL;

-- Nulo passa a ser válido: é o que marca um documento de biblioteca.
ALTER TABLE materials ALTER COLUMN lesson_id DROP NOT NULL;

-- O assunto, reusando a taxonomia dos cursos. Nulo: sem tema.
ALTER TABLE materials ADD COLUMN IF NOT EXISTS category_id uuid
  REFERENCES course_categories(id) ON DELETE SET NULL;

-- Uma linha sobre o que o documento é. O nome do arquivo raramente basta:
-- "PO-034-rev7.pdf" não diz a ninguém o que tem dentro.
ALTER TABLE materials ADD COLUMN IF NOT EXISTS description text;

-- A biblioteca lê por cliente e ordena por nome; sem índice, cada abertura
-- varre todos os anexos de aula da base junto.
CREATE INDEX IF NOT EXISTS materials_biblioteca_idx
  ON materials (tenant_id, name)
  WHERE lesson_id IS NULL;

-- Chave estrangeira sem índice faz o `SET NULL` da remoção de categoria varrer
-- a tabela inteira.
CREATE INDEX IF NOT EXISTS materials_category_idx ON materials (category_id);
CREATE INDEX IF NOT EXISTS materials_tenant_idx ON materials (tenant_id);

COMMIT;

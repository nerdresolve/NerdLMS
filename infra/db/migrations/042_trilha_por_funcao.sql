-- 042 — Trilha por função, além de trilha por local.
--
-- O RECORTE POR LOCAL JÁ EXISTIA E FUNCIONA
--
-- `tracks.project` recorta a leitura desde a 0xx, e `users.project` é
-- preenchido pelo `department` do Active Directory. Uma trilha de Unidade Central já
-- aparece só para quem é de Unidade Central.
--
-- O QUE FALTAVA
--
-- A função. Quem opera uma válvula e quem assina a permissão de trabalho estão
-- no mesmo local e precisam de treinamentos diferentes — é essa a matriz que a
-- operação pede, e ela tem duas dimensões, não uma.
--
-- O `title` do AD (o cargo) era coletado? Não: a lista de atributos do LDAP o
-- deixava de fora, com a justificativa escrita de que "nenhuma tela deste
-- produto os mostra, e coletar dado sem consumidor é criar exposição sem uso".
-- Era verdade. Agora existe o consumidor, e é esta migração.
--
-- POR QUE TEXTO E NÃO UMA TABELA DE CARGOS
--
-- O cargo vem do diretório, e é lá que ele é gerido. Uma tabela própria aqui
-- criaria um segundo cadastro para manter em dia, e a primeira divergência
-- entre os dois — um cargo renomeado no AD — deixaria a trilha mirando um
-- cargo que não existe mais, em silêncio.
--
-- NULO É "TODO MUNDO", NOS DOIS CAMPOS
--
-- É o que `tracks.project` já significa, e mudar o sentido de um dos dois faria
-- a mesma coluna vazia querer dizer coisas diferentes em campos vizinhos.

BEGIN;

-- A função da pessoa. Vem do `title` do diretório, ou preenchida à mão em quem
-- não vem do AD.
ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title text;

-- A função a que a trilha se destina. Nulo: qualquer função.
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS job_title text;

-- A matriz agrupa gente por função; sem índice, cada abertura da tela varre a
-- tabela de pessoas inteira.
CREATE INDEX IF NOT EXISTS users_job_title_idx ON users (tenant_id, job_title);

COMMIT;

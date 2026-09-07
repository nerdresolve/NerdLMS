-- 036 — O diretório deixa de responder só "pode entrar?" e passa a responder
-- "quem é, e com que papel?".
--
-- POR QUE ISTO REVERTE UMA DECISÃO DA 033
--
-- A 033 diz, com todas as letras, que credencial de serviço não entraria:
-- "guardar uma credencial que abre o diretório inteiro para não usá-la seria
-- criar risco sem contrapartida". A frase estava certa enquanto a premissa
-- valia — o produto só perguntava se a senha batia, e para isso o bind da
-- própria pessoa basta.
--
-- A premissa mudou. O papel de cada um passa a sair dos GRUPOS do Active
-- Directory, e ler `memberOf` exige buscar. Agora há contrapartida, e ela é a
-- razão de usar diretório corporativo: quem é desligado perde o acesso no mesmo
-- dia, sem depender de alguém repetir a baixa em duas telas.
--
-- O RISCO CONTINUA REAL, e o que muda é o que se faz com ele:
--
--   A credencial é OPCIONAL. Vazia, a busca acontece com o vínculo da própria
--   pessoa, que já se autenticou — funciona na maioria dos diretórios, onde
--   usuário autenticado lê a árvore. Ela só é necessária onde a leitura é
--   fechada.
--
--   A senha vai CIFRADA (AES-256-GCM, chave derivada do SESSION_SECRET, que
--   mora no ambiente e não no banco). Um dump copiado não a carrega junto.
--   Contra quem já executa código no servidor não protege, e nenhuma cifragem
--   protegeria — dizer o contrário seria teatro.
--
--   Ela merece ser de LEITURA, e só. Uma conta de serviço com poder de escrita
--   no diretório é a diferença entre um vazamento chato e um incidente.

BEGIN;

ALTER TABLE ldap_directories
  -- O DN com que a busca se autentica. Vazio = usar o vínculo da própria
  -- pessoa. No Active Directory a forma que sempre funciona é
  -- `conta@dominio.local`.
  ADD COLUMN IF NOT EXISTS service_dn text,

  -- Cifrada pelo cofre da aplicação — nunca em claro. O formato começa com
  -- `v1.`, e o CHECK abaixo recusa qualquer coisa que não passe por lá: sem
  -- ele, um `UPDATE` manual bem-intencionado gravaria a senha legível e nada
  -- acusaria.
  ADD COLUMN IF NOT EXISTS service_password text,

  -- Onde a busca começa. Vazio, o código deriva do domínio
  -- (`empresa.local` → `DC=empresa,DC=local`), que é o certo em floresta de um
  -- domínio só. Quem tem árvore grande aponta a OU e economiza a varredura.
  ADD COLUMN IF NOT EXISTS search_base text,

  -- Trazer nome, e-mail e área do diretório a cada acesso.
  --
  -- Ligado por padrão: quem configurou um diretório quer que ele seja a fonte.
  -- Desligado, o cadastro daqui manda — útil para quem já mantém os dados por
  -- outro caminho e não quer que o AD sobrescreva.
  ADD COLUMN IF NOT EXISTS sync_profile boolean NOT NULL DEFAULT true,

  -- Exigir que a pessoa esteja em algum grupo mapeado para entrar.
  --
  -- Desligado por padrão, porque ligado sem mapeamento preenchido trancaria
  -- todo mundo para fora. Ligado, o diretório decide também QUEM entra — que é
  -- o que se quer quando ele tem a empresa inteira e o treinamento é de parte
  -- dela.
  ADD COLUMN IF NOT EXISTS require_group boolean NOT NULL DEFAULT false;

-- Senha de serviço só entra cifrada.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ldap_senha_servico_cifrada'
  ) THEN
    ALTER TABLE ldap_directories
      ADD CONSTRAINT ldap_senha_servico_cifrada
      CHECK (service_password IS NULL OR service_password LIKE 'v1.%');
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- Grupo do diretório → papel aqui dentro.
--
-- Tabela separada porque a relação é de muitos para um: um papel costuma vir de
-- mais de um grupo (o AD de empresa grande tem `LMS_Admin_TI` e
-- `LMS_Admin_RH`), e espremer isso numa coluna de texto separada por vírgula
-- seria criar um formato que só este código sabe ler.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ldap_group_roles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  directory_id uuid NOT NULL REFERENCES ldap_directories (id) ON DELETE CASCADE,

  -- O nome do grupo como aparece no `CN` do `memberOf`. Sem o caminho: quem
  -- configura lê `LMS_Admin` na tela do AD, não
  -- `CN=LMS_Admin,OU=Grupos,DC=...`.
  group_cn text NOT NULL CHECK (length(btrim(group_cn)) > 0),

  role text NOT NULL CHECK (role IN ('admin', 'manager', 'instructor', 'learner')),

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ldap_group_roles_directory_idx ON ldap_group_roles (directory_id);

-- O mesmo grupo não pode apontar para dois papéis no mesmo diretório: a
-- resolução escolheria um dos dois por ordem de leitura, e a tela mostraria os
-- dois como se ambos valessem.
--
-- `lower()` porque o LDAP não diferencia maiúsculas em nome de grupo, e duas
-- linhas com a mesma grafia diferente seriam a mesma regra escrita duas vezes.
CREATE UNIQUE INDEX IF NOT EXISTS ldap_group_roles_unico_idx
  ON ldap_group_roles (directory_id, lower(btrim(group_cn)));

COMMIT;

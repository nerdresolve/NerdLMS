-- =============================================================================
-- Papéis do banco — privilégio mínimo
--
-- A aplicação NÃO usa o dono do schema. Se a aplicação for comprometida via
-- SQL injection, o estrago fica limitado ao que este papel pode fazer — e ele
-- não pode alterar estrutura nem apagar auditoria.
--
-- São dois papéis:
--   lms_migrator — dono do schema, roda migração. Usado só no deploy.
--   lms_app      — o que a aplicação usa. Sem DDL, sem DROP, sem TRUNCATE.
-- =============================================================================

BEGIN;

-- A senha vem de fora, por variável do psql, e nunca fica no arquivo:
--   psql -v app_password="$APP_DB_PASSWORD" -f 002_roles_and_audit.sql
--
-- A primeira versão criava o papel SEM senha, o que obrigava um `ALTER ROLE`
-- manual depois da migração — passo invisível, fácil de esquecer, e o tipo de
-- coisa que só aparece quando a aplicação não conecta.
\if :{?app_password}
\else
  \echo 'ERRO: rode com -v app_password="..." (senha do papel lms_app).'
  \quit 1
\endif

-- A substituição de `:'app_password'` é feita pelo psql, no cliente, ANTES de
-- enviar o comando. Dentro de um bloco `DO $do$ ... $do$` isso NÃO acontece: o
-- corpo é um literal entre cifrões, e o psql não interpola dentro de literais —
-- o texto `:'app_password'` chegava cru ao servidor, que respondia
-- `syntax error at or near ":"`. Era esse o erro, não a falta da senha.
--
-- A saída é montar o comando inteiro fora do bloco: o servidor decide se é
-- CREATE ou ALTER (`format` com %I/%L escapa a senha), o psql interpola a senha
-- numa string comum, e `\gexec` executa o comando resultante.
SELECT format(
         '%s ROLE lms_app LOGIN PASSWORD %L',
         CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lms_app')
              THEN 'ALTER' ELSE 'CREATE' END,
         :'app_password'
       ) \gexec

-- Sem permissão de criar objeto: a aplicação não cria tabela em produção.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO lms_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO lms_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO lms_app;

-- Tabelas criadas depois herdam a mesma regra, para uma migração futura não
-- abrir buraco por esquecimento.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO lms_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO lms_app;

-- -----------------------------------------------------------------------------
-- Auditoria é somente-inserção
--
-- Isto é o que faz o registro valer alguma coisa. Sem UPDATE e sem DELETE nem
-- para a aplicação: quem consegue apagar o próprio rastro não deixa rastro.
-- -----------------------------------------------------------------------------

REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM lms_app;
GRANT SELECT, INSERT ON audit_log TO lms_app;

-- Defesa em profundidade: mesmo que alguém conceda UPDATE por engano numa
-- migração futura, o gatilho recusa.
CREATE OR REPLACE FUNCTION audit_log_is_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log é somente-inserção: % recusado', TG_OP
    USING HINT = 'Registro de auditoria alterável não prova nada. Ver DEC-048.';
END;
$$;

-- `OR REPLACE` para a migração poder ser reaplicada sobre um banco que já a
-- recebeu — sem isso, rodar `npm run migrate` duas vezes falha com
-- "trigger já existe" e interrompe tudo que vem depois.
CREATE OR REPLACE TRIGGER audit_log_no_update
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_is_append_only();

-- -----------------------------------------------------------------------------
-- Retenção de dados efêmeros
--
-- Sessão expirada, token usado e tentativa de login antiga não servem para
-- nada e viram passivo. A limpeza é responsabilidade de uma rotina agendada;
-- as funções ficam aqui para não haver DELETE solto na aplicação.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION purge_expired_sessions() RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE removed bigint;
BEGIN
  DELETE FROM sessions WHERE expires_at < now();
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;

CREATE OR REPLACE FUNCTION purge_old_login_attempts(keep_days integer DEFAULT 30) RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE removed bigint;
BEGIN
  DELETE FROM login_attempts WHERE at < now() - make_interval(days => keep_days);
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;

GRANT EXECUTE ON FUNCTION purge_expired_sessions() TO lms_app;
GRANT EXECUTE ON FUNCTION purge_old_login_attempts(integer) TO lms_app;

COMMIT;

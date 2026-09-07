-- 018 — Categoria de questão é única por cliente, pelo nome.
--
-- A importação de questões em massa (F5-05, guia §24) traz a categoria pelo
-- NOME — "Tratamento", "Operação" —, porque ninguém preenche uuid numa
-- planilha. Ela cria a categoria que ainda não existe e reaproveita a que já
-- existe, e sem esta restrição as duas coisas não dão para fazer com segurança:
--
--   * `ON CONFLICT (tenant_id, name)` exige que o par SEJA único; sem o índice,
--     a instrução falha em tempo de execução, e não na revisão.
--   * "verificar e depois inserir" tem uma janela real entre as duas: duas
--     importações simultâneas do mesmo arquivo criariam "Tratamento" duas
--     vezes, e as questões ficariam divididas entre duas categorias iguais.
--
-- E, antes de tudo isso: duas categorias com o mesmo nome no mesmo cliente já
-- são um defeito por si só. Quem filtra por assunto encontraria metade das
-- questões e não teria como saber que a outra metade existe.
--
-- COMPARAÇÃO SEM CAIXA E SEM ESPAÇO NAS PONTAS: "Tratamento", "tratamento" e
-- "Tratamento " são o mesmo assunto para quem lê. Um índice sobre `name` cru
-- deixaria as três coexistirem, que é exatamente o problema que esta migração
-- existe para impedir.
--
-- O índice é criado sem CONCURRENTLY porque roda dentro da transação da
-- migração, como as anteriores. A tabela é pequena — categorias de questão são
-- dezenas por cliente, não milhões — e o bloqueio dura o que dura um COUNT.

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS question_categories_tenant_name_key
    ON question_categories (tenant_id, lower(btrim(name)));

COMMIT;

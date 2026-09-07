-- 032 — O identificador de fetch do cmi5 é de uso único.
--
-- O cmi5 define que o conteúdo BUSCA a credencial num endereço, em vez de
-- recebê-la pronta na URL de launch. A razão é concreta: a URL do iframe
-- aparece no histórico do navegador e no `Referer` de tudo que o conteúdo
-- carregar, e uma credencial ali é uma credencial em texto em dois lugares que
-- não controlamos.
--
-- A busca vale UMA vez. Um segundo pedido com o mesmo identificador significa
-- que alguém copiou a URL — e a resposta é recusa, não uma segunda cópia do
-- token.

BEGIN;

ALTER TABLE cmi5_sessions ADD COLUMN IF NOT EXISTS fetched_at timestamptz;

COMMIT;

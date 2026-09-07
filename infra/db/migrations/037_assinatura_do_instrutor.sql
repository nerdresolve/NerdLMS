-- 037 — A assinatura do instrutor no certificado.
--
-- O certificado trazia uma régua de três cores sobre a linha de assinatura,
-- com o comentário do código dizendo, com todas as letras, que ela "não
-- representa ninguém": identificava o documento como emitido pela plataforma, e
-- quem dava fé era o código de verificação.
--
-- Passa a trazer a assinatura de quem ensinou. É outro tipo de documento: o que
-- a plataforma atesta é que as aulas foram concluídas; o que uma assinatura
-- atesta é que alguém se responsabiliza pelo que foi ensinado.
--
-- POR QUE OS BYTES FICAM NO BANCO, E NÃO NO STORAGE
--
-- O PDF não sabe ler PNG. Ele aceita imagem como amostras cruas — RGB de 8
-- bits comprimido com Flate —, e converter é trabalho: decodificar o PNG,
-- desfazer o filtro de cada linha e achatar a transparência sobre branco.
--
-- Isso é feito UMA VEZ, no envio, e o resultado é o que fica gravado aqui.
-- Guardar o PNG no storage obrigaria a repetir a conversão a cada certificado
-- emitido, somando uma ida à rede e um decode a algo que é sempre igual.
--
-- O tamanho justifica a escolha: uma assinatura digitalizada tem alguns
-- quilobytes, e o CHECK abaixo recusa acima de 512 kB depois de convertida.
-- Fosse uma foto de perfil, a resposta seria outra.
--
-- O ORIGINAL NÃO É GUARDADO. Quem quiser trocar a assinatura envia de novo —
-- que é a operação natural — e mudanças futuras no layout trabalham com o que
-- está aqui. Guardar as duas formas seria manter dois estados do mesmo dado,
-- com a certeza de que um dia divergem.

BEGIN;

ALTER TABLE users
  -- RGB comprimido com Flate, em base64. Nunca o PNG original.
  ADD COLUMN IF NOT EXISTS signature_data text,
  -- Dimensões em pixels: o PDF precisa delas para montar o XObject, e derivá-las
  -- de novo exigiria decodificar o que já foi decodificado.
  ADD COLUMN IF NOT EXISTS signature_width integer,
  ADD COLUMN IF NOT EXISTS signature_height integer,
  ADD COLUMN IF NOT EXISTS signature_updated_at timestamptz;

-- Os três campos andam juntos ou não existem. Metade preenchida produziria um
-- XObject com dimensão nula, e o leitor de PDF ignora a imagem EM SILÊNCIO — o
-- certificado sairia sem assinatura e sem nada indicando por quê.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_assinatura_completa'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_assinatura_completa CHECK (
        (signature_data IS NULL AND signature_width IS NULL AND signature_height IS NULL)
        OR (signature_data IS NOT NULL
            AND signature_width  IS NOT NULL AND signature_width  > 0
            AND signature_height IS NOT NULL AND signature_height > 0
            AND length(signature_data) <= 524288)
      );
  END IF;
END
$$;

COMMIT;

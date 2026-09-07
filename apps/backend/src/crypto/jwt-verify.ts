import { createPublicKey, createVerify } from "node:crypto";

/**
 * Verificação de assinatura RS256.
 *
 * Mora fora de `lti/` porque dois protocolos dependem dela: o LTI, para
 * conferir a resposta de uma ferramenta no Deep Linking, e o SSO, para conferir
 * o `id_token` do provedor de identidade. Deixá-la no LTI faria o login
 * corporativo importar de um módulo com o qual não tem relação nenhuma.
 */
export function verifyRs256(token: string, jwk: Record<string, unknown>): boolean {
  const partes = token.split(".");
  if (partes.length !== 3) return false;

  try {
    const publica = createPublicKey({ key: jwk as never, format: "jwk" });

    const verificador = createVerify("RSA-SHA256");
    verificador.update(`${partes[0]}.${partes[1]}`);
    verificador.end();

    return verificador.verify(publica, Buffer.from(partes[2]!, "base64url"));
  } catch {
    /* Chave malformada, algoritmo diferente, base64 inválido: tudo isso é
       "não confere", não exceção. Deixar vazar faria uma resposta malformada
       virar erro 500 nosso. */
    return false;
  }
}

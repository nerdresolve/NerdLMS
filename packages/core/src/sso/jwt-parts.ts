/**
 * Leitura de segmentos de JWT.
 *
 * Um segmento é JSON em base64url. Separado num arquivo próprio porque tanto o
 * OIDC quanto quem valida assinatura precisam dele, e nenhum dos dois deveria
 * depender do outro.
 */

export function decodeJwtSegment(segment: string): unknown {
  try {
    /* base64url troca dois caracteres do base64 e dispensa o preenchimento;
       `Buffer` com "base64url" trata os dois casos. */
    const json = Buffer.from(segment, "base64url").toString("utf8");
    return JSON.parse(json);
  } catch {
    /* Segmento adulterado ou truncado. Devolver `null` deixa quem chamou
       decidir a mensagem — aqui não há contexto para escrever uma boa. */
    return null;
  }
}

import {
  createPrivateKey,
  createPublicKey,
  createSign,
  generateKeyPairSync,
  randomUUID,
} from "node:crypto";

import { verifyRs256 } from "../crypto/jwt-verify.ts";

import { query } from "../db/pool.ts";

/**
 * Chaves e JWT do LTI 1.3 — F6-04 (guia §27).
 *
 * **A chave privada fica no banco.** Foi decisão do usuário, e é o padrão de
 * mercado para LMS. A implicação, escrita aqui para quem operar: quem tem
 * acesso ao banco consegue assinar tokens em nome desta plataforma.
 *
 * O que se pôde fazer para reduzir o dano está feito:
 *
 *   * A chave é POR CLIENTE — o vazamento de uma não compromete as outras.
 *   * É ROTACIONÁVEL sem quebrar o histórico: o JWKS publica todas, e só a
 *     ativa assina, então um token antigo continua verificável.
 *   * Nunca sai daqui: nenhuma função devolve a chave privada, só assinaturas.
 *
 * Ao contrário do Open Badges — onde escolhi verificação hospedada justamente
 * por não haver onde guardar chave —, no LTI a assinatura não é opcional: o
 * padrão é OIDC + JWT. Era assinar ou não ter LTI.
 */

export interface LtiKey {
  id: string;
  kid: string;
  publicKey: string;
}

/**
 * A chave ativa do cliente, criando uma se ainda não houver.
 *
 * Cria sob demanda em vez de exigir um passo de configuração: um cliente que
 * registra a primeira ferramenta não deveria descobrir, no meio, que falta
 * gerar chave.
 */
export async function activeKeyOf(tenantId: string): Promise<LtiKey> {
  const existente = await query<{ id: string; kid: string; public_key: string }>(
    `SELECT id, kid, public_key FROM lti_keys
      WHERE tenant_id = $1 AND active
      LIMIT 1`,
    [tenantId],
  );

  if (existente[0]) {
    return {
      id: existente[0].id,
      kid: existente[0].kid,
      publicKey: existente[0].public_key,
    };
  }

  /* RS256 com 2048 bits: é o que o LTI 1.3 exige e o que toda ferramenta
     certificada aceita. Chave menor seria recusada; maior custaria em cada
     launch sem ganho prático. */
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  const kid = randomUUID();

  const criada = await query<{ id: string }>(
    `INSERT INTO lti_keys (tenant_id, kid, private_key, public_key)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (tenant_id) WHERE active DO NOTHING
     RETURNING id`,
    [tenantId, kid, privateKey, publicKey],
  );

  /* Sem linha: outra requisição criou a chave entre a leitura e a escrita.
     Ler de novo é o certo — duas chaves ativas seria pior. */
  if (!criada[0]) return activeKeyOf(tenantId);

  return { id: criada[0].id, kid, publicKey };
}

/** Todas as chaves do cliente — a ativa e as aposentadas, para o JWKS. */
export async function allKeysOf(tenantId: string): Promise<LtiKey[]> {
  const rows = await query<{ id: string; kid: string; public_key: string }>(
    `SELECT id, kid, public_key FROM lti_keys
      WHERE tenant_id = $1
      ORDER BY active DESC, created_at DESC`,
    [tenantId],
  );

  return rows.map((row) => ({ id: row.id, kid: row.kid, publicKey: row.public_key }));
}

/** Base64url, como o JWT define — sem `+`, `/` nem `=`. */
function base64url(dado: Buffer | string): string {
  /* `Buffer.from` não aceita a união num overload só: texto e bytes têm
     assinaturas diferentes, e a de texto precisa da codificação. */
  const bytes = typeof dado === "string" ? Buffer.from(dado, "utf8") : dado;

  return bytes
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Assina um JWT RS256.
 *
 * A chave privada é lida do banco e usada aqui dentro — não sai da função, e
 * nenhuma outra a devolve.
 */
export async function signJwt(
  tenantId: string,
  claims: Record<string, unknown>,
): Promise<string> {
  const chave = await activeKeyOf(tenantId);

  const rows = await query<{ private_key: string }>(
    `SELECT private_key FROM lti_keys WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
    [chave.id, tenantId],
  );

  const privada = rows[0]?.private_key;
  if (!privada) throw new Error("Chave LTI não encontrada.");

  /* O `kid` no cabeçalho é o que diz à ferramenta qual chave usar para
     conferir — sem ele, a rotação quebraria todo token em trânsito. */
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT", kid: chave.kid }));
  const payload = base64url(JSON.stringify(claims));

  const assinador = createSign("RSA-SHA256");
  assinador.update(`${header}.${payload}`);
  assinador.end();

  const assinatura = base64url(assinador.sign(createPrivateKey(privada)));

  return `${header}.${payload}.${assinatura}`;
}

/**
 * A chave pública em JWK, para o JWKS.
 *
 * O formato é o que o padrão define: `n` e `e` em base64url, mais `kid` e o
 * uso. Uma ferramenta busca este documento para conferir o que assinamos.
 */
export function toJwk(publicKeyPem: string, kid: string): Record<string, unknown> {
  const jwk = createPublicKey(publicKeyPem).export({ format: "jwk" }) as {
    n?: string;
    e?: string;
  };

  return {
    kty: "RSA",
    use: "sig",
    alg: "RS256",
    kid,
    n: jwk.n,
    e: jwk.e,
  };
}

export interface DecodedJwt {
  header: Record<string, unknown>;
  claims: Record<string, unknown>;
}

/**
 * Lê um JWT SEM conferir a assinatura.
 *
 * Existe porque é preciso ler o `kid` e o `iss` ANTES de saber qual chave usar
 * para verificar. **O que sai daqui não é confiável** — quem chama tem de
 * verificar antes de acreditar, e é por isso que o nome diz `unsafe`.
 */
export function decodeJwtUnsafe(token: string): DecodedJwt | null {
  const partes = token.split(".");
  if (partes.length !== 3) return null;

  try {
    const header = JSON.parse(Buffer.from(partes[0]!, "base64url").toString("utf8"));
    const claims = JSON.parse(Buffer.from(partes[1]!, "base64url").toString("utf8"));

    if (typeof header !== "object" || typeof claims !== "object") return null;

    return { header, claims };
  } catch {
    return null;
  }
}

/**
 * Confere a assinatura de um JWT contra uma chave pública em JWK.
 *
 * Usada no Deep Linking: a ferramenta responde assinada, e conferir é o que
 * impede alguém de forjar "o instrutor escolheu este conteúdo".
 *
 * A verificação em si mora em `crypto/jwt-verify.ts`, compartilhada com o SSO —
 * duas cópias da mesma conferência acabariam divergindo, e a que ficasse para
 * trás seria a insegura.
 */
export function verifyJwt(token: string, jwk: Record<string, unknown>): boolean {
  return verifyRs256(token, jwk);
}

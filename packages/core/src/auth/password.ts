/**
 * Hash de senha — scrypt.
 *
 * **Por que não Argon2id**, que a coluna `password_hash` menciona: o
 * `crypto.argon2Sync` nativo só existe a partir do Node 24, e a imagem da
 * aplicação roda `node:22-alpine`. Usá-lo compilava na máquina de quem
 * desenvolve (Node 24) e quebrava o build da imagem — o pior tipo de
 * divergência, porque só aparece no fim.
 *
 * scrypt é a alternativa correta, não um consolo: está na mesma recomendação da
 * OWASP para hash de senha, é resistente a hardware dedicado pelo custo de
 * memória, e vem no Node desde a v10. Sem dependência externa numa superfície
 * onde dependência é risco.
 *
 * O formato de saída segue o padrão PHC (`$scrypt$ln=,r=,p=$salt$hash`), o
 * mesmo que outras implementações leem — se a verificação sair do Node um dia,
 * o hash continua válido. Trocar para Argon2id depois é possível sem migração
 * dolorosa: o prefixo identifica o algoritmo, então os dois podem coexistir.
 */

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Parâmetros de custo, nos valores recomendados pela OWASP para scrypt:
 * N = 2^17 (131072), r = 8, p = 1 — cerca de 128 MiB por verificação.
 *
 * Ficam aqui, num lugar só, porque subir custo é decisão que se toma uma vez.
 * O hash guarda os parâmetros com que foi gerado, então senhas antigas
 * continuam verificáveis depois de mudarmos estes números.
 */
const LOG_N = 17;
const BLOCK_SIZE = 8;
const PARALLELISM = 1;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

/** `scrypt` precisa de teto de memória explícito acima do padrão de 32 MiB. */
const maxmem = (logN: number, r: number) => 256 * (1 << logN) * r * 2;

/** Base64 sem padding, como o formato PHC exige. */
const toB64 = (buffer: Buffer): string => buffer.toString("base64").replace(/=+$/, "");
const fromB64 = (value: string): Buffer => Buffer.from(value, "base64");

/** Gera o hash PHC de uma senha em texto puro. */
export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const derived = scryptSync(password.normalize("NFC"), salt, KEY_LENGTH, {
    N: 1 << LOG_N,
    r: BLOCK_SIZE,
    p: PARALLELISM,
    maxmem: maxmem(LOG_N, BLOCK_SIZE),
  });

  return `$scrypt$ln=${LOG_N},r=${BLOCK_SIZE},p=${PARALLELISM}$${toB64(salt)}$${toB64(derived)}`;
}

/**
 * Confere uma senha contra o hash guardado.
 *
 * Os parâmetros vêm do próprio hash, não das constantes acima: é isso que
 * permite trocar o custo sem invalidar as senhas já cadastradas.
 *
 * A comparação final usa `timingSafeEqual` — comparar com `===` vazaria, pelo
 * tempo de resposta, quantos bytes iniciais estavam certos.
 */
export function verifyPassword(password: string, stored: string): boolean {
  const match = /^\$scrypt\$ln=(\d+),r=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/.exec(stored);
  if (!match) return false;

  const [, logN, r, p, saltB64, hashB64] = match;
  const expected = fromB64(hashB64!);
  const nLog = Number(logN);
  const blockSize = Number(r);

  /* Um hash corrompido pode pedir memória absurda; recusar antes de alocar
     evita que a verificação vire negação de serviço. */
  if (nLog < 1 || nLog > 20 || blockSize < 1 || blockSize > 32) return false;

  let actual: Buffer;
  try {
    actual = scryptSync(password.normalize("NFC"), fromB64(saltB64!), expected.length, {
      N: 1 << nLog,
      r: blockSize,
      p: Number(p),
      maxmem: maxmem(nLog, blockSize),
    });
  } catch {
    return false;
  }

  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

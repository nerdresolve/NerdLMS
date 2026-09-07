import { createHash } from "node:crypto";

/**
 * UUID determinístico a partir de um id do mock (`"u1"`, `"c1-m1"`).
 *
 * O schema usa `uuid` em toda chave e o mock usa strings curtas. Derivar em vez
 * de sortear garante que `c1` seja sempre o mesmo UUID — é o que permite o seed
 * ser reaplicado com `ON CONFLICT (id)` sem duplicar nada, e é o que permite
 * traduzir o id da sessão de volta para o id do mock enquanto os dois mundos
 * coexistem (TASK-006).
 *
 * A função vive aqui, e não dentro do gerador de seed, porque **os dois lados
 * precisam concordar**: `infra/tools/build-seed.mjs` a usa para escrever o SQL,
 * e `repository.ts` a usa para ler. Duas cópias divergiriam em silêncio.
 *
 * Some junto com `src/mocks/` quando o banco for a única fonte.
 */

/** Namespace fixo. Mudar este valor troca todos os UUIDs derivados. */
const NAMESPACE = "6f0c9d3e-1a2b-4c5d-8e9f-0a1b2c3d4e5f";

export function uuidForMockId(key: string): string {
  const hash = createHash("sha1")
    .update(Buffer.from(NAMESPACE.replace(/-/g, ""), "hex"))
    .update(String(key), "utf8")
    .digest();

  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x50; // versão 5
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // variante RFC 4122

  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

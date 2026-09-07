/**
 * Roda `db/checks/imutabilidade.sql` contra o banco que estiver de pé.
 *
 * POR QUE UMA FERRAMENTA E NÃO UMA LINHA NO package.json
 *
 * A linha existia e não sobreviveu: o comando precisa de aspas dentro de aspas
 * (`sh -c 'psql -U "$POSTGRES_USER" …'`) e passa por duas camadas de npm, que
 * comem um par pelo caminho. Aqui os argumentos vão como lista para o
 * `spawnSync` e não há shell no meio para interpretar nada — o mesmo motivo
 * pelo qual `cenario-demo.mjs` faz assim.
 *
 * O que o SQL verifica está documentado nele. Em resumo: as frestas que a
 * migração 040 abriu nos gatilhos de imutabilidade continuam sendo só o que
 * dizem ser. Nada é alterado — o arquivo termina em ROLLBACK.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const projeto = process.env.COMPOSE_PROJECT_NAME ?? "nerdlms-local";
const sql = readFileSync(join(raiz, "db/checks/imutabilidade.sql"), "utf8");

/* `spawnSync` e não `execFileSync` porque o relato vem pelo STDERR: o `psql`
   manda NOTICE e WARNING para lá, e `execFileSync` devolve só o stdout — a
   verificação passava calada, sem dizer o que tinha verificado. */
const r = spawnSync(
  "docker",
  [
    "exec", "-i", `${projeto}-db-1`,
    "psql", "-U", "lms_migrator", "-d", "lms",
    "-v", "ON_ERROR_STOP=1", "-q", "-f", "-",
  ],
  { input: sql, encoding: "utf8" },
);

if (r.error) {
  console.error(`Não foi possível falar com o contêiner ${projeto}-db-1: ${r.error.message}`);
  console.error("Suba o ambiente com `npm run up` antes.");
  process.exit(1);
}

/* O prefixo `psql:<stdin>:NNN: NOTICE:` é ruído: o número da linha do arquivo
   não ajuda quem lê o resultado de uma verificação. */
const linhas = (r.stderr ?? "")
  .split("\n")
  .map((linha) => linha.replace(/^psql:[^:]*:\d+:\s*(NOTICE|WARNING):\s*/, "  "))
  .filter((linha) => linha.trim());

for (const linha of linhas) console.log(linha);

if (r.status !== 0) {
  console.error("\nFALHOU: a imutabilidade não está preservada.");
  process.exit(1);
}

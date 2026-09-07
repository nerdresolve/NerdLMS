/**
 * Chama um script Python com o interpretador que existir nesta máquina.
 *
 * Os scripts eram invocados como `python3 tools/perf.py`. No Linux e no macOS
 * isso está certo — `python` costuma ser Python 2 ou nem existir. No Windows é
 * o contrário: o interpretador é `python`, e `python3` existe apenas como um
 * atalho da Microsoft Store que NÃO executa nada — imprime um convite a
 * instalar e sai com erro.
 *
 * Resultado: `npm run verify` era impossível de completar no Windows, e o
 * portão mais caro do projeto (perf, capturas) só rodava para quem estivesse
 * no sistema certo. Aqui a escolha é feita em tempo de execução, testando os
 * candidatos de verdade em vez de supor pelo sistema operacional — o atalho da
 * Store só se revela quando é chamado.
 *
 * Uso: node tools/py.mjs tools/perf.py [args...]
 */
import { spawnSync } from "node:child_process";

const [, , script, ...args] = process.argv;

if (!script) {
  console.error("uso: node tools/py.mjs <script.py> [args...]");
  process.exit(2);
}

/* `python3` primeiro: onde ele funciona de verdade, é o nome correto. */
const candidatos = ["python3", "python", "py"];

for (const interpretador of candidatos) {
  /* `-c pass` é o teste: o atalho da Microsoft Store aceita ser encontrado no
     PATH mas falha ao executar qualquer coisa. Só perguntar "existe?" não
     distingue os dois casos. */
  const teste = spawnSync(interpretador, ["-c", "pass"], { stdio: "ignore", shell: false });
  if (teste.error || teste.status !== 0) continue;

  const execucao = spawnSync(interpretador, [script, ...args], { stdio: "inherit", shell: false });
  process.exit(execucao.status ?? 1);
}

console.error(
  `Nenhum Python executável encontrado (tentei: ${candidatos.join(", ")}).\n` +
    `${script} precisa de Python 3 com playwright instalado — ver o cabeçalho do arquivo.`,
);
process.exit(1);

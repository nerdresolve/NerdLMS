/**
 * Publica as capturas de `shots/` em `docs/telas/`, com o nome que o pacote de
 * entrega usa — perfil e ordem de leitura, não o nome interno da rota.
 *
 * Existe porque essa renomeação era manual, e manual ela ficava para trás: as
 * imagens de `docs/telas/` continuavam mostrando a marca anterior depois de o
 * produto já ter trocado de identidade. `shots/` é ignorado pelo Git — é saída
 * de trabalho —, enquanto `docs/telas/` é versionado e vai no pacote.
 *
 * Uso: node tools/telas.mjs   (depois de `npm run preview && npm run shots`)
 */
import { copyFile, mkdir, readdir, stat, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const origem = join(root, "shots");
const destino = join(root, "..", "..", "docs", "telas");

/* A ordem É o conteúdo: numera pela jornada — público, aluno, instrutor,
   gestor, admin —, não pela ordem em que as telas foram construídas. */
const TELAS = [
  ["landing", "01-acesso-inicial"],
  ["login", "02-login"],
  ["dashboard", "03-aluno-painel"],
  ["tracks", "04-aluno-trilhas-e-recomendados"],
  ["rewards", "05-aluno-conquistas"],
  ["agenda", "06-aluno-agenda"],
  ["catalog", "07-aluno-meus-cursos"],
  ["library", "08-aluno-todos-os-cursos"],
  ["completed", "09-aluno-concluidos"],
  ["favorites", "10-aluno-favoritos"],
  ["course", "11-aluno-curso"],
  ["lesson", "12-aluno-aula-e-comentarios"],
  ["profile", "13-aluno-perfil"],
  ["studio", "14-instrutor-cursos"],
  ["editor", "15-instrutor-editor"],
  ["engagement", "16-instrutor-engajamento"],
  ["manager", "17-gestor-painel"],
  ["team", "18-gestor-equipe"],
  ["admin", "19-admin-painel"],
  ["users", "20-admin-usuarios"],
  ["audit", "21-admin-auditoria"],
];

const VIEWPORTS = ["desktop", "mobile"];

try {
  await stat(origem);
} catch {
  console.error("shots/ não existe — rode `npm run preview && npm run shots` antes.");
  process.exit(1);
}

await mkdir(destino, { recursive: true });

/* Apaga o que estava lá antes de copiar. Sem isto, uma tela que sai do produto
   deixa a imagem órfã no pacote de entrega, e quem abre a pasta acredita nela.
   O README fica: é texto, não captura. */
for (const nome of await readdir(destino)) {
  if (nome.endsWith(".png")) await unlink(join(destino, nome));
}

let copiadas = 0;
const faltando = [];

for (const [pagina, rotulo] of TELAS) {
  for (const viewport of VIEWPORTS) {
    const de = join(origem, `${pagina}-${viewport}.png`);
    try {
      await copyFile(de, join(destino, `${rotulo}-${viewport}.png`));
      copiadas += 1;
    } catch {
      faltando.push(`${pagina}-${viewport}.png`);
    }
  }
}

console.log(`docs/telas: ${copiadas} imagens publicadas`);

if (faltando.length > 0) {
  console.error(`  FALTANDO em shots/: ${faltando.join(", ")}`);
  process.exit(1);
}

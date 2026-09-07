/**
 * Envia os vídeos dos cursos reais para o storage.
 *
 * POR QUE OS VÍDEOS NÃO ESTÃO NO REPOSITÓRIO
 *
 * São meio gigabyte de MP4. O Git guarda toda versão de todo binário para
 * sempre: trocar um vídeo dobraria o peso, e desfazer exigiria reescrever o
 * histórico. Todo mundo que clonasse baixaria isso, e a imagem também.
 *
 * O storage é o lugar deles — é de onde o player já lê, por URL assinada, e é
 * onde o upload da interface já os coloca. O repositório fica com a chave que
 * os aponta, em `infra/db/content/cursos.json`.
 *
 * Usa o `mc` num contêiner descartável, na mesma rede do MinIO: não exige
 * instalar nada na máquina, e é o mesmo cliente que cria o bucket na subida.
 *
 * Uso: node infra/tools/upload-cursos.mjs <pasta com CURSOS> [projeto]
 */
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const origem = process.argv[2];
const projeto = process.argv[3] ?? "nerdlms-local";

if (!origem) {
  console.error("uso: node infra/tools/upload-cursos.mjs <pasta com CURSOS> [projeto]");
  process.exit(2);
}

const conteudo = join(raiz, "infra", "db", "content", "cursos.json");
if (!existsSync(conteudo)) {
  console.error(`Rode antes: node infra/tools/parse-cursos.mjs "${origem}"`);
  process.exit(1);
}

const docker = (args) => execFileSync("docker", args, { encoding: "utf8" }).trim();

/* Credenciais e bucket saem do ambiente da PRÓPRIA pilha. Repetir os valores
   aqui criaria uma segunda verdade, que envelhece na primeira troca de senha. */
let rede;
let acesso;
let segredo;
let bucket;

try {
  rede = docker([
    "inspect", `${projeto}-storage-1`,
    "--format", "{{range $k,$v := .NetworkSettings.Networks}}{{$k}}\n{{end}}",
  ]).split("\n")[0].trim();

  acesso = docker(["exec", `${projeto}-storage-1`, "printenv", "MINIO_ROOT_USER"]);
  segredo = docker(["exec", `${projeto}-storage-1`, "printenv", "MINIO_ROOT_PASSWORD"]);
  bucket = docker(["exec", `${projeto}-app-1`, "printenv", "STORAGE_BUCKET"]);
} catch {
  console.error(`Não achei a pilha "${projeto}" no ar. Suba com \`npm run up\`.`);
  process.exit(1);
}

const { cursos } = JSON.parse(readFileSync(conteudo, "utf8"));

/* Um contêiner só para todos os envios: subir e derrubar por arquivo custaria
   mais tempo em processo do que em rede. */
const comandos = [
  `mc alias set destino http://storage:9000 '${acesso}' '${segredo}' > /dev/null`,
  /* Uma aula por arquivo: o material cortado em partes de 15 minutos tem
     várias por curso, e cada uma é um objeto próprio no storage. */
  ...cursos.flatMap((curso) => curso.aulas).map((aula) => {
    /* A pasta vem do PRÓPRIO conteúdo, não de uma regra montada aqui.

       A versão anterior deduzia: com prova ia para `com-prova/<codigo>`, sem
       prova ia para `sem-prova` solto. Quando a origem passou a ter subpasta
       também no `sem-prova`, a dedução ficou errada e os dois vídeos subiram
       com chave que o banco não procura — a aula abria vazia e nada acusava.
       O parser já sabe onde cada arquivo está; basta ele dizer. */
    return (
      `mc cp --quiet "/origem/${aula.pasta}/${aula.arquivo}" ` +
      `"destino/${bucket}/${aula.mediaKey}" && echo "  ok ${aula.arquivo}"`
    );
  }),
];

const aulas = cursos.flatMap((curso) => curso.aulas);
console.log(`storage: rede ${rede}, bucket ${bucket}, ${aulas.length} vídeos`);

execFileSync(
  "docker",
  [
    "run", "--rm", "-i",
    "--network", rede,
    "-v", `${origem}:/origem:ro`,
    "--entrypoint", "/bin/sh",
    "minio/mc:latest", "-s",
  ],
  { input: comandos.join("\n"), stdio: ["pipe", "inherit", "inherit"] },
);

const total = aulas.reduce((soma, a) => soma + a.bytes, 0);
console.log(`\n${(total / 1048576).toFixed(0)} MB no bucket, fora do Git.`);

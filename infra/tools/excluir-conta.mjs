/**
 * Exclusão de conta — o direito à eliminação da LGPD.
 *
 * POR QUE UMA FERRAMENTA E NÃO UM BOTÃO
 *
 * `deleteUserAccount` existe no backend desde sempre e não é chamado por
 * nenhuma tela: procurar por ele no repositório devolve só a própria
 * definição. Isso é deliberado — o comentário da função diz que apagar uma
 * pessoa "só faz sentido quando o titular exerce o direito de eliminação, e
 * por isso não é um botão qualquer da tela de usuários". Desativar continua
 * sendo o caminho normal, e é o que a tela oferece.
 *
 * Mas um caminho que ninguém chama também é um caminho que ninguém testa. Este
 * arquivo é a forma de exercê-lo quando um pedido de eliminação chega, e foi
 * como se descobriu que ele não funcionava: o gatilho de auditoria recusava o
 * `SET NULL` da chave estrangeira, e toda conta que já tinha entrado uma vez
 * era indelével. A migração 040 abriu a fresta exata para a anonimização.
 *
 * O QUE ELE RECUSA
 *
 * Comentário e curso são `RESTRICT` no schema: apagar levaria junto a conversa
 * de uma aula ou um curso que outras pessoas estão fazendo. Nesse caso a
 * função devolve `blocked` com a contagem, e quem for decidir sabe o que está
 * no caminho.
 *
 *   docker run --rm --network nerdlms-local_internal \
 *     -v "$PWD:/repo" -w /repo -e DATABASE_URL="$DATABASE_URL" \
 *     node:22-alpine node --experimental-strip-types \
 *     infra/tools/excluir-conta.mjs pessoa@exemplo.com
 *
 * O `--experimental-strip-types` é por causa dos imports `.ts`: o backend é
 * TypeScript e quem normalmente o compila é o Next.
 */
import { deleteUserAccount } from "../../apps/backend/src/auth/user-admin-repository.ts";
import { query } from "../../apps/backend/src/db/pool.ts";

const email = process.argv[2];

if (!email) {
  console.error("uso: node --experimental-strip-types infra/tools/excluir-conta.mjs <email>");
  process.exit(1);
}

const [pessoa] = await query(
  `SELECT id, tenant_id, full_name FROM users WHERE email = $1`,
  [email],
);

if (!pessoa) {
  console.error(`Não há conta com o e-mail ${email}.`);
  process.exit(1);
}

console.log(`Excluindo ${pessoa.full_name} <${email}>`);

const resultado = await deleteUserAccount(pessoa.tenant_id, pessoa.id);

if (resultado.kind === "blocked") {
  console.error(
    `Recusado: a conta ainda tem ${resultado.comments} comentário(s) e ` +
      `${resultado.courses} curso(s). Apagá-la levaria junto conteúdo de outras pessoas.`,
  );
  process.exit(1);
}

console.log(
  `Conta excluída. ${resultado.anonymizedStatements} statement(s) xAPI anonimizado(s); ` +
    "a trilha de auditoria manteve os fatos e perdeu a identificação.",
);
process.exit(0);

import { Pool } from "pg";

/**
 * Pool de conexões — um por processo.
 *
 * O `globalThis` existe por causa do hot reload em desenvolvimento: sem ele,
 * cada recompilação criaria um pool novo e o Postgres acabaria recusando
 * conexão por esgotamento. Em produção o módulo é carregado uma vez e o
 * `globalThis` não faz diferença.
 *
 * `server-only` garante o erro em tempo de build se alguém importar isto de um
 * componente de cliente — o que vazaria a string de conexão para o navegador.
 */
const globalForDb = globalThis as unknown as { nerdlmsPool?: Pool };

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL não definida. Ver infra/.env.example.");
  }

  return new Pool({
    connectionString,
    /* Limites modestos: a aplicação é o único cliente e o banco não publica
       porta. Pool grande aqui só transfere a fila para dentro do Postgres. */
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}

/**
 * O pool é criado na primeira consulta, não quando o módulo carrega.
 *
 * `next build` importa as rotas para coletar metadados, e nesse momento não há
 * banco nem `DATABASE_URL` — criar o pool no topo fazia o build inteiro falhar
 * com "DATABASE_URL não definida". Adiar até o primeiro uso mantém o erro onde
 * ele é útil: em tempo de execução, para quem esqueceu de configurar o ambiente.
 */
export function getPool(): Pool {
  return (globalForDb.nerdlmsPool ??= createPool());
}

/**
 * Executa uma consulta parametrizada.
 *
 * Só aceita parâmetros posicionais (`$1`, `$2`), nunca interpolação de string:
 * é o que impede injeção de SQL na origem, em vez de confiar em quem escreve a
 * consulta lembrar de escapar.
 */
export async function query<T>(text: string, params: readonly unknown[] = []): Promise<T[]> {
  const result = await getPool().query(text, params as unknown[]);
  return result.rows as T[];
}

/**
 * Executa várias consultas como UMA transação.
 *
 * Existe por causa da importação em massa (F5-05): criar um curso são dezenas
 * de INSERTs — curso, módulos, aulas —, e sem transação uma falha no meio deixa
 * um curso pela metade no catálogo.
 *
 * O `client` é o MESMO em todas as consultas do bloco — é isso que as põe na
 * mesma transação. Chamar o `query` do módulo lá dentro pegaria outra conexão
 * do pool, ficaria FORA da transação, e o ROLLBACK não a desfaria: por isso o
 * callback recebe o executor que deve usar.
 *
 * ```ts
 * await withTransaction(async (exec) => {
 *   const [curso] = await exec<{ id: string }>(`INSERT ... RETURNING id`, [...]);
 *   await exec(`INSERT INTO modules ...`, [curso!.id]);
 * });
 * ```
 */
export async function withTransaction<T>(
  bloco: (exec: <R>(text: string, params?: readonly unknown[]) => Promise<R[]>) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");

    const resultado = await bloco(async <R>(text: string, params: readonly unknown[] = []) => {
      const saida = await client.query(text, params as unknown[]);
      return saida.rows as R[];
    });

    await client.query("COMMIT");
    return resultado;
  } catch (erro) {
    /* O ROLLBACK pode falhar por conta própria — conexão derrubada, por
       exemplo. Se falhar, o que precisa chegar a quem chamou é o erro
       ORIGINAL: é ele que diz o que deu errado. */
    await client.query("ROLLBACK").catch(() => {});
    throw erro;
  } finally {
    /* Sempre devolve a conexão ao pool. Sem isto, cada falha vazaria uma
       conexão e o pool esgotaria depois de dez. */
    client.release();
  }
}

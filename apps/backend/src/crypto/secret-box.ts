import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/**
 * Segredos que a aplicação guarda no banco e precisa LER de volta.
 *
 * É uma categoria diferente de senha de pessoa. Aquela vira hash e nunca mais
 * volta: ninguém precisa saber qual era, só conferir se bate. Esta a aplicação
 * tem de apresentar a outro sistema — a senha da conta de serviço do Active
 * Directory é digitada no diretório, não comparada aqui. Hash não serve.
 *
 * O QUE ISTO PROTEGE, E O QUE NÃO PROTEGE
 *
 * Protege contra o segredo sair junto com os DADOS: um backup copiado, um dump
 * pedido para investigar um chamado, uma réplica de homologação restaurada com
 * a base de produção. Nesses caminhos — que são os que de fato acontecem — a
 * chave não vai junto, porque ela mora no ambiente do processo.
 *
 * NÃO protege contra quem já executa código neste servidor. Quem chega lá lê a
 * variável de ambiente e decifra. Dizer o contrário seria vender teatro: a
 * defesa contra esse caso é não deixar chegar lá.
 *
 * POR QUE A CHAVE VEM DO `SESSION_SECRET`
 *
 * Porque ele já existe, já é obrigatório no `docker-compose` e — até aqui —
 * NÃO ERA LIDO POR NADA. O `.env.example` prometia que trocá-lo derrubava as
 * sessões, e as sessões nunca dependeram dele: são fichas aleatórias no banco.
 * Criar mais uma variável para cada segredo novo é como se acumula
 * configuração que ninguém sabe se está preenchida; derivar de uma raiz única,
 * com rótulo próprio por uso, é a prática que o HKDF existe para servir.
 *
 * A CONSEQUÊNCIA DE TROCAR O `SESSION_SECRET` está dita em `abrir`: o que foi
 * cifrado com o anterior deixa de abrir, com mensagem que diz exatamente isso.
 * Falha alta e clara vale mais que uma que se disfarça de senha errada.
 */

/** Marca a versão do formato. Trocar o algoritmo um dia exige distinguir. */
const VERSAO = "v1";

/** 96 bits é o tamanho que o GCM foi projetado para usar. */
const TAMANHO_IV = 12;
const TAMANHO_TAG = 16;

function chave(rotulo: string): Buffer {
  const raiz = process.env.SESSION_SECRET;

  if (!raiz || raiz.length < 16) {
    /* Falha na PRIMEIRA gravação, na tela de quem configura, e não no login de
       alguém seis meses depois. */
    throw new Error(
      "SESSION_SECRET ausente ou curto demais: sem ele não há como guardar segredo cifrado. " +
        "Gere um com `openssl rand -base64 48` e defina no .env.",
    );
  }

  /* O rótulo (`info`) separa os usos: a chave que abre a senha do diretório não
     é a mesma que abriria outra coisa derivada da mesma raiz. Sem ele, um
     segredo cifrado num contexto poderia ser colado noutro. */
  return Buffer.from(hkdfSync("sha256", raiz, "nerdlms-secret-box", rotulo, 32));
}

/**
 * Cifra. O resultado é texto, para caber numa coluna comum.
 *
 * O IV é sorteado a cada gravação e viaja junto — ele não é segredo, e repetir
 * um IV no GCM é a falha que expõe o texto claro de todas as mensagens que o
 * compartilham.
 */
export function fechar(segredo: string, rotulo: string): string {
  const iv = randomBytes(TAMANHO_IV);
  const cifra = createCipheriv("aes-256-gcm", chave(rotulo), iv);

  /* O rótulo entra também como dado autenticado: um valor cifrado para um uso
     não pode ser aceito noutro nem por engano de código. */
  cifra.setAAD(Buffer.from(rotulo, "utf8"));

  const corpo = Buffer.concat([cifra.update(segredo, "utf8"), cifra.final()]);

  return `${VERSAO}.${Buffer.concat([iv, cifra.getAuthTag(), corpo]).toString("base64")}`;
}

export type Abertura =
  | { ok: true; segredo: string }
  | { ok: false; erro: string };

/**
 * Decifra.
 *
 * Devolve resultado em vez de lançar: a falha mais provável aqui não é ataque,
 * é o `SESSION_SECRET` ter sido trocado — e quem chama precisa transformar isso
 * numa mensagem que diga o que fazer, não numa pilha de erro no log.
 */
export function abrir(guardado: string, rotulo: string): Abertura {
  const ponto = guardado.indexOf(".");
  if (ponto < 0 || guardado.slice(0, ponto) !== VERSAO) {
    return { ok: false, erro: "Segredo guardado em formato desconhecido." };
  }

  const bytes = Buffer.from(guardado.slice(ponto + 1), "base64");
  if (bytes.length <= TAMANHO_IV + TAMANHO_TAG) {
    return { ok: false, erro: "Segredo guardado incompleto." };
  }

  try {
    const decifra = createDecipheriv(
      "aes-256-gcm",
      chave(rotulo),
      bytes.subarray(0, TAMANHO_IV),
    );
    decifra.setAAD(Buffer.from(rotulo, "utf8"));
    decifra.setAuthTag(bytes.subarray(TAMANHO_IV, TAMANHO_IV + TAMANHO_TAG));

    const claro = Buffer.concat([
      decifra.update(bytes.subarray(TAMANHO_IV + TAMANHO_TAG)),
      decifra.final(),
    ]);

    return { ok: true, segredo: claro.toString("utf8") };
  } catch {
    /* A etiqueta do GCM não conferiu. Ou o dado foi alterado no banco, ou — o
       caso real — o SESSION_SECRET não é mais o mesmo de quando foi gravado. A
       mensagem aponta para o segundo porque é o que acontece na prática, e o
       conserto é o mesmo nos dois: regravar. */
    return {
      ok: false,
      erro:
        "Não foi possível ler o segredo guardado. Isso acontece quando o SESSION_SECRET " +
        "do servidor muda depois da gravação, regrave a credencial na tela de administração.",
    };
  }
}

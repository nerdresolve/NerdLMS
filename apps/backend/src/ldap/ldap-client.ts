import { connect as tlsConnect, type TLSSocket } from "node:tls";

import {
  bindRequest,
  mensagemDaBusca,
  mensagemDoResultado,
  motivoDoBind,
  type MotivoDoBind,
  OP,
  parseLdapResult,
  parseMessage,
  parseSearchEntry,
  RESULT,
  type SearchEntry,
  type SearchParams,
  searchRequest,
} from "@nerdlms/core/ldap/protocol.ts";

/**
 * A conversa com o diretório.
 *
 * ANTES ERA UMA OPERAÇÃO SÓ — abrir, mandar o bind, ler, fechar. Deixou de ser
 * quando o papel de cada pessoa passou a vir dos grupos do Active Directory:
 * ler `memberOf` exige buscar, e buscar exige estar autenticado na MESMA
 * conexão. Um segundo socket teria de refazer o bind e mandar a senha de novo.
 *
 * Isso trouxe o que uma conexão de uma mensagem não precisava ter: identificar
 * a resposta pelo número da mensagem. O LDAP permite ao servidor responder fora
 * de ordem, e a busca responde com VÁRIAS mensagens — uma por objeto, mais a de
 * encerramento. Ler "o próximo pacote" e supor de quem é funciona até o dia em
 * que não funciona, e o defeito aparece como dado de outra pessoa.
 *
 * CONTINUA SEM POOL. Cada login abre a sua conexão e a fecha; ela vive
 * segundos. Um pool exigiria detectar o servidor derrubando por inatividade, e
 * o ganho não paga isso para algo que acontece uma vez por pessoa por dia.
 *
 * SEMPRE TLS. `tls.connect`, nunca `net.connect`: o bind simples manda a senha
 * do diretório corporativo em texto. O produto não oferece desligar — quem tem
 * diretório sem TLS tem um problema maior que o SSO.
 */

/** Nenhum diretório lento pode pendurar um login. */
const TIMEOUT_MS = 10_000;

/**
 * Teto do que se aceita receber numa conexão.
 *
 * Sem ele, um servidor hostil (ou defeituoso) que despeje bytes sem nunca
 * fechar uma mensagem faz este processo crescer até acabar a memória — e
 * derruba o site inteiro, não só o login. Meio megabyte é muito acima de
 * qualquer resposta legítima: a maior aqui é a lista de grupos de uma pessoa.
 */
const MAX_RESPOSTA = 512 * 1024;

export interface ConexaoParams {
  host: string;
  port: number;
  /**
   * Aceitar certificado que a cadeia pública não valida.
   *
   * Diretório corporativo costuma usar certificado emitido pela própria
   * empresa, e recusá-lo impediria o SSO em boa parte dos clientes. O padrão é
   * VALIDAR; desligar é escolha consciente de quem implanta, registrada na
   * tela.
   */
  allowSelfSigned: boolean;
}

export type BindOutcome =
  | { ok: true }
  | { ok: false; error: string; codigo?: number; motivo?: MotivoDoBind };

export type SearchOutcome =
  | { ok: true; entries: SearchEntry[] }
  | { ok: false; error: string };

export interface Sessao {
  bind(dn: string, senha: string): Promise<BindOutcome>;
  search(params: SearchParams): Promise<SearchOutcome>;
  close(): void;
}

export type ConexaoOutcome =
  | { ok: true; sessao: Sessao }
  | { ok: false; error: string };

/** Uma operação esperando resposta. */
interface Pendente {
  resolve(valor: never): void;
  /** Onde as entradas da busca se acumulam até o `SearchResultDone`. */
  entradas: SearchEntry[];
  tipo: "bind" | "search";
}

export async function conectar(params: ConexaoParams): Promise<ConexaoOutcome> {
  return new Promise<ConexaoOutcome>((resolve) => {
    let respondido = false;
    let recebido = Buffer.alloc(0);
    let proximoId = 1;

    const pendentes = new Map<number, Pendente>();

    let socket: TLSSocket;

    /**
     * Encerra tudo com o mesmo erro.
     *
     * Toda operação em voo precisa ser resolvida: uma promessa que nunca
     * resolve pendura a requisição HTTP de quem está na tela de login até o
     * tempo limite do servidor, e o log não registra nada.
     */
    const derrubar = (erro: string): void => {
      for (const [, pendente] of pendentes) {
        pendente.resolve({ ok: false, error: erro } as never);
      }
      pendentes.clear();

      if (!respondido) {
        respondido = true;
        resolve({ ok: false, error: erro });
      }

      socket?.destroy();
    };

    try {
      socket = tlsConnect({
        host: params.host,
        port: params.port,
        /* `servername` é o SNI: sem ele, um servidor que hospeda vários
           domínios devolve o certificado errado e a validação falha por motivo
           que não é o real. */
        servername: params.host,
        rejectUnauthorized: !params.allowSelfSigned,
        timeout: TIMEOUT_MS,
      });
    } catch {
      resolve({ ok: false, error: "Não foi possível abrir conexão com o diretório." });
      return;
    }

    socket.setTimeout(TIMEOUT_MS);

    /** Manda uma operação e devolve a promessa da resposta dela. */
    function enviar<T>(bytes: Buffer, id: number, tipo: Pendente["tipo"]): Promise<T> {
      return new Promise<T>((resolveOperacao) => {
        pendentes.set(id, {
          resolve: resolveOperacao as Pendente["resolve"],
          entradas: [],
          tipo,
        });

        if (socket.destroyed) {
          pendentes.delete(id);
          resolveOperacao({
            ok: false,
            error: "A conexão com o diretório foi encerrada.",
          } as T);
          return;
        }

        socket.write(bytes);
      });
    }

    const sessao: Sessao = {
      bind(dn, senha) {
        const id = proximoId;
        proximoId += 1;
        return enviar<BindOutcome>(bindRequest(id, dn, senha), id, "bind");
      },

      search(busca) {
        const id = proximoId;
        proximoId += 1;
        return enviar<SearchOutcome>(searchRequest(id, busca), id, "search");
      },

      close() {
        /* `unbindRequest` seria o educado, mas ele não tem resposta e o destino
           é o mesmo — fechar o socket. Um a menos para codificar. */
        socket.destroy();
      },
    };

    socket.on("secureConnect", () => {
      respondido = true;
      resolve({ ok: true, sessao });
    });

    socket.on("data", (pedaco: Buffer) => {
      recebido = Buffer.concat([recebido, pedaco]);

      if (recebido.length > MAX_RESPOSTA) {
        derrubar("O diretório respondeu com um volume fora do esperado.");
        return;
      }

      /* Consome quantas mensagens completas houver. Elas podem vir várias no
         mesmo pacote ou uma partida entre dois — o `totalLength` diz onde cada
         uma acaba. */
      for (;;) {
        const lido = parseMessage(recebido);

        if (!lido.ok && "incomplete" in lido) return;

        if (!lido.ok) {
          derrubar(lido.error);
          return;
        }

        const { messageId, op, totalLength } = lido.message;
        recebido = recebido.subarray(totalLength);

        despachar(messageId, op.tag, op.value);
      }
    });

    function despachar(messageId: number, tag: number, conteudo: Buffer): void {
      const pendente = pendentes.get(messageId);

      /* Sem dono: ou é uma notificação não solicitada — o servidor avisando que
         vai desconectar —, ou resposta de operação que já foi resolvida por
         tempo esgotado. Ignorar é o certo nos dois casos; derrubar a conexão
         por causa de um aviso seria trocar um problema por outro. */
      if (!pendente) return;

      if (tag === OP.SEARCH_REFERENCE) {
        /* "O que você procura pode estar naquele outro servidor." Ignorado de
           propósito: seguir a referência abriria conexão para um servidor que
           quem configurou não indicou. */
        return;
      }

      if (tag === OP.SEARCH_ENTRY) {
        const entrada = parseSearchEntry(conteudo);
        if (entrada) pendente.entradas.push(entrada);
        return;
      }

      const resultado = parseLdapResult(conteudo);

      if (!resultado) {
        pendentes.delete(messageId);
        pendente.resolve({
          ok: false,
          error: "Resposta do diretório sem código de resultado.",
        } as never);
        return;
      }

      pendentes.delete(messageId);

      /* O diagnóstico vai para o LOG, nunca para a tela. O Active Directory
         devolve ali códigos que dizem se a senha expirou, se a conta está
         travada ou se ela não existe — informação para quem administra e um
         mapa para quem ataca. */
      if (resultado.resultCode !== RESULT.SUCCESS && resultado.diagnostic) {
        console.warn(
          `[ldap] ${pendente.tipo} recusado`,
          resultado.resultCode,
          resultado.diagnostic.slice(0, 200),
        );
      }

      if (pendente.tipo === "search") {
        pendente.resolve(
          (resultado.resultCode === RESULT.SUCCESS
            ? { ok: true, entries: pendente.entradas }
            : /* `sizeLimitExceeded` (4) com entradas na mão é sucesso parcial, e
                 para nós é sucesso: pedimos duas justamente para detectar
                 ambiguidade, e o servidor cortar na segunda é o comportamento
                 esperado, não falha. */
              resultado.resultCode === 4 && pendente.entradas.length > 0
              ? { ok: true, entries: pendente.entradas }
              : {
                  ok: false,
                  /* NÃO `mensagemDoResultado`: aquela é escrita para
                     autenticação, e traduz `noSuchObject` como "usuário ou
                     senha inválidos" — o que, numa busca, mandaria quem errou a
                     base de busca conferir a senha pelo resto da tarde. */
                  error: mensagemDaBusca(resultado.resultCode),
                }) as never,
        );
        return;
      }

      if (resultado.resultCode === RESULT.SUCCESS) {
        pendente.resolve({ ok: true } as never);
        return;
      }

      /* O motivo real do Active Directory está no diagnóstico, e é mais exato
         que qualquer consulta prévia: `lockoutTime` continua preenchido depois
         de o bloqueio expirar, mas o `data 775` só aparece enquanto ele vale. */
      const motivo = motivoDoBind(resultado.diagnostic);

      pendente.resolve({
        ok: false,
        error: mensagemDoResultado(resultado.resultCode),
        codigo: resultado.resultCode,
        motivo,
      } as never);
    }

    socket.on("timeout", () => {
      derrubar("O diretório não respondeu a tempo.");
    });

    socket.on("error", (erro: NodeJS.ErrnoException) => {
      /* Certificado recusado tem mensagem própria: é o erro mais comum numa
         implantação, e "não foi possível conectar" mandaria quem configura
         procurar problema de rede. */
      const certificado =
        erro.code === "DEPTH_ZERO_SELF_SIGNED_CERT" ||
        erro.code === "SELF_SIGNED_CERT_IN_CHAIN" ||
        erro.code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE";

      derrubar(
        certificado
          ? "O certificado do diretório não foi aceito. Se ele é emitido pela própria empresa, marque a opção correspondente."
          : "Não foi possível falar com o diretório.",
      );
    });

    socket.on("close", () => {
      /* Fechou com operação em voo: o servidor cortou. Acontece quando a porta
         responde mas não fala LDAP — apontar para a porta errada é o segundo
         erro mais comum de configuração. */
      derrubar("O diretório encerrou a conexão sem responder.");
    });
  });
}

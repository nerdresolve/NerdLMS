import { connect as tlsConnect, type TLSSocket } from "node:tls";

import {
  bindRequest,
  mensagemDoResultado,
  parseBindResponse,
  RESULT,
} from "@nerdlms/core/ldap/protocol.ts";

/**
 * A conversa com o diretório.
 *
 * Uma operação só: abrir TLS, mandar o bind, ler a resposta, fechar. Não há
 * pool de conexões nem sessão persistente — cada login é uma conexão sua, que
 * vive por segundos. Um pool exigiria reconectar quando o servidor derruba por
 * inatividade, e o ganho não paga a complexidade para uma operação que
 * acontece uma vez por pessoa por dia.
 *
 * SEMPRE TLS. `tls.connect`, nunca `net.connect`: o bind simples manda a senha
 * do diretório corporativo em texto, e sem TLS ela atravessa a rede legível.
 * O produto não oferece a opção de desligar — quem tem um diretório sem TLS
 * tem um problema maior que o SSO.
 */

/** Nenhum diretório lento pode pendurar um login. */
const TIMEOUT_MS = 10_000;

export interface BindParams {
  host: string;
  port: number;
  dn: string;
  senha: string;
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
  | { ok: false; error: string; codigo?: number };

export async function bind(params: BindParams): Promise<BindOutcome> {
  return new Promise<BindOutcome>((resolve) => {
    let resolvido = false;
    let recebido = Buffer.alloc(0);

    /* Uma resolução só: o socket emite `error` e `close` em sequência, e sem
       esta guarda a promessa seria resolvida duas vezes — a segunda em
       silêncio, escondendo qual das duas venceu. */
    const terminar = (resultado: BindOutcome, socket?: TLSSocket): void => {
      if (resolvido) return;
      resolvido = true;
      socket?.destroy();
      resolve(resultado);
    };

    let socket: TLSSocket;

    try {
      socket = tlsConnect({
        host: params.host,
        port: params.port,
        /* `servername` é o SNI: sem ele, um servidor que hospeda vários
           domínios devolve o certificado errado e a validação falha por
           motivo que não é o real. */
        servername: params.host,
        rejectUnauthorized: !params.allowSelfSigned,
        timeout: TIMEOUT_MS,
      });
    } catch {
      terminar({ ok: false, error: "Não foi possível abrir conexão com o diretório." });
      return;
    }

    socket.setTimeout(TIMEOUT_MS);

    socket.on("secureConnect", () => {
      /* O identificador da mensagem: 1, porque é a primeira e única desta
         conexão. Em conexão reaproveitada ele precisaria crescer. */
      socket.write(bindRequest(1, params.dn, params.senha));
    });

    socket.on("data", (pedaco: Buffer) => {
      recebido = Buffer.concat([recebido, pedaco]);

      const lido = parseBindResponse(recebido);

      /* Resposta incompleta é normal: o TCP entrega em pedaços. Espera o
         resto em vez de tratar como falha. */
      if (!lido.ok && "incomplete" in lido) return;

      if (!lido.ok) {
        terminar({ ok: false, error: lido.error }, socket);
        return;
      }

      const { resultCode, diagnostic } = lido.response;

      if (resultCode === RESULT.SUCCESS) {
        terminar({ ok: true }, socket);
        return;
      }

      /* O diagnóstico vai para o LOG, não para a tela. O Active Directory
         devolve códigos como `data 532` ali, que dizem se a senha expirou, se
         a conta está travada ou se ela não existe — informação para quem
         administra e um mapa para quem ataca. */
      if (diagnostic) {
        console.warn("[ldap] bind recusado", resultCode, diagnostic.slice(0, 200));
      }

      terminar(
        { ok: false, error: mensagemDoResultado(resultCode), codigo: resultCode },
        socket,
      );
    });

    socket.on("timeout", () => {
      terminar({ ok: false, error: "O diretório não respondeu a tempo." }, socket);
    });

    socket.on("error", (erro: NodeJS.ErrnoException) => {
      /* Certificado recusado tem mensagem própria: é o erro mais comum numa
         implantação, e "não foi possível conectar" mandaria quem configura
         procurar problema de rede. */
      const certificado =
        erro.code === "DEPTH_ZERO_SELF_SIGNED_CERT" ||
        erro.code === "SELF_SIGNED_CERT_IN_CHAIN" ||
        erro.code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE";

      terminar({
        ok: false,
        error: certificado
          ? "O certificado do diretório não foi aceito. Se ele é emitido pela própria empresa, marque a opção correspondente."
          : "Não foi possível falar com o diretório.",
      });
    });

    socket.on("close", () => {
      /* Fechou sem resposta: o servidor cortou. Acontece quando a porta
         responde mas não fala LDAP — apontar para a porta errada é o segundo
         erro mais comum de configuração. */
      terminar({ ok: false, error: "O diretório encerrou a conexão sem responder." });
    });
  });
}

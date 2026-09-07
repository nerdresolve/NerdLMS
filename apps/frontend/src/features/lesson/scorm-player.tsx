"use client";

import { useEffect, useRef, useState } from "react";

import { formatCmiTime, scormValue, setScormValue, type ScormState } from "@nerdlms/core/scorm/runtime.ts";
import {
  scorm2004Value,
  setScorm2004Value,
  type Scorm2004State,
} from "@nerdlms/core/scorm/runtime-2004.ts";

/**
 * Player SCORM — 1.2 e 2004.
 *
 * O conteúdo roda num iframe e procura `window.API` subindo pela hierarquia de
 * janelas (`window.parent`, `window.parent.parent`…). É assim que o padrão
 * manda: o pacote não sabe nada sobre nós, só que existe um objeto com oito
 * métodos de nome fixo.
 *
 * Por isso a API é instalada no `window` desta página, e não passada por
 * propriedade — não há como; o contrato é global por definição do padrão.
 *
 * O ESTADO É GRAVADO NO COMMIT E NO FIM DA SESSÃO. O conteúdo chama `SetValue`
 * dezenas de vezes seguidas (uma por variável), e gravar a cada chamada daria
 * dezenas de requisições por clique.
 *
 * AS DUAS VERSÕES TÊM APIS DE NOMES DIFERENTES, e é por isso que este arquivo
 * instala uma ou outra conforme o pacote:
 *
 *   1.2   → `window.API`, com métodos `LMSInitialize`, `LMSGetValue`…
 *   2004  → `window.API_1484_11`, com `Initialize`, `GetValue`…
 *
 * Um pacote 2004 procura `API_1484_11` e desiste ao não achar — sem erro, sem
 * aviso. O aluno refaz a aula achando que o problema é dele.
 */

interface ScormApi {
  LMSInitialize: (arg: string) => string;
  LMSFinish: (arg: string) => string;
  LMSGetValue: (element: string) => string;
  LMSSetValue: (element: string, value: string) => string;
  LMSCommit: (arg: string) => string;
  LMSGetLastError: () => string;
  LMSGetErrorString: (code: string) => string;
  LMSGetDiagnostic: (code: string) => string;
}

/** A API do 2004. Mesmos oito métodos, todos com outro nome. */
interface Scorm2004Api {
  Initialize: (arg: string) => string;
  Terminate: (arg: string) => string;
  GetValue: (element: string) => string;
  SetValue: (element: string, value: string) => string;
  Commit: (arg: string) => string;
  GetLastError: () => string;
  GetErrorString: (code: string) => string;
  GetDiagnostic: (code: string) => string;
}

declare global {
  interface Window {
    API?: ScormApi;
    API_1484_11?: Scorm2004Api;
  }
}

/**
 * O estado inicial, na versão do pacote.
 *
 * União discriminada e não dois campos opcionais: o `version` decide qual
 * runtime é instalado, e dois opcionais deixariam existir o estado errado para
 * a versão declarada — um defeito que só apareceria com um pacote real na mão.
 */
export type ScormInitial =
  | { version: "1.2"; state: ScormState }
  | { version: "2004"; state: Scorm2004State };

export function ScormPlayer({
  lessonId,
  src,
  title,
  initial,
}: {
  lessonId: string;
  /** A URL do `entry_point` do pacote, assinada. */
  src: string;
  title: string;
  initial: ScormInitial;
}) {
  const [salvo, setSalvo] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

  /* O IFRAME SÓ É MONTADO DEPOIS QUE A API EXISTE.

     O conteúdo procura `window.parent.API` na primeira linha do script dele. Se
     o iframe carregar antes do efeito rodar, ele não acha nada e desiste — foi
     exatamente o que aconteceu ao testar: a API estava lá, acessível, mas o
     conteúdo já tinha procurado.

     O padrão não prevê nova tentativa: o pacote procura uma vez e trata a
     ausência como erro fatal. */
  const [apiPronta, setApiPronta] = useState(false);

  /* O estado vive numa ref, não em `useState`.

     `LMSGetValue` é síncrono e o conteúdo o chama em rajada logo após
     `LMSSetValue`. Com estado do React, a leitura seguinte veria o valor
     ANTERIOR — o React só aplica no próximo render, e o conteúdo já teria
     seguido em frente com o dado errado. */
  const estado = useRef<ScormState | Scorm2004State>(initial.state);
  const versao = useRef(initial.version);
  const sujo = useRef(false);
  const inicioSessao = useRef<number>(Date.now());

  useEffect(() => {
    /** Grava no servidor o que mudou. */
    async function persistir(finalizando = false) {
      if (!sujo.current && !finalizando) return;
      sujo.current = false;

      const atual = estado.current;

      /* O tempo de sessão é calculado AQUI, não confiado ao conteúdo: muitos
         pacotes simplesmente não informam `session_time`, e sem isso o tempo
         total do curso ficaria sempre zero. */
      const segundos = Math.round((Date.now() - inicioSessao.current) / 1000);
      inicioSessao.current = Date.now();

      /* Cada versão manda o vocabulário dela. O servidor grava em colunas
         diferentes, e traduzir aqui — espremer `completion_status` e
         `success_status` num `lesson_status` — perderia exatamente o que o
         2004 acrescenta: concluir e passar são coisas separadas. */
      const corpo =
        versao.current === "2004"
          ? (() => {
              const e = atual as Scorm2004State;
              return {
                lessonId,
                version: "2004" as const,
                completionStatus: e.completionStatus,
                successStatus: e.successStatus,
                scoreScaled: e.scoreScaled ?? null,
                scoreRaw: e.scoreRaw ?? null,
                scoreMin: e.scoreMin ?? null,
                scoreMax: e.scoreMax ?? null,
                suspendData: e.suspendData ?? null,
                location: e.location ?? null,
                exitMode: e.exit,
                sessionSeconds: segundos,
              };
            })()
          : (() => {
              const e = atual as ScormState;
              return {
                lessonId,
                version: "1.2" as const,
                lessonStatus: e.lessonStatus,
                scoreRaw: e.scoreRaw ?? null,
                scoreMin: e.scoreMin ?? null,
                scoreMax: e.scoreMax ?? null,
                suspendData: e.suspendData ?? null,
                lessonLocation: e.lessonLocation ?? null,
                sessionSeconds: segundos,
              };
            })();

      try {
        const resposta = await fetch("/api/scorm", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(corpo),
          keepalive: true,
        });

        /* `timeZone` explícito porque o verificador de hidratação exige — e a
           exigência é boa mesmo aqui, onde não há risco: este trecho só roda no
           navegador, depois de hidratar. Uma exceção "porque eu sei que é
           seguro" vira a exceção que alguém copia para onde não é. */
        /* A rota responde `preview: true` quando não há matrícula onde gravar
           — é o instrutor conferindo o que publicou. O player continua
           funcionando; só o aviso muda. */
        const corpoResposta = (await resposta.json().catch(() => null)) as
          | { preview?: boolean }
          | null;

        if (corpoResposta?.preview) {
          setPreview(true);
          setSalvo(null);
          return;
        }

        setSalvo(
          resposta.ok
            ? new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })
            : null,
        );
      } catch {
        /* Melhor-esforço, como o progresso de vídeo: a próxima gravação tenta
           de novo, e o `LMSFinish` fecha com uma última tentativa. */
      }
    }

    const api: ScormApi = {
      LMSInitialize: () => {
        inicioSessao.current = Date.now();
        return "true";
      },

      LMSFinish: () => {
        void persistir(true);
        return "true";
      },

      LMSGetValue: (element) => scormValue(estado.current as ScormState, element),

      LMSSetValue: (element, value) => {
        estado.current = setScormValue(estado.current as ScormState, element, value);
        sujo.current = true;
        return "true";
      },

      LMSCommit: () => {
        void persistir();
        return "true";
      },

      /* O padrão exige os três, e conteúdo que os chama espera resposta. "0" é
         "sem erro" — devolver outra coisa faria pacotes cautelosos abortarem. */
      LMSGetLastError: () => "0",
      LMSGetErrorString: () => "No error",
      LMSGetDiagnostic: () => "",
    };

    const api2004: Scorm2004Api = {
      Initialize: () => {
        inicioSessao.current = Date.now();
        return "true";
      },

      /* `Terminate`, não `LMSFinish`. Um pacote 2004 chama este nome e só
         este. */
      Terminate: () => {
        void persistir(true);
        return "true";
      },

      GetValue: (element) => scorm2004Value(estado.current as Scorm2004State, element),

      SetValue: (element, value) => {
        estado.current = setScorm2004Value(estado.current as Scorm2004State, element, value);
        sujo.current = true;
        return "true";
      },

      Commit: () => {
        void persistir();
        return "true";
      },

      GetLastError: () => "0",
      GetErrorString: () => "No error",
      GetDiagnostic: () => "",
    };

    /* Uma OU outra, nunca as duas. Instalar as duas faria um pacote de versão
       ambígua escolher a que achasse primeiro, e gravar no vocabulário errado
       — o pior resultado possível, porque parece funcionar. */
    if (versao.current === "2004") {
      window.API_1484_11 = api2004;
    } else {
      window.API = api;
    }

    setApiPronta(true);

    /* Rede de segurança: o conteúdo pode fechar sem chamar `LMSFinish` —
       fechar a aba, navegar para fora. Sem isto, a sessão inteira se perde. */
    const aoSair = () => void persistir(true);
    window.addEventListener("pagehide", aoSair);

    /* E um salvamento periódico, para a queda de energia não custar meia hora
       de estudo. */
    const timer = setInterval(() => void persistir(), 60_000);

    return () => {
      window.removeEventListener("pagehide", aoSair);
      clearInterval(timer);
      void persistir(true);
      delete window.API;
      delete window.API_1484_11;
    };
  }, [lessonId]);

  return (
    <div className="scorm">
      <div className="scorm__frame">
        {apiPronta ? (
        <iframe
          className="scorm__embed"
          src={src}
          title={title}
          /* `allow-same-origin` é necessário: o conteúdo precisa alcançar
             `window.parent.API`, e um iframe sandboxado sem ele fica com
             origem opaca e não enxerga o pai. O pacote vem do storage do
             próprio cliente, subido por um instrutor autorizado. */
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
        ) : null}
      </div>

      <p className="scorm__status" role="status" data-preview={preview || undefined}>
        {preview
          ? "Pré-visualização: o conteúdo roda, e nada é registrado no seu histórico."
          : salvo
            ? `Progresso salvo às ${salvo}`
            : "O progresso é salvo automaticamente."}
        {estado.current.totalTimeSeconds > 0
          ? ` · tempo total ${formatCmiTime(estado.current.totalTimeSeconds)}`
          : ""}
      </p>
    </div>
  );
}

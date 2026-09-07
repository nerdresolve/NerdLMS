"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, PenLine, Trash2, Upload } from "lucide-react";

/**
 * A assinatura que vai nos certificados dos cursos desta pessoa.
 *
 * Aparece só para quem pode ser autor de curso. Para um aluno seria um campo
 * sem consequência — e campo sem consequência é o que faz uma tela de perfil
 * virar formulário de cadastro.
 *
 * O QUE A PRÉVIA MOSTRA, E POR QUE ELA É SOBRE BRANCO
 *
 * O certificado achata a transparência sobre branco, porque é branco o papel
 * onde a assinatura repousa. Uma prévia sobre fundo cinza ou escuro esconderia
 * exatamente o defeito mais comum de um arquivo mal exportado: traço claro que
 * some, ou fundo opaco que vira um retângulo sobre o documento. Aqui a prévia
 * usa o mesmo fundo que o PDF usa, então o que se vê é o que sai.
 */

export function SignatureUpload({
  enviadaEm,
}: {
  /** Quando a atual foi enviada. Nulo = ainda não há nenhuma. */
  enviadaEm: string | null;
}) {
  const router = useRouter();
  const campoId = useId();
  const entrada = useRef<HTMLInputElement>(null);

  const [previa, setPrevia] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(arquivo: File) {
    setErro(null);

    /* A prévia sai do arquivo escolhido, ANTES de enviar: se o servidor
       recusar, a pessoa vê o que tentou mandar junto da mensagem do porquê. */
    setPrevia(URL.createObjectURL(arquivo));
    setEnviando(true);

    try {
      const bytes = new Uint8Array(await arquivo.arrayBuffer());

      /* `btoa` em pedaços: `String.fromCharCode(...bytes)` com um arquivo de
         algumas centenas de kB estoura o limite de argumentos da chamada e
         falha com "Maximum call stack size exceeded" — que não diz nada a
         ninguém. */
      let binario = "";
      for (let i = 0; i < bytes.length; i += 8192) {
        binario += String.fromCharCode(...bytes.subarray(i, i + 8192));
      }

      const resposta = await fetch("/api/perfil/assinatura", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ png: btoa(binario) }),
      });

      const corpo = (await resposta.json().catch(() => ({}))) as { error?: string };

      if (!resposta.ok) {
        setErro(corpo.error ?? "Não foi possível enviar a assinatura.");
        return;
      }

      router.refresh();
    } catch {
      setErro("Não foi possível falar com o servidor. Verifique sua conexão.");
    } finally {
      setEnviando(false);
    }
  }

  async function remover() {
    setErro(null);
    setEnviando(true);

    try {
      const resposta = await fetch("/api/perfil/assinatura", { method: "DELETE" });
      if (!resposta.ok) {
        setErro("Não foi possível remover a assinatura.");
        return;
      }
      setPrevia(null);
      if (entrada.current) entrada.current.value = "";
      router.refresh();
    } finally {
      setEnviando(false);
    }
  }

  const temAssinatura = enviadaEm !== null || previa !== null;

  return (
    <section className="course-section" aria-labelledby="assinatura">
      <h2 className="course-section__title" id="assinatura">
        <PenLine aria-hidden /> Sua assinatura no certificado
      </h2>

      <p className="platform__hint">
        Ela aparece nos certificados dos cursos em que você é o instrutor responsável, sobre a
        linha de assinatura. Envie um PNG da sua assinatura em fundo transparente ou branco, o
        traço escuro é o que fica legível impresso.
      </p>

      <div className="assinatura">
        <div className="assinatura__papel">
          {previa ? (
            /* Arquivo local escolhido agora: `next/image` exigiria host
               conhecido em tempo de build, e um blob do navegador não é. */
            // eslint-disable-next-line @next/next/no-img-element
            <img className="assinatura__previa" src={previa} alt="Prévia da sua assinatura" />
          ) : enviadaEm ? (
            <p className="assinatura__vazio">
              Assinatura enviada em {enviadaEm}.
              <br />
              Envie outra para substituir.
            </p>
          ) : (
            <p className="assinatura__vazio">
              Sem assinatura enviada. O certificado sai com a atribuição da plataforma.
            </p>
          )}
          <span className="assinatura__linha" aria-hidden="true" />
        </div>

        <div className="assinatura__acoes">
          <label className="btn btn--ghost" htmlFor={campoId}>
            <Upload aria-hidden /> {temAssinatura ? "Trocar arquivo" : "Enviar assinatura"}
          </label>
          <input
            ref={entrada}
            id={campoId}
            className="assinatura__campo"
            type="file"
            accept="image/png"
            disabled={enviando}
            onChange={(evento) => {
              const arquivo = evento.target.files?.[0];
              if (arquivo) void enviar(arquivo);
            }}
          />

          {enviadaEm ? (
            <button
              type="button"
              className="btn btn--ghost assinatura__remover"
              onClick={() => void remover()}
              disabled={enviando}
            >
              <Trash2 aria-hidden /> Remover
            </button>
          ) : null}
        </div>
      </div>

      {erro ? (
        <p className="error" role="alert">
          <AlertCircle aria-hidden="true" />
          <span>{erro}</span>
        </p>
      ) : null}
    </section>
  );
}

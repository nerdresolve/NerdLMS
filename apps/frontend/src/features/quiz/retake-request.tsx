"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Clock3, RotateCcw, Send } from "lucide-react";

/**
 * O pedido de reteste, na tela de quem reprovou.
 *
 * POR QUE UM PEDIDO, E NÃO UM BOTÃO DE REFAZER
 *
 * Com tentativas livres, a primeira prova vira rascunho: quem reprova refaz no
 * mesmo minuto e ninguém fica sabendo. Reprovar só significa alguma coisa se
 * custar alguma coisa — aqui custa um pedido, que uma pessoa lê e decide.
 *
 * POR QUE MODAL, E NÃO O FORMULÁRIO NA PÁGINA
 *
 * Pedir reteste é uma decisão, não um campo a mais na tela de resultado. O
 * diálogo separa o momento de ler a nota do momento de agir sobre ela, e evita
 * que a justificativa fique aberta competindo com o número que a pessoa acabou
 * de receber.
 *
 * `<dialog>` nativo, e não uma `<div>` com posição fixa: ele traz de graça o
 * fechamento por Esc, o foco preso dentro enquanto está aberto e o fundo
 * inerte. Reimplementar isso à mão é onde nascem os diálogos que o teclado não
 * alcança.
 *
 * A JUSTIFICATIVA É OPCIONAL, ao contrário do comentário do instrutor. Exigir
 * que quem reprovou argumente a favor de si mesmo é pedir constrangimento em
 * troca de nada: quem tem motivo escreve, quem não tem só pede.
 */
export function PedidoDeReteste({ quizId }: { quizId: string }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [nota, setNota] = useState("");
  const [estado, setEstado] = useState<"parado" | "enviando" | "enviado">("parado");
  const [erro, setErro] = useState<string | null>(null);

  /* `showModal()` é o que torna o resto da página inerte e prende o foco.
     Abrir pelo atributo `open` não faz nada disso. */
  useEffect(() => {
    const el = dialogo.current;
    if (!el) return;
    if (estado === "parado" && el.dataset.aberto === "sim" && !el.open) el.showModal();
  }, [estado]);

  function abrir() {
    setErro(null);
    const el = dialogo.current;
    if (el) {
      el.dataset.aberto = "sim";
      el.showModal();
    }
  }

  function fechar() {
    const el = dialogo.current;
    if (el) {
      el.dataset.aberto = "nao";
      el.close();
    }
  }

  async function enviar() {
    setEstado("enviando");
    setErro(null);

    try {
      const resposta = await fetch("/api/provas/reteste", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ quizId, nota: nota.trim() || null }),
      });

      const corpo = (await resposta.json().catch(() => ({}))) as { error?: string };

      if (!resposta.ok) {
        setErro(corpo.error ?? "Não foi possível enviar o pedido.");
        setEstado("parado");
        return;
      }

      setEstado("enviado");
      fechar();
    } catch {
      setErro("Não foi possível falar com o servidor. Verifique sua conexão.");
      setEstado("parado");
    }
  }

  if (estado === "enviado") {
    return (
      <div className="retake retake--aguardando" role="status">
        <Clock3 aria-hidden />
        <div>
          <strong>Reteste solicitado.</strong>
          <p>
            O instrutor do curso vai decidir e você receberá um aviso com a resposta, liberada ou
            não, sempre com o motivo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="retake">
      <button type="button" className="btn btn--secondary" onClick={abrir}>
        <RotateCcw aria-hidden /> Solicitar reteste
      </button>

      <dialog className="retake-modal" ref={dialogo} aria-labelledby="reteste-titulo">
        <h2 className="retake-modal__titulo" id="reteste-titulo">
          Solicitar reteste
        </h2>

        <p className="retake-modal__texto">
          Refazer a prova depende da liberação do instrutor do curso. Ele vê sua nota e o número de
          tentativas, e responde com o motivo da decisão.
        </p>

        <label className="field">
          <span className="field__label">Quer explicar o motivo? (opcional)</span>
          <textarea
            className="textarea"
            value={nota}
            onChange={(evento) => setNota(evento.target.value)}
            maxLength={1000}
            rows={4}
            placeholder="Ex.: tive um problema de conexão durante a prova."
          />
        </label>

        {erro ? (
          <p className="error" role="alert">
            <AlertCircle aria-hidden="true" />
            <span>{erro}</span>
          </p>
        ) : null}

        <div className="retake-modal__acoes">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={fechar}
            disabled={estado === "enviando"}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => void enviar()}
            disabled={estado === "enviando"}
          >
            <Send aria-hidden /> {estado === "enviando" ? "Enviando…" : "Enviar pedido"}
          </button>
        </div>
      </dialog>
    </div>
  );
}

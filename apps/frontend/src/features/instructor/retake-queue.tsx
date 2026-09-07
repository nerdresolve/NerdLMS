"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, RotateCcw } from "lucide-react";

import { notaFormatada } from "@nerdlms/core/assessment/retake.ts";

/**
 * A fila de pedidos de reteste, na tela de correção do instrutor.
 *
 * POR QUE AQUI, E NÃO NUM ITEM DE MENU PRÓPRIO
 *
 * "Correção" já é o lugar onde o instrutor vê o que espera decisão dele —
 * dissertativas sem nota, trabalhos entregues. Um pedido de reteste é a mesma
 * natureza de coisa. Um menu separado criaria um segundo lugar para olhar, e o
 * que não se olha não se decide: o aluno ficaria esperando por uma tela que
 * ninguém abre.
 *
 * O COMENTÁRIO É OBRIGATÓRIO nos dois botões. Aprovar sem justificar é um
 * clique; recusar sem justificar é a pior mensagem que um aluno pode receber.
 * O servidor recusa a decisão muda, e o banco também — aqui o botão apenas
 * fica desabilitado, para a pessoa descobrir antes de tentar.
 */

export interface PedidoNaFila {
  id: string;
  learnerName: string;
  courseTitle: string;
  quizTitle: string;
  learnerNote: string | null;
  melhorPercentual: number | null;
  tentativasUsadas: number;
  pedidoEm: string;
}

export function RetakeQueue({ pedidos }: { pedidos: PedidoNaFila[] }) {
  const router = useRouter();
  const [comentarios, setComentarios] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function decidir(id: string, status: "approved" | "denied") {
    const comentario = (comentarios[id] ?? "").trim();
    setOcupado(id);
    setErro(null);

    try {
      const resposta = await fetch("/api/provas/reteste", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pedidoId: id, status, comentario }),
      });

      const corpo = (await resposta.json().catch(() => ({}))) as { error?: string };

      if (!resposta.ok) {
        setErro(corpo.error ?? "Não foi possível registrar a decisão.");
        return;
      }

      router.refresh();
    } catch {
      setErro("Não foi possível falar com o servidor. Verifique sua conexão.");
    } finally {
      setOcupado(null);
    }
  }

  return (
    <section className="course-section" aria-labelledby="retestes">
      <h2 className="course-section__title" id="retestes">
        <RotateCcw aria-hidden /> Pedidos de reteste
        {/* `.sso-adm__ligado` mora em `sso.css`, que esta página não importa:
            o contador saía como número cru colado no título. */}
        {pedidos.length > 0 ? <span className="badge">{pedidos.length}</span> : null}
      </h2>

      <p className="platform__hint">
        Quem reprova tem uma tentativa só. Refazer depende de você liberar, e o motivo que você
        escrever é o que o aluno recebe.
      </p>

      {erro ? (
        <p className="error" role="alert">
          <AlertCircle aria-hidden="true" />
          <span>{erro}</span>
        </p>
      ) : null}

      {pedidos.length === 0 ? (
        <p className="platform__hint">Nenhum pedido aguardando decisão.</p>
      ) : (
        <div className="retake-fila">
          {pedidos.map((pedido) => {
            const comentario = (comentarios[pedido.id] ?? "").trim();
            const podeDecidir = comentario.length >= 3 && ocupado !== pedido.id;

            return (
              <article className="retake-fila__item" key={pedido.id}>
                <div className="retake-fila__cabeca">
                  <strong>{pedido.learnerName}</strong>
                  <span className="retake-fila__meta">
                    {/* O título da prova é derivado do curso ("Avaliação: X"),
                        então mostrar os dois escrevia o nome duas vezes na
                        mesma linha. Só vale citar a prova quando ela diz algo
                        que o curso não diz, e é o caso de um curso com mais de
                        uma avaliação. */}
                    {pedido.quizTitle.includes(pedido.courseTitle)
                      ? pedido.courseTitle
                      : `${pedido.courseTitle} · ${pedido.quizTitle}`}
                  </span>
                  <span className="retake-fila__meta">
                    {/* O contexto da decisão: quanto tirou e quantas vezes tentou.
                        Sem isso o instrutor decide no escuro. */}
                    nota{" "}
                    {pedido.melhorPercentual === null
                      ? "-"
                      : notaFormatada(pedido.melhorPercentual)}{" "}
                    · {pedido.tentativasUsadas}{" "}
                    {pedido.tentativasUsadas === 1 ? "tentativa" : "tentativas"} · pedido em{" "}
                    {pedido.pedidoEm}
                  </span>
                </div>

                {pedido.learnerNote ? (
                  <blockquote className="retake-fila__nota">{pedido.learnerNote}</blockquote>
                ) : null}

                <label className="field">
                  <span className="field__label">Motivo da decisão (vai para o aluno)</span>
                  {/* `textarea` sem a classe não recebe estilo nenhum: caixa
                      minúscula, fonte monoespaçada, encostada no rótulo. */}
                  <textarea
                    className="textarea"
                    rows={3}
                    maxLength={1000}
                    value={comentarios[pedido.id] ?? ""}
                    onChange={(evento) =>
                      setComentarios((atuais) => ({ ...atuais, [pedido.id]: evento.target.value }))
                    }
                    placeholder="Ex.: houve problema de conexão comprovado. Liberado uma vez."
                  />
                </label>

                <div className="retake-fila__acoes">
                  <button
                    type="button"
                    className="btn btn--primary"
                    disabled={!podeDecidir}
                    onClick={() => void decidir(pedido.id, "approved")}
                  >
                    Liberar reteste
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    disabled={!podeDecidir}
                    onClick={() => void decidir(pedido.id, "denied")}
                  >
                    Não liberar
                  </button>
                  {comentario.length < 3 ? (
                    <span className="retake-fila__aviso">Escreva o motivo para decidir.</span>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

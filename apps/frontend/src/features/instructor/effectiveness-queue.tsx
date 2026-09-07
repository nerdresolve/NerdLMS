"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ClipboardList } from "lucide-react";

import {
  PRAZO_DA_AVALIACAO_DIAS,
  VEREDITOS,
  type SituacaoDaEficacia,
  type Veredito,
} from "@nerdlms/core/assessment/eficacia.ts";

import { campoObrigatorio } from "@/lib/campo-obrigatorio.ts";

/**
 * A fila de avaliação de eficácia, na tela de correção do instrutor.
 *
 * POR QUE AQUI, E NÃO NUM ITEM DE MENU PRÓPRIO
 *
 * Mesmo motivo dos pedidos de reteste: "Correção" já é o lugar onde o instrutor
 * vê o que espera decisão dele. Uma tela separada seria um segundo lugar para
 * olhar, e o que não se olha não se faz — só que aqui o esquecimento tem prazo
 * e vira não conformidade.
 *
 * A OBSERVAÇÃO É OBRIGATÓRIA. Um veredito sozinho não responde "por quê" a
 * quem abrir o registro daqui a dois anos, e é justamente ele que uma auditoria
 * vai querer entender. O servidor recusa a avaliação muda, e o banco também
 * (`CHECK` na tabela) — aqui o botão apenas fica desabilitado, para a pessoa
 * descobrir antes de tentar.
 */

export interface ItemDeEficacia {
  enrollmentId: string;
  courseTitle: string;
  learnerName: string;
  learnerProject: string | null;
  /** Já formatada em pt-BR pelo servidor: o cliente não decide fuso. */
  concluidoEm: string;
  prazo: string;
  situacao: SituacaoDaEficacia;
}

const MINIMO_DA_OBSERVACAO = 10;

const VEREDITO_CURTO: Record<Veredito, string> = {
  efetivo: "Efetivo",
  parcial: "Parcial",
  inefetivo: "Não efetivo",
};

export function EffectivenessQueue({ itens }: { itens: ItemDeEficacia[] }) {
  const router = useRouter();

  const [vereditos, setVereditos] = useState<Record<string, Veredito>>({});
  const [observacoes, setObservacoes] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function registrar(enrollmentId: string) {
    const veredito = vereditos[enrollmentId];
    const observacao = (observacoes[enrollmentId] ?? "").trim();

    if (!veredito) return;

    setOcupado(enrollmentId);
    setErro(null);

    try {
      const resposta = await fetch("/api/eficacia", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enrollmentId, veredito, observacao }),
      });

      const corpo = (await resposta.json().catch(() => ({}))) as { error?: string };

      if (!resposta.ok) {
        setErro(corpo.error ?? "Não foi possível registrar a avaliação.");
        return;
      }

      router.refresh();
    } catch {
      setErro("Não foi possível falar com o servidor. Verifique sua conexão.");
    } finally {
      setOcupado(null);
    }
  }

  const vencidas = itens.filter((item) => item.situacao === "vencida").length;

  return (
    <section className="course-section" aria-labelledby="eficacia">
      <h2 className="course-section__title" id="eficacia">
        <ClipboardList aria-hidden /> Avaliação de eficácia
        {/* `.badge` e não `.sso-adm__ligado`: a segunda mora em `sso.css`, que
            esta página não importa, e o número saía cru colado no título. */}
        {itens.length > 0 ? <span className="badge">{itens.length}</span> : null}
      </h2>

      <p className="platform__hint">
        Concluir o curso mostra que a pessoa assistiu e passou. Aqui se registra se o trabalho
        dela mudou por causa disso, dentro de {PRAZO_DA_AVALIACAO_DIAS} dias da conclusão.
        {vencidas > 0
          ? ` ${vencidas} ${vencidas === 1 ? "está com o prazo vencido" : "estão com o prazo vencido"}.`
          : ""}
      </p>

      {erro ? (
        <p className="error" role="alert">
          <AlertCircle aria-hidden="true" />
          <span>{erro}</span>
        </p>
      ) : null}

      {itens.length === 0 ? (
        <p className="platform__hint">Ninguém aguardando avaliação de eficácia.</p>
      ) : (
        <div className="retake-fila">
          {itens.map((item) => {
            const veredito = vereditos[item.enrollmentId];
            const observacao = (observacoes[item.enrollmentId] ?? "").trim();
            const podeRegistrar =
              Boolean(veredito) &&
              observacao.length >= MINIMO_DA_OBSERVACAO &&
              ocupado !== item.enrollmentId;

            return (
              <article
                className="retake-fila__item"
                data-situacao={item.situacao}
                key={item.enrollmentId}
              >
                <div className="retake-fila__cabeca">
                  <strong>{item.learnerName}</strong>
                  <span className="retake-fila__meta">
                    {item.courseTitle}
                    {/* A área diz ao instrutor com quem falar para observar o
                        desempenho: ele avalia gente que não vê todo dia. */}
                    {item.learnerProject ? ` · ${item.learnerProject}` : ""}
                  </span>
                  <span className="retake-fila__meta" data-situacao={item.situacao}>
                    concluiu em {item.concluidoEm} · {item.prazo}
                  </span>
                </div>

                <fieldset className="eficacia__vereditos">
                  <legend>O treinamento surtiu efeito?</legend>

                  {(Object.keys(VEREDITOS) as Veredito[]).map((chave) => (
                    <label className="radio" key={chave}>
                      <input
                        type="radio"
                        name={`veredito-${item.enrollmentId}`}
                        value={chave}
                        checked={veredito === chave}
                        onChange={() =>
                          setVereditos((atuais) => ({ ...atuais, [item.enrollmentId]: chave }))
                        }
                      />
                      <span aria-hidden="true" className="radio__box" />
                      <span>
                        <strong>{VEREDITO_CURTO[chave]}</strong>
                        <span className="eficacia__veredito-desc">{VEREDITOS[chave]}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>

                <label className="field">
                  {/* `.field` só dá margem; é `.field__label` que faz o rótulo
                      virar bloco. Sem ela o texto e a caixa ficam lado a lado,
                      e a caixa encolhe ao que sobra da linha. */}
                  <span className="field__label">O que foi observado no desempenho</span>
                  <textarea
                    className="textarea"
                    rows={3}
                    maxLength={2000}
                    value={observacoes[item.enrollmentId] ?? ""}
                    onChange={(evento) =>
                      setObservacoes((atuais) => ({
                        ...atuais,
                        [item.enrollmentId]: evento.target.value,
                      }))
                    }
                    placeholder="Ex.: passou a preencher a permissão de trabalho antes de abrir a válvula."
                    {...campoObrigatorio("Descreva o que foi observado no desempenho.")}
                  />
                </label>

                <div className="retake-fila__acoes">
                  <button
                    type="button"
                    className="btn btn--primary"
                    disabled={!podeRegistrar}
                    onClick={() => void registrar(item.enrollmentId)}
                  >
                    {ocupado === item.enrollmentId ? "Registrando" : "Registrar avaliação"}
                  </button>

                  {/* O botão desabilitado diz o que falta, em vez de ficar
                      inerte: sem isto, escolher o veredito e não escrever nada
                      deixa a pessoa clicando num botão que não responde. */}
                  <span className="status-text" role="status">
                    {!veredito
                      ? "Escolha um veredito."
                      : observacao.length < MINIMO_DA_OBSERVACAO
                        ? "Escreva o que foi observado."
                        : ""}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

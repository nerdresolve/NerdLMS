"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Plus, Route, Users } from "lucide-react";

import { alvoEmPalavras, type CelulaDaMatriz } from "@nerdlms/core/courses/alvo-da-trilha.ts";

import { campoObrigatorio } from "@/lib/campo-obrigatorio.ts";

/**
 * Trilhas e a matriz de treinamento.
 *
 * DUAS PERGUNTAS NA MESMA TELA
 *
 * "Que trilhas existem?" e "o que cada função tem para fazer?" são a mesma
 * decisão vista de dois lados. Separá-las em duas telas obrigaria a montar a
 * trilha num lugar e ir a outro descobrir que ela não alcançou ninguém — que é
 * justamente o erro que a matriz existe para mostrar na hora.
 *
 * O ALVO EM BRANCO É "TODO MUNDO", E A TELA DIZ ISSO
 *
 * Uma trilha sem local e sem função vale para a organização inteira. É o caso
 * mais comum e o mais fácil de entender errado, então o formulário escreve o
 * alvo em palavras enquanto a pessoa preenche, em vez de deixar para descobrir
 * depois de salvar.
 */

export interface TrilhaNaTela {
  id: string;
  title: string;
  summary: string;
  mode: "sequential" | "free";
  project: string | null;
  jobTitle: string | null;
  courseIds: string[];
}

export interface CursoNaTela {
  id: string;
  title: string;
}

export function TracksView({
  trilhas,
  cursos,
  linhas,
  semFuncao,
  unitLabel,
}: {
  trilhas: TrilhaNaTela[];
  cursos: CursoNaTela[];
  linhas: CelulaDaMatriz[];
  semFuncao: number;
  unitLabel: string;
}) {
  const router = useRouter();

  const [aberto, setAberto] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [project, setProject] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [mode, setMode] = useState<"sequential" | "free">("free");
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function alternarCurso(id: string) {
    setEscolhidos((atuais) =>
      atuais.includes(id) ? atuais.filter((item) => item !== id) : [...atuais, id],
    );
  }

  async function criar(evento: React.FormEvent) {
    evento.preventDefault();
    setBusy(true);
    setErro(null);

    try {
      const resposta = await fetch("/api/trilhas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, summary, mode, project, jobTitle, courseIds: escolhidos }),
      });

      const corpo = (await resposta.json().catch(() => ({}))) as { error?: string };

      if (!resposta.ok) {
        setErro(corpo.error ?? "Não foi possível criar a trilha.");
        return;
      }

      setTitle("");
      setSummary("");
      setProject("");
      setJobTitle("");
      setEscolhidos([]);
      setAberto(false);
      router.refresh();
    } catch {
      setErro("Não foi possível falar com o servidor. Verifique sua conexão.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <h1 className="page-head__title">Trilhas e matriz de treinamento</h1>
        <p className="page-head__sub">
          Uma trilha é uma sequência de cursos com um alvo: {unitLabel.toLowerCase()}, função, as
          duas coisas, ou toda a organização.
        </p>
      </div>

      {erro ? (
        <p className="error" role="alert">
          <AlertCircle aria-hidden="true" />
          <span>{erro}</span>
        </p>
      ) : null}

      <section className="course-section" aria-labelledby="trilhas">
        <h2 className="course-section__title" id="trilhas">
          <Route aria-hidden /> Trilhas
          {trilhas.length > 0 ? <span className="badge">{trilhas.length}</span> : null}
        </h2>

        {trilhas.length === 0 ? (
          <p className="platform__hint">
            Nenhuma trilha ainda. Enquanto não houver, a tela de trilhas do aluno fica vazia.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Trilha</th>
                  <th scope="col">Destinada a</th>
                  <th scope="col">Cursos</th>
                  <th scope="col">Ordem</th>
                </tr>
              </thead>
              <tbody>
                {trilhas.map((trilha) => (
                  <tr key={trilha.id}>
                    <td data-label="Trilha">
                      <strong>{trilha.title}</strong>
                      {trilha.summary ? (
                        <span className="retake-fila__meta"> · {trilha.summary}</span>
                      ) : null}
                    </td>
                    <td data-label="Destinada a">{alvoEmPalavras(trilha)}</td>
                    <td data-label="Cursos">{trilha.courseIds.length}</td>
                    <td data-label="Ordem">{trilha.mode === "sequential" ? "Sequencial" : "Livre"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {aberto ? (
          <form className="platform__form" onSubmit={criar} method="post">
            <div className="field">
              <label className="field__label" htmlFor="trilha-nome">
                Nome
              </label>
              <input
                className="input"
                id="trilha-nome"
                name="title"
                value={title}
                onChange={(evento) => setTitle(evento.target.value)}
                maxLength={120}
                placeholder="Ex.: Integração de operadores"
                {...campoObrigatorio("Dê um nome à trilha.")}
              />
            </div>

            <div className="field">
              <label className="field__label" htmlFor="trilha-resumo">
                Resumo
              </label>
              <input
                className="input"
                id="trilha-resumo"
                name="summary"
                value={summary}
                onChange={(evento) => setSummary(evento.target.value)}
                maxLength={200}
                placeholder="Uma linha sobre o objetivo da trilha."
              />
            </div>

            <div className="field">
              <label className="field__label" htmlFor="trilha-unidade">
                {unitLabel} (deixe em branco para não filtrar)
              </label>
              <input
                className="input"
                id="trilha-unidade"
                name="project"
                value={project}
                onChange={(evento) => setProject(evento.target.value)}
                maxLength={120}
                placeholder="Ex.: Unidade Norte"
              />
            </div>

            <div className="field">
              <label className="field__label" htmlFor="trilha-funcao">
                Função (deixe em branco para todas)
              </label>
              <input
                className="input"
                id="trilha-funcao"
                name="jobTitle"
                value={jobTitle}
                onChange={(evento) => setJobTitle(evento.target.value)}
                maxLength={120}
                placeholder="Ex.: Operador de Campo"
              />
              {/* O alvo escrito enquanto se preenche, e não depois de salvar:
                  os dois campos em branco são o caso mais comum e o mais fácil
                  de entender errado. */}
              <p className="platform__hint" role="status">
                Esta trilha vai aparecer para: <strong>{alvoEmPalavras({ project, jobTitle })}</strong>
              </p>
            </div>

            <div className="field">
              <span className="field__label">Cursos da trilha</span>
              {cursos.length === 0 ? (
                <p className="platform__hint">Publique um curso antes de montar a trilha.</p>
              ) : (
                <div className="prefs__col">
                  {cursos.map((curso) => (
                    <label className="checkbox" key={curso.id}>
                      <input
                        type="checkbox"
                        checked={escolhidos.includes(curso.id)}
                        onChange={() => alternarCurso(curso.id)}
                      />
                      <span aria-hidden="true" className="checkbox__box" />
                      <span>{curso.title}</span>
                    </label>
                  ))}
                </div>
              )}
              {escolhidos.length > 0 ? (
                <p className="platform__hint">
                  {escolhidos.length}{" "}
                  {escolhidos.length === 1 ? "curso escolhido" : "cursos escolhidos"}, na ordem em
                  que foram marcados.
                </p>
              ) : null}
            </div>

            <label className="checkbox">
              <input
                type="checkbox"
                checked={mode === "sequential"}
                onChange={(evento) => setMode(evento.target.checked ? "sequential" : "free")}
              />
              <span aria-hidden="true" className="checkbox__box" />
              <span>Liberar um curso por vez, na ordem</span>
            </label>

            <div className="retake-fila__acoes">
              <button type="submit" className="btn btn--primary" disabled={busy}>
                {busy ? "Criando" : "Criar trilha"}
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setAberto(false)}
                disabled={busy}
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          /* Dentro de um `div`, e não solto na seção: `.course-section` é um
             flex em coluna, e um botão como filho direto estica na largura
             toda — vira faixa, não botão. */
          <div className="retake-fila__acoes">
            <button type="button" className="btn btn--primary" onClick={() => setAberto(true)}>
              <Plus aria-hidden /> Nova trilha
            </button>
          </div>
        )}
      </section>

      <section className="course-section" aria-labelledby="matriz">
        <h2 className="course-section__title" id="matriz">
          <Users aria-hidden /> Matriz por função
        </h2>

        <p className="platform__hint">
          Uma linha por função, com quantas pessoas estão nela e o que ela encontra na plataforma.
          {semFuncao > 0
            ? semFuncao === 1
              ? " 1 pessoa está sem função cadastrada e só recebe as trilhas gerais."
              : ` ${semFuncao} pessoas estão sem função cadastrada e só recebem as trilhas gerais.`
            : ""}
        </p>

        {linhas.length === 0 ? (
          <p className="platform__hint">Nenhuma conta ativa para mostrar.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Função</th>
                  <th scope="col">Pessoas</th>
                  <th scope="col">Trilhas que alcançam</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((linha) => (
                  <tr key={linha.funcao ?? "sem-funcao"}>
                    <td data-label="Função">
                      {linha.funcao ?? (
                        /* A linha sem função não some: é a que interessa a quem
                           for arrumar o cadastro. */
                        <em className="retake-fila__meta">Sem função cadastrada</em>
                      )}
                    </td>
                    <td data-label="Pessoas">{linha.pessoas}</td>
                    <td data-label="Trilhas que alcançam">
                      {linha.trilhas.length === 0 ? (
                        <span className="retake-fila__meta">Nenhuma</span>
                      ) : (
                        linha.trilhas.join(" · ")
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

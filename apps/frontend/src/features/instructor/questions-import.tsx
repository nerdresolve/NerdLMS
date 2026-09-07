"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Download, FileUp } from "lucide-react";

import { MODELO_QUESTOES } from "@nerdlms/core/imports/questions-import.ts";
import { toCsv, UTF8_BOM } from "@nerdlms/core/reports/csv.ts";

import "./questions-import.css";

/**
 * Importação de questões por planilha — F5-05 (guia §24).
 *
 * Mesmo desenho da importação de usuários: **confere antes de gravar**, e o
 * plano é refeito no servidor na hora de aplicar.
 *
 * A conferência pesa mais aqui. Uma questão objetiva sem gabarito vale zero
 * para todo mundo que responder, e o erro só aparece na correção — quando a
 * prova já foi aplicada e não há como desfazer sem refazer a nota de todos.
 */

interface QuestaoPlano {
  linha: number;
  tipo: "single_choice" | "multiple_choice" | "true_false" | "essay";
  enunciado: string;
  pontos: number;
  categoria: string | null;
  alternativas: Array<{ texto: string; correta: boolean }>;
  situacao: "criar" | "erro";
  erro?: string;
}

interface Plano {
  linhas: QuestaoPlano[];
  criar: number;
  erros: number;
}

const TIPO_LABEL: Record<QuestaoPlano["tipo"], string> = {
  single_choice: "Escolha única",
  multiple_choice: "Múltiplas respostas",
  true_false: "Verdadeiro ou falso",
  essay: "Dissertativa",
};

export function QuestionsImport({ courseId }: { courseId: string }) {
  const [plano, setPlano] = useState<Plano | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [concluido, setConcluido] = useState<string | null>(null);

  const campoArquivo = useRef<HTMLInputElement>(null);

  function limpar() {
    setPlano(null);
    setArquivo(null);
    setAviso(null);
    if (campoArquivo.current) campoArquivo.current.value = "";
  }

  function baixarModelo() {
    const conteudo = UTF8_BOM + toCsv(MODELO_QUESTOES.headers, MODELO_QUESTOES.exemplo);
    const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "modelo-questoes.csv";
    link.click();

    URL.revokeObjectURL(url);
  }

  /**
   * QTI ou planilha, decidido pela EXTENSÃO.
   *
   * Pela extensão e não por um seletor a mais na tela: quem exporta de outro
   * LMS recebe um `.xml` e não deveria precisar saber o nome do padrão para
   * importá-lo. Um seletor errado daria "arquivo inválido" sobre um arquivo
   * perfeitamente válido.
   */
  function tipoDoArquivo(escolhido: File): "qti" | "questoes" {
    return /\.xml$/i.test(escolhido.name) ? "qti" : "questoes";
  }

  async function enviar(escolhido: File, aplicar: boolean) {
    const corpo = new FormData();
    corpo.append("arquivo", escolhido);
    corpo.append("cursoId", courseId);

    const tipo = tipoDoArquivo(escolhido);

    const resposta = await fetch(`/api/importacao?tipo=${tipo}${aplicar ? "&aplicar=1" : ""}`, {
      method: "POST",
      body: corpo,
    });

    return { resposta, dados: await resposta.json().catch(() => ({})) };
  }

  async function conferir(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const escolhido = campoArquivo.current?.files?.[0];
    if (!escolhido) {
      setAviso("Escolha o arquivo.");
      return;
    }

    setBusy(true);
    setAviso(null);
    setConcluido(null);

    try {
      const { resposta, dados } = await enviar(escolhido, false);

      if (!resposta.ok) {
        setAviso((dados as { error?: string }).error ?? "Não foi possível ler o arquivo.");
        return;
      }

      setPlano(dados as Plano);
      setArquivo(escolhido);
    } catch {
      setAviso("Não foi possível falar com o servidor.");
    } finally {
      setBusy(false);
    }
  }

  async function aplicar() {
    if (!arquivo || !plano) return;

    setBusy(true);
    setAviso(null);

    try {
      const { resposta, dados } = await enviar(arquivo, true);

      if (!resposta.ok) {
        setAviso((dados as { error?: string }).error ?? "Não foi possível importar.");
        return;
      }

      const { criadas = 0, categoriasNovas = 0 } = dados as {
        criadas?: number;
        categoriasNovas?: number;
      };

      setConcluido(
        `${criadas} ${criadas === 1 ? "questão importada" : "questões importadas"}.` +
          (categoriasNovas
            ? ` ${categoriasNovas} ${categoriasNovas === 1 ? "categoria nova" : "categorias novas"}.`
            : ""),
      );
      limpar();
    } catch {
      setAviso("Não foi possível falar com o servidor.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="editor__panel" aria-labelledby="importar-questoes">
      <h2 className="editor__panel-title" id="importar-questoes">
        <FileUp aria-hidden /> Importar questões
      </h2>

      <p className="qimport__hint">
        Uma planilha CSV com o enunciado, as alternativas e o gabarito. Nada entra no banco de
        questões antes de você conferir.
      </p>

      <form className="qimport__form" onSubmit={conferir}>
        <div className="field">
          <label className="field__label" htmlFor="arquivo-questoes">
            Arquivo
          </label>
          <input
            className="input"
            id="arquivo-questoes"
            type="file"
            accept=".csv,.xml,text/csv,application/xml,text/xml"
            ref={campoArquivo}
            onChange={() => {
              /* Trocar o arquivo invalida o plano: aplicar um plano de outro
                 arquivo criaria questões que ninguém conferiu. */
              setPlano(null);
              setConcluido(null);
            }}
          />
        </div>

        <div className="qimport__acoes">
          <button type="submit" className="btn btn--secondary" disabled={busy}>
            {busy ? "Conferindo…" : "Conferir arquivo"}
          </button>

          <button type="button" className="btn btn--ghost" onClick={baixarModelo}>
            <Download aria-hidden /> Baixar modelo
          </button>

          {/* Link e não botão: é uma navegação para um arquivo, e um link
              funciona com clique do meio, "salvar como" e sem JavaScript. */}
          <a className="btn btn--ghost" href={`/api/questoes/qti?curso=${courseId}`}>
            <Download aria-hidden /> Exportar em QTI
          </a>
        </div>

        <p className="qimport__dica">
          Planilha <code>.csv</code> ou arquivo <code>.xml</code> em QTI, exportado de outra
          plataforma. O formato é reconhecido pela extensão.
        </p>
      </form>

      {plano ? (
        <div className="qimport__plano">
          <h3 className="qimport__titulo">O que vai acontecer</h3>

          <p className="qimport__resumo">
            <strong>{plano.criar}</strong>{" "}
            {plano.criar === 1 ? "questão será criada" : "questões serão criadas"}
            {plano.erros > 0 ? (
              <span className="qimport__erros">
                <AlertTriangle aria-hidden /> {plano.erros} com problema — não serão criadas
              </span>
            ) : null}
          </p>

          <ul className="qimport__lista">
            {plano.linhas.map((questao) => (
              <li className="qimport__item" key={questao.linha} data-situacao={questao.situacao}>
                <div className="qimport__cabeca">
                  <span className="qimport__linha">Linha {questao.linha}</span>
                  <span className="qimport__tipo">{TIPO_LABEL[questao.tipo]}</span>
                  <span className="qimport__pontos">
                    {questao.pontos} {questao.pontos === 1 ? "ponto" : "pontos"}
                  </span>
                  {questao.categoria ? (
                    <span className="qimport__categoria">{questao.categoria}</span>
                  ) : null}
                </div>

                <p className="qimport__enunciado">{questao.enunciado || "(sem enunciado)"}</p>

                {questao.erro ? (
                  <p className="qimport__erro">{questao.erro}</p>
                ) : questao.alternativas.length > 0 ? (
                  <ul className="qimport__alternativas">
                    {questao.alternativas.map((alternativa, i) => (
                      <li key={i} data-correta={alternativa.correta ? "true" : undefined}>
                        {/* O gabarito é dito em PALAVRA, não só em cor: quem não
                            distingue verde leria a lista sem saber a resposta. */}
                        {alternativa.correta ? <strong>Correta:</strong> : null}{" "}
                        {alternativa.texto}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="qimport__nota">Corrigida à mão, sem alternativas.</p>
                )}
              </li>
            ))}
          </ul>

          <div className="qimport__acoes">
            <button
              type="button"
              className="btn btn--primary"
              onClick={aplicar}
              disabled={busy || plano.criar === 0}
            >
              {busy
                ? "Importando…"
                : plano.criar === 0
                  ? "Nada para importar"
                  : `Criar ${plano.criar} ${plano.criar === 1 ? "questão" : "questões"}`}
            </button>

            <button type="button" className="btn btn--ghost" onClick={limpar} disabled={busy}>
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      <p className="status-text" role="status">
        {concluido ?? aviso}
      </p>
    </section>
  );
}

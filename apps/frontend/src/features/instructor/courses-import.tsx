"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Download, FolderUp } from "lucide-react";

import { MODELO_CURSOS } from "@nerdlms/core/imports/courses-import.ts";
import { toCsv, UTF8_BOM } from "@nerdlms/core/reports/csv.ts";

import "./courses-import.css";

/**
 * Importação de cursos por planilha — F5-05 (guia §24).
 *
 * A conferência mostra a ÁRVORE: curso, módulos e aulas encaixados como vão
 * ficar. É o que responde a pergunta que a planilha plana não responde — "as
 * aulas caíram no módulo certo?" —, e é justamente o que a ordem das linhas
 * decide.
 */

interface AulaPlano {
  titulo: string;
  duracaoMinutos: number;
  formato: "video" | "document" | "text" | "external";
  paginas: number | null;
  url: string | null;
  linha: number;
}

interface ModuloPlano {
  titulo: string;
  aulas: AulaPlano[];
  linha: number;
}

interface CursoPlano {
  titulo: string;
  resumo: string;
  modulos: ModuloPlano[];
  linha: number;
}

interface Plano {
  cursos: CursoPlano[];
  erros: Array<{ linha: number; mensagem: string }>;
  totalModulos: number;
  totalAulas: number;
}

const FORMATO_LABEL: Record<AulaPlano["formato"], string> = {
  video: "Vídeo",
  document: "Documento",
  text: "Texto",
  external: "Link",
};

export function CoursesImport() {
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
    const conteudo = UTF8_BOM + toCsv(MODELO_CURSOS.headers, MODELO_CURSOS.exemplo);
    const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "modelo-cursos.csv";
    link.click();

    URL.revokeObjectURL(url);
  }

  async function enviar(escolhido: File, aplicar: boolean) {
    const corpo = new FormData();
    corpo.append("arquivo", escolhido);

    const resposta = await fetch(`/api/importacao?tipo=cursos${aplicar ? "&aplicar=1" : ""}`, {
      method: "POST",
      body: corpo,
    });

    return { resposta, dados: await resposta.json().catch(() => ({})) };
  }

  async function conferir(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const escolhido = campoArquivo.current?.files?.[0];
    if (!escolhido) {
      setAviso("Escolha o arquivo CSV.");
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

      const { cursos = 0, aulas = 0 } = dados as { cursos?: number; aulas?: number };

      setConcluido(
        `${cursos} ${cursos === 1 ? "curso criado" : "cursos criados"} com ${aulas} ${aulas === 1 ? "aula" : "aulas"}. ` +
          "Ficaram como rascunho: revise o conteúdo e publique quando estiver pronto.",
      );
      limpar();
    } catch {
      setAviso("Não foi possível falar com o servidor.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="course-section" aria-labelledby="importar-cursos">
      <h2 className="course-section__title" id="importar-cursos">
        <FolderUp aria-hidden /> Importar cursos
      </h2>

      <p className="cimport__hint">
        Uma planilha em que cada linha diz se é <strong>curso</strong>, <strong>módulo</strong> ou{" "}
        <strong>aula</strong> — a hierarquia vem da ordem, como num sumário. Os cursos entram como
        rascunho para você revisar antes de publicar.
      </p>

      <form className="cimport__form" onSubmit={conferir}>
        <div className="field">
          <label className="label" htmlFor="arquivo-cursos">
            Arquivo
          </label>
          <input
            className="input"
            id="arquivo-cursos"
            type="file"
            accept=".csv,text/csv"
            ref={campoArquivo}
            onChange={() => {
              setPlano(null);
              setConcluido(null);
            }}
          />
        </div>

        <div className="cimport__acoes">
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? "Conferindo…" : "Conferir arquivo"}
          </button>

          <button type="button" className="btn btn--ghost" onClick={baixarModelo}>
            <Download aria-hidden /> Baixar modelo
          </button>
        </div>
      </form>

      {plano ? (
        <div className="cimport__plano">
          <h3 className="cimport__titulo">O que vai acontecer</h3>

          <p className="cimport__resumo">
            <strong>{plano.cursos.length}</strong>{" "}
            {plano.cursos.length === 1 ? "curso" : "cursos"}, <strong>{plano.totalModulos}</strong>{" "}
            {plano.totalModulos === 1 ? "módulo" : "módulos"}, <strong>{plano.totalAulas}</strong>{" "}
            {plano.totalAulas === 1 ? "aula" : "aulas"}
          </p>

          {plano.erros.length > 0 ? (
            <div className="cimport__erros" role="group" aria-label="Linhas com problema">
              <p className="cimport__erros-titulo">
                <AlertTriangle aria-hidden /> {plano.erros.length}{" "}
                {plano.erros.length === 1 ? "linha com problema" : "linhas com problema"}
              </p>
              <ul className="cimport__erros-lista">
                {plano.erros.map((erro) => (
                  <li key={`${erro.linha}-${erro.mensagem}`}>
                    <strong>Linha {erro.linha}:</strong> {erro.mensagem}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* A árvore, como vai ficar. É o que responde "as aulas caíram no
              módulo certo?" — a pergunta que a planilha plana não responde. */}
          <ul className="cimport__arvore">
            {plano.cursos.map((curso) => (
              <li className="cimport__curso" key={`${curso.linha}-${curso.titulo}`}>
                <p className="cimport__curso-titulo">{curso.titulo}</p>
                {curso.resumo ? <p className="cimport__curso-resumo">{curso.resumo}</p> : null}

                <ul className="cimport__modulos">
                  {curso.modulos.map((modulo) => (
                    <li className="cimport__modulo" key={`${modulo.linha}-${modulo.titulo}`}>
                      <p className="cimport__modulo-titulo">
                        {modulo.titulo}
                        <span className="cimport__contagem">
                          {modulo.aulas.length} {modulo.aulas.length === 1 ? "aula" : "aulas"}
                        </span>
                      </p>

                      <ul className="cimport__aulas">
                        {modulo.aulas.map((aula) => (
                          <li key={`${aula.linha}-${aula.titulo}`}>
                            <span className="cimport__aula-titulo">{aula.titulo}</span>
                            <span className="cimport__aula-meta">
                              {FORMATO_LABEL[aula.formato]}
                              {aula.duracaoMinutos > 0 ? ` · ${aula.duracaoMinutos} min` : ""}
                              {aula.paginas ? ` · ${aula.paginas} páginas` : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>

          <div className="cimport__acoes">
            <button
              type="button"
              className="btn btn--primary"
              onClick={aplicar}
              disabled={busy || plano.cursos.length === 0}
            >
              {busy
                ? "Importando…"
                : plano.cursos.length === 0
                  ? "Nada para importar"
                  : `Criar ${plano.cursos.length} ${plano.cursos.length === 1 ? "curso" : "cursos"}`}
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

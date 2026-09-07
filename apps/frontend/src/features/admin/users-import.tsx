"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Download, Upload } from "lucide-react";

import { MODELO_USUARIOS } from "@nerdlms/core/imports/users-import.ts";
import { toCsv, UTF8_BOM } from "@nerdlms/core/reports/csv.ts";

import "./users-import.css";

/**
 * Importação de usuários em massa — F5-05 (guia §24).
 *
 * **Conferir antes de gravar.** A tela nunca importa direto: manda o arquivo,
 * mostra linha a linha o que vai acontecer, e só grava depois que a pessoa
 * confirma. Uma planilha de RH real tem erro de digitação e gente repetida —
 * importar direto e avisar depois deixaria o cliente com contas que ninguém
 * pediu e nenhum jeito simples de voltar atrás.
 */

interface LinhaPlano {
  linha: number;
  nome: string;
  email: string;
  papel: string;
  unidade: string | null;
  situacao: "criar" | "duplicada" | "existente" | "erro";
  erro?: string;
}

interface Plano {
  linhas: LinhaPlano[];
  criar: number;
  erros: number;
  duplicadas: number;
  existentes: number;
}

const PAPEL_LABEL: Record<string, string> = {
  learner: "Aluno",
  instructor: "Instrutor",
  manager: "Gestor",
  admin: "Administrador",
};

const SITUACAO_LABEL: Record<LinhaPlano["situacao"], string> = {
  criar: "Vai criar",
  duplicada: "Repetida na planilha",
  existente: "Já cadastrada",
  erro: "Não dá para criar",
};

export function UsersImport({ unitLabel }: { unitLabel: string }) {
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

  /** Baixa o modelo já preenchido com dois exemplos. */
  function baixarModelo() {
    const conteudo = UTF8_BOM + toCsv(MODELO_USUARIOS.headers, MODELO_USUARIOS.exemplo);
    const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "modelo-usuarios.csv";
    link.click();

    /* Sem isto o blob fica preso na memória da aba até ela fechar. */
    URL.revokeObjectURL(url);
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
      const corpo = new FormData();
      corpo.append("arquivo", escolhido);

      const resposta = await fetch("/api/importacao", { method: "POST", body: corpo });
      const dados = (await resposta.json().catch(() => ({}))) as Plano & { error?: string };

      if (!resposta.ok) {
        setAviso(dados.error ?? "Não foi possível ler o arquivo.");
        return;
      }

      setPlano(dados);
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
      const corpo = new FormData();
      /* O arquivo vai de novo, e o servidor refaz o plano: confiar no que a
         tela mandou deixaria alterar o papel de uma linha no navegador e criar
         um admin que a conferência não mostrou. */
      corpo.append("arquivo", arquivo);

      const resposta = await fetch("/api/importacao?aplicar=1", { method: "POST", body: corpo });
      const dados = (await resposta.json().catch(() => ({}))) as {
        criados?: number;
        recusados?: number;
        error?: string;
      };

      if (!resposta.ok) {
        setAviso(dados.error ?? "Não foi possível importar.");
        return;
      }

      const criados = dados.criados ?? 0;
      setConcluido(
        `${criados} ${criados === 1 ? "conta criada" : "contas criadas"}.` +
          (dados.recusados ? ` ${dados.recusados} recusada(s) pelo banco.` : "") +
          " Cada pessoa escolhe a própria senha no primeiro acesso.",
      );
      limpar();
    } catch {
      setAviso("Não foi possível falar com o servidor.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="course-section" aria-labelledby="importar">
      <h2 className="course-section__title" id="importar">
        <Upload aria-hidden /> Importar usuários
      </h2>

      <p className="platform__hint">
        Um arquivo CSV com as colunas <strong>Nome</strong>, <strong>Email</strong>,{" "}
        <strong>Papel</strong> e <strong>{unitLabel}</strong>. Nada é criado antes de você ver o
        que vai acontecer.
      </p>

      <form className="platform__form" onSubmit={conferir}>
        <div className="field">
          <label className="label" htmlFor="arquivo-usuarios">
            Arquivo
          </label>
          <input
            className="input"
            id="arquivo-usuarios"
            name="arquivo"
            type="file"
            accept=".csv,text/csv"
            ref={campoArquivo}
            onChange={() => {
              /* Trocar o arquivo invalida o plano da tela: aplicar um plano que
                 é de outro arquivo criaria gente que ninguém conferiu. */
              setPlano(null);
              setConcluido(null);
            }}
          />
        </div>

        <div className="importar__acoes">
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? "Conferindo" : "Conferir arquivo"}
          </button>

          <button type="button" className="btn btn--ghost" onClick={baixarModelo}>
            <Download aria-hidden /> Baixar modelo
          </button>
        </div>
      </form>

      {plano ? (
        <div className="importar__plano">
          <h3 className="importar__titulo">O que vai acontecer</h3>

          <ul className="importar__resumo">
            <li>
              <strong>{plano.criar}</strong> {plano.criar === 1 ? "conta nova" : "contas novas"}
            </li>
            {plano.existentes > 0 ? (
              <li>
                <strong>{plano.existentes}</strong> já cadastrada(s), não muda nada
              </li>
            ) : null}
            {plano.duplicadas > 0 ? (
              <li>
                <strong>{plano.duplicadas}</strong> repetida(s) na planilha
              </li>
            ) : null}
            {plano.erros > 0 ? (
              <li className="importar__erros">
                <AlertTriangle aria-hidden /> <strong>{plano.erros}</strong> com problema, essas
                linhas não serão criadas
              </li>
            ) : null}
          </ul>

          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">
                Linha a linha do arquivo, com o que acontece com cada uma
              </caption>
              <thead>
                <tr>
                  <th scope="col">Linha</th>
                  <th scope="col">Nome</th>
                  <th scope="col">E-mail</th>
                  <th scope="col">Papel</th>
                  <th scope="col">Situação</th>
                </tr>
              </thead>
              <tbody>
                {plano.linhas.map((linha) => (
                  <tr key={linha.linha} data-situacao={linha.situacao}>
                    <td data-label="Linha">{linha.linha}</td>
                    <td data-label="Nome">{linha.nome || "-"}</td>
                    <td data-label="E-mail">{linha.email || "-"}</td>
                    <td data-label="Papel">{PAPEL_LABEL[linha.papel] ?? linha.papel}</td>
                    <td data-label="Situação">
                      {SITUACAO_LABEL[linha.situacao]}
                      {linha.erro ? <span className="prefs__desc">{linha.erro}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="importar__acoes">
            <button
              type="button"
              className="btn btn--primary"
              onClick={aplicar}
              disabled={busy || plano.criar === 0}
            >
              {busy
                ? "Importando"
                : plano.criar === 0
                  ? "Nada para importar"
                  : `Criar ${plano.criar} ${plano.criar === 1 ? "conta" : "contas"}`}
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

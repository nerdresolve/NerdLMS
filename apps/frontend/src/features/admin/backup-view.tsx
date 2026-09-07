"use client";

import { useState } from "react";
import { AlertTriangle, DatabaseBackup, Download, Upload } from "lucide-react";

import "./backup.css";

/**
 * Backup e restauração — F5-06 (guia §24 e §5).
 *
 * A tela mais perigosa do produto, e por isso a mais explícita. Duas coisas
 * precisam ficar claras ANTES de qualquer clique:
 *
 *  1. O que o arquivo NÃO leva — a mídia fica no storage.
 *  2. Que restaurar NÃO sobrescreve. Quem espera "voltar ao estado do backup"
 *     precisa saber que o que existe hoje permanece.
 */

interface Conferido {
  escopo: "tenant" | "curso";
  origem: { tenantId: string; tenantSlug: string; courseSlug?: string };
  geradoEm: string;
  avisos: string[];
  conteudo: Array<{ tabela: string; linhas: number }>;
  deOutroCliente: boolean;
}

/** Nomes de tabela em português, para a tela não falar em schema. */
const TABELA_LABEL: Record<string, string> = {
  org_units: "Unidades",
  users: "Pessoas",
  tenant_features: "Funcionalidades",
  email_templates: "Textos de e-mail",
  tags: "Etiquetas",
  course_categories: "Categorias de curso",
  question_categories: "Categorias de questão",
  courses: "Cursos",
  modules: "Módulos",
  lessons: "Aulas",
  materials: "Materiais",
  course_tags: "Etiquetas dos cursos",
  course_classes: "Turmas",
  unlock_rules: "Regras de liberação",
  tracks: "Trilhas",
  track_courses: "Cursos das trilhas",
  questions: "Questões",
  question_options: "Alternativas",
  question_tags: "Etiquetas das questões",
  quizzes: "Provas",
  quiz_questions: "Questões das provas",
  assignments: "Trabalhos",
  rubrics: "Rubricas",
  rubric_criteria: "Critérios das rubricas",
  scorm_packages: "Pacotes SCORM",
  enrollments: "Matrículas",
  lesson_progress: "Progresso nas aulas",
  quiz_attempts: "Tentativas de prova",
  quiz_answers: "Respostas",
  submissions: "Entregas",
  submission_files: "Arquivos entregues",
  grade_entries: "Notas",
  rubric_scores: "Notas por critério",
  scorm_tracking: "Progresso SCORM",
  scorm_interactions: "Interações SCORM",
  comments: "Comentários",
  comment_votes: "Votos em comentários",
  forum_topics: "Tópicos do fórum",
  forum_posts: "Respostas do fórum",
  forum_attachments: "Anexos do fórum",
  forum_subscriptions: "Assinaturas do fórum",
  notifications: "Avisos",
  notification_preferences: "Preferências de aviso",
  webhooks: "Webhooks",
  api_keys: "Chaves de API",
  audit_log: "Auditoria",
};

function rotulo(tabela: string): string {
  return TABELA_LABEL[tabela] ?? tabela;
}

export function BackupView() {
  const [conferido, setConferido] = useState<Conferido | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [concluido, setConcluido] = useState<string | null>(null);

  async function conferir(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const escolhido = (event.currentTarget.elements.namedItem("arquivo") as HTMLInputElement)
      ?.files?.[0];

    if (!escolhido) {
      setAviso("Escolha o arquivo de backup.");
      return;
    }

    setBusy(true);
    setAviso(null);
    setConcluido(null);

    try {
      const corpo = new FormData();
      corpo.append("arquivo", escolhido);

      const resposta = await fetch("/api/backup", { method: "POST", body: corpo });
      const dados = (await resposta.json().catch(() => ({}))) as Conferido & { error?: string };

      if (!resposta.ok) {
        setAviso(dados.error ?? "Não foi possível ler o arquivo.");
        return;
      }

      setConferido(dados);
      setArquivo(escolhido);
    } catch {
      setAviso("Não foi possível falar com o servidor.");
    } finally {
      setBusy(false);
    }
  }

  async function restaurar() {
    if (!arquivo || !conferido) return;

    const total = conferido.conteudo.reduce((soma, item) => soma + item.linhas, 0);

    if (
      !confirm(
        `Restaurar ${total} registros de "${conferido.origem.tenantSlug}"?\n\n` +
          "O que já existe NÃO será sobrescrito, só entram registros novos.\n\n" +
          "Esta ação fica registrada na auditoria.",
      )
    ) {
      return;
    }

    setBusy(true);
    setAviso(null);

    try {
      const corpo = new FormData();
      corpo.append("arquivo", arquivo);

      const resposta = await fetch("/api/backup?restaurar=1", { method: "POST", body: corpo });
      const dados = (await resposta.json().catch(() => ({}))) as {
        total?: number;
        ignoradas?: Record<string, number>;
        error?: string;
      };

      if (!resposta.ok) {
        setAviso(dados.error ?? "Não foi possível restaurar.");
        return;
      }

      const ignoradas = Object.values(dados.ignoradas ?? {}).reduce((a, b) => a + b, 0);

      setConcluido(
        `${dados.total ?? 0} ${dados.total === 1 ? "registro restaurado" : "registros restaurados"}.` +
          (ignoradas ? ` ${ignoradas} já existiam e foram mantidos como estavam.` : ""),
      );
      setConferido(null);
      setArquivo(null);
    } catch {
      setAviso("Não foi possível falar com o servidor.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="course-section" aria-labelledby="backup">
      <h2 className="course-section__title" id="backup">
        <DatabaseBackup aria-hidden /> Backup e restauração
      </h2>

      <p className="platform__hint">
        O backup leva os <strong>registros</strong> da sua organização, pessoas, cursos,
        matrículas, notas e histórico. Guarde o arquivo fora da plataforma.
      </p>

      {/* O aviso vem ANTES do botão, não depois: quem baixa precisa saber o que
          não está no arquivo enquanto ainda decide se aquilo basta. */}
      <div className="backup__aviso" role="note">
        <AlertTriangle aria-hidden />
        <div>
          <p>
            <strong>Os vídeos, PDFs e imagens não vão no arquivo</strong>, só as referências a
            eles. Restaurar em outro ambiente exige copiar o storage também.
          </p>
          <p>
            As senhas vêm como hash. Sessões abertas e tokens de troca de senha ficam de fora: são
            estado do momento, não conteúdo.
          </p>
        </div>
      </div>

      <div className="backup__acoes">
        <a className="btn btn--primary" href="/api/backup" download>
          <Download aria-hidden /> Baixar backup da organização
        </a>
      </div>

      <h3 className="backup__subtitulo">Restaurar de um arquivo</h3>

      <p className="platform__hint">
        A restauração <strong>não sobrescreve</strong>: o que já existe fica como está, e só
        entram registros que faltam. Serve para recuperar o que se perdeu e para trazer conteúdo
        da mesma organização. O <strong>histórico de auditoria não volta</strong>, ele sai no
        arquivo, mas restaurá-lo faria a mesma ação aparecer duas vezes.
      </p>

      <form className="platform__form" onSubmit={conferir}>
        <div className="field">
          <label className="label" htmlFor="arquivo-backup">
            Arquivo de backup
          </label>
          <input
            className="input"
            id="arquivo-backup"
            name="arquivo"
            type="file"
            accept=".json,application/json"
            onChange={() => {
              setConferido(null);
              setConcluido(null);
            }}
          />
        </div>

        <button type="submit" className="btn btn--secondary" disabled={busy}>
          {busy ? "Conferindo…" : "Conferir arquivo"}
        </button>
      </form>

      {conferido ? (
        <div className="backup__conferido">
          <h4 className="backup__subtitulo">O que há neste arquivo</h4>

          <p className="backup__origem">
            Backup {conferido.escopo === "curso" ? "de curso" : "de cliente"},{" "}
            <strong>{conferido.origem.courseSlug ?? conferido.origem.tenantSlug}</strong>, gerado
            em {new Date(conferido.geradoEm).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
          </p>

          {conferido.deOutroCliente ? (
            <div className="backup__aviso backup__aviso--forte" role="alert">
              <AlertTriangle aria-hidden />
              <p>
                Este backup é de <strong>outra organização</strong> ({conferido.origem.tenantSlug}) e{" "}
                <strong>não pode ser restaurado aqui</strong>. A restauração só funciona na mesma
                organização que gerou o arquivo.
              </p>
            </div>
          ) : null}

          <ul className="backup__tabelas">
            {conferido.conteudo.map((item) => (
              <li key={item.tabela}>
                <span>{rotulo(item.tabela)}</span>
                <strong>{item.linhas.toLocaleString("pt-BR")}</strong>
              </li>
            ))}
          </ul>

          <div className="backup__acoes">
            {/* Sem botão quando o backup é de outro cliente: oferecer uma ação
                que será recusada é fazer a pessoa descobrir no erro. */}
            {conferido.deOutroCliente ? null : (
              <button type="button" className="btn btn--primary" onClick={restaurar} disabled={busy}>
                <Upload aria-hidden /> {busy ? "Restaurando…" : "Restaurar"}
              </button>
            )}

            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setConferido(null)}
              disabled={busy}
            >
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

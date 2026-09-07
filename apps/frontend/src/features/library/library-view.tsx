"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  FileSpreadsheet,
  FileText,
  Presentation,
  Search,
  Trash2,
  Upload,
} from "lucide-react";

import {
  ROTULO_DO_TIPO,
  filtrarBiblioteca,
  semTema,
  temasDaBiblioteca,
  type ItemDaBiblioteca,
  type TipoDeConteudo,
} from "@nerdlms/core/courses/biblioteca.ts";

import { campoObrigatorio } from "@/lib/campo-obrigatorio.ts";

import "./library.css";

/**
 * A biblioteca de conteúdos.
 *
 * Procedimento, norma interna, ficha de segurança: documento que vale por si e
 * que ninguém acha navegando. Acha procurando — por assunto, por tipo, ou por
 * uma palavra do nome.
 *
 * O FILTRO ACONTECE NA TELA
 *
 * A lista inteira do cliente vem do servidor e é filtrada aqui, a cada tecla.
 * Uma biblioteca de organização tem dezenas de documentos, não milhões, e uma
 * viagem ao servidor por letra digitada daria uma busca que sempre parece
 * atrasada. A regra está em `core/courses/biblioteca.ts`, testada; aqui fica
 * só a tela.
 *
 * "SEM TEMA" É UM FILTRO, E NÃO O ESTADO VAZIO DA BARRA
 *
 * O botão "Todos" limpa; o botão "Sem tema" seleciona os que não têm assunto
 * definido. Confundir os dois faria o estado inicial da tela esconder
 * documentos.
 */

const ICONE: Record<TipoDeConteudo, typeof FileText> = {
  pdf: FileText,
  spreadsheet: FileSpreadsheet,
  slides: Presentation,
  document: FileText,
};

/**
 * O valor que o botão de tema guarda quando a escolha é "os sem tema".
 *
 * Um símbolo, e não texto. O estado do filtro divide espaço com NOMES DE TEMA,
 * que a organização escreve — nenhum texto é garantidamente livre, e um tema
 * chamado "sem tema" ligaria os dois filtros ao mesmo tempo. Símbolo nunca é
 * igual a uma string, e o compilador cobra o caso nos três lugares que leem o
 * estado.
 *
 * Antes o valor era a palavra "sem-tema" precedida de um caractere NUL. Aquilo
 * tornava a colisão impossível pelo mesmo motivo, e ao custo de o Git tratar o
 * arquivo inteiro como binário: esta tela não aparecia em diff nenhum, e
 * nenhuma revisão dela mostrava o que havia mudado.
 */
const SEM_TEMA = Symbol("sem-tema");

export interface TemaDisponivel {
  id: string;
  name: string;
}

export function LibraryView({
  documentos,
  temasCadastrados,
  podePublicar,
  podeDefinirAssunto,
}: {
  documentos: ItemDaBiblioteca[];
  temasCadastrados: TemaDisponivel[];
  podePublicar: boolean;
  /**
   * Quem define o vocabulário de assuntos da organização.
   *
   * Separado de `podePublicar` de propósito: o instrutor publica documento, o
   * administrador decide como a organização nomeia os assuntos. Um campo de
   * texto livre para cada quem publica criaria "Segurança", "seguranca" e
   * "Segurança " como três assuntos, e o filtro devolveria um terço em cada.
   */
  podeDefinirAssunto: boolean;
}) {
  const router = useRouter();

  const [tema, setTema] = useState<string | null | typeof SEM_TEMA>(null);
  const [tipo, setTipo] = useState<TipoDeConteudo | null>(null);
  const [busca, setBusca] = useState("");

  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [descricao, setDescricao] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [novoAssunto, setNovoAssunto] = useState("");

  const temas = useMemo(() => temasDaBiblioteca(documentos), [documentos]);
  const orfaos = useMemo(() => semTema(documentos), [documentos]);

  const visiveis = useMemo(() => {
    if (tema === SEM_TEMA) {
      return filtrarBiblioteca(documentos, { tipo, busca }).filter((doc) => doc.tema === null);
    }
    return filtrarBiblioteca(documentos, { tema: typeof tema === "string" ? tema : null, tipo, busca });
  }, [documentos, tema, tipo, busca]);

  async function baixar(id: string) {
    setErro(null);

    try {
      const resposta = await fetch(`/api/biblioteca/${id}`);
      const corpo = (await resposta.json().catch(() => ({}))) as { url?: string; error?: string };

      if (!resposta.ok || !corpo.url) {
        setErro(corpo.error ?? "Não foi possível abrir o documento.");
        return;
      }

      /* Nova aba: o PDF abre no visualizador do navegador e a biblioteca fica
         onde estava, com o filtro que a pessoa montou. */
      window.open(corpo.url, "_blank", "noopener");
    } catch {
      setErro("Não foi possível falar com o servidor. Verifique sua conexão.");
    }
  }

  async function publicar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!arquivo) return;

    setEnviando(true);
    setErro(null);
    setAviso(null);

    try {
      /* O arquivo vai DIRETO para o storage por URL assinada; o servidor só
         registra a linha. Um PDF de 80 MB não atravessa o processo do Next. */
      const assinatura = await fetch("/api/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scope: "biblioteca", filename: arquivo.name }),
      });

      const dados = (await assinatura.json().catch(() => ({}))) as {
        url?: string;
        key?: string;
        contentType?: string;
        error?: string;
      };

      if (!assinatura.ok || !dados.url || !dados.key) {
        setErro(dados.error ?? "Não foi possível preparar o envio.");
        return;
      }

      const envio = await fetch(dados.url, {
        method: "PUT",
        headers: dados.contentType ? { "content-type": dados.contentType } : {},
        body: arquivo,
      });

      if (!envio.ok) {
        setErro("O arquivo não chegou ao servidor de arquivos.");
        return;
      }

      const registro = await fetch("/api/biblioteca", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: arquivo.name,
          description: descricao,
          categoryId: categoriaId || null,
          storageKey: dados.key,
          sizeBytes: arquivo.size,
        }),
      });

      const corpo = (await registro.json().catch(() => ({}))) as { error?: string };

      if (!registro.ok) {
        setErro(corpo.error ?? "Não foi possível publicar o documento.");
        return;
      }

      setArquivo(null);
      setDescricao("");
      setCategoriaId("");
      setAberto(false);
      setAviso(`${arquivo.name} publicado.`);
      router.refresh();
    } catch {
      setErro("Não foi possível falar com o servidor. Verifique sua conexão.");
    } finally {
      setEnviando(false);
    }
  }

  async function criarAssunto() {
    const nome = novoAssunto.trim();
    if (nome.length < 2) return;

    setErro(null);

    try {
      const resposta = await fetch("/api/assuntos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: nome }),
      });

      const corpo = (await resposta.json().catch(() => ({}))) as { error?: string };

      if (!resposta.ok) {
        setErro(corpo.error ?? "Não foi possível criar o assunto.");
        return;
      }

      setNovoAssunto("");
      setAviso(`Assunto "${nome}" criado.`);
      router.refresh();
    } catch {
      setErro("Não foi possível falar com o servidor. Verifique sua conexão.");
    }
  }

  async function remover(id: string, nome: string) {
    setErro(null);

    try {
      const resposta = await fetch("/api/biblioteca", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ materialId: id }),
      });

      const corpo = (await resposta.json().catch(() => ({}))) as { error?: string };

      if (!resposta.ok) {
        setErro(corpo.error ?? "Não foi possível remover o documento.");
        return;
      }

      setAviso(`${nome} removido.`);
      router.refresh();
    } catch {
      setErro("Não foi possível falar com o servidor. Verifique sua conexão.");
    }
  }

  return (
    <>
      <div className="page-head">
        <h1 className="page-head__title">Biblioteca</h1>
        <p className="page-head__sub">
          Procedimentos, normas e documentos da organização. Filtre por assunto ou procure por
          uma palavra do nome.
        </p>
      </div>

      {erro ? (
        <p className="error" role="alert">
          <AlertCircle aria-hidden="true" />
          <span>{erro}</span>
        </p>
      ) : null}

      <p className="status-text" role="status">
        {aviso}
      </p>

      <div className="biblioteca__barra">
        <div className="biblioteca__busca">
          <Search aria-hidden />
          <label className="sr-only" htmlFor="biblioteca-busca">
            Procurar na biblioteca
          </label>
          <input
            className="input"
            id="biblioteca-busca"
            type="search"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Procure por nome ou descrição"
          />
        </div>

        <div className="biblioteca__filtros" role="group" aria-label="Filtrar por assunto">
          <button
            type="button"
            className="chip"
            data-ativo={tema === null || undefined}
            onClick={() => setTema(null)}
          >
            Todos
          </button>

          {temas.map((item) => (
            <button
              type="button"
              className="chip"
              data-ativo={tema === item.nome || undefined}
              key={item.nome}
              onClick={() => setTema(item.nome)}
            >
              {item.nome} <span className="chip__conta">{item.documentos}</span>
            </button>
          ))}

          {orfaos > 0 ? (
            <button
              type="button"
              className="chip"
              data-ativo={tema === SEM_TEMA || undefined}
              onClick={() => setTema(SEM_TEMA)}
            >
              Sem tema <span className="chip__conta">{orfaos}</span>
            </button>
          ) : null}
        </div>

        <div className="biblioteca__filtros" role="group" aria-label="Filtrar por tipo">
          <button
            type="button"
            className="chip"
            data-ativo={tipo === null || undefined}
            onClick={() => setTipo(null)}
          >
            Qualquer tipo
          </button>

          {(Object.keys(ROTULO_DO_TIPO) as TipoDeConteudo[]).map((chave) => (
            <button
              type="button"
              className="chip"
              data-ativo={tipo === chave || undefined}
              key={chave}
              onClick={() => setTipo(chave)}
            >
              {ROTULO_DO_TIPO[chave]}
            </button>
          ))}
        </div>
      </div>

      {podePublicar ? (
        <section className="course-section" aria-labelledby="publicar">
          <h2 className="course-section__title" id="publicar">
            <Upload aria-hidden /> Publicar documento
          </h2>

          {aberto ? (
            <form className="platform__form" onSubmit={publicar} method="post">
              <div className="field">
                <label className="field__label" htmlFor="biblioteca-arquivo">
                  Arquivo
                </label>
                <input
                  className="input input--file"
                  id="biblioteca-arquivo"
                  type="file"
                  accept=".pdf,.doc,.docx,.odt,.xls,.xlsx,.csv,.ods,.ppt,.pptx,.odp"
                  onChange={(evento) => setArquivo(evento.target.files?.[0] ?? null)}
                  {...campoObrigatorio("Escolha o arquivo a publicar.")}
                />
              </div>

              <div className="field">
                <label className="field__label" htmlFor="biblioteca-descricao">
                  O que é este documento
                </label>
                <input
                  className="input"
                  id="biblioteca-descricao"
                  value={descricao}
                  onChange={(evento) => setDescricao(evento.target.value)}
                  maxLength={200}
                  /* O nome do arquivo raramente basta: "PO-034-rev7.pdf" não
                     diz a ninguém o que tem dentro, e é pela descrição que a
                     busca vai encontrá-lo. */
                  placeholder="Ex.: procedimento de trabalho em altura"
                />
              </div>

              <div className="field">
                <label className="field__label" htmlFor="biblioteca-tema">
                  Assunto
                </label>
                <select
                  className="select"
                  id="biblioteca-tema"
                  value={categoriaId}
                  onChange={(evento) => setCategoriaId(evento.target.value)}
                >
                  <option value="">Sem assunto definido</option>
                  {temasCadastrados.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>

                {/* Uma lista vazia sem explicação faz a pessoa procurar o botão
                    que criaria o assunto. A frase diz onde ele está — ou que
                    não é dela a decisão. */}
                {temasCadastrados.length === 0 && !podeDefinirAssunto ? (
                  <p className="platform__hint">
                    Nenhum assunto cadastrado. A administração define os assuntos da organização.
                  </p>
                ) : null}

                {podeDefinirAssunto ? (
                  <div className="biblioteca__novo-assunto">
                    <label className="sr-only" htmlFor="biblioteca-novo-assunto">
                      Nome do novo assunto
                    </label>
                    <input
                      className="input"
                      id="biblioteca-novo-assunto"
                      value={novoAssunto}
                      onChange={(evento) => setNovoAssunto(evento.target.value)}
                      maxLength={60}
                      placeholder="Ou crie um assunto: Segurança, Operação…"
                    />
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => void criarAssunto()}
                      disabled={novoAssunto.trim().length < 2}
                    >
                      Criar assunto
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="retake-fila__acoes">
                <button type="submit" className="btn btn--primary" disabled={!arquivo || enviando}>
                  {enviando ? "Publicando" : "Publicar"}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setAberto(false)}
                  disabled={enviando}
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            /* "Novo documento", e não "Publicar documento": o título da seção
               logo acima já diz isso, e as duas frases idênticas em sequência
               são ruído. Mesmo idioma de "Novo curso" e "Nova trilha". */
            <div className="retake-fila__acoes">
              <button type="button" className="btn btn--primary" onClick={() => setAberto(true)}>
                <Upload aria-hidden /> Novo documento
              </button>
            </div>
          )}
        </section>
      ) : null}

      <section className="course-section" aria-labelledby="acervo">
        <h2 className="course-section__title" id="acervo">
          {visiveis.length === documentos.length
            ? `${documentos.length} ${documentos.length === 1 ? "documento" : "documentos"}`
            : `${visiveis.length} de ${documentos.length}`}
        </h2>

        {documentos.length === 0 ? (
          <div className="empty">
            <span className="empty__rule" aria-hidden="true" />
            <div className="empty__inner">
              <span className="empty__icon">
                <FileText aria-hidden />
              </span>
              <h3 className="empty__title">Biblioteca vazia</h3>
              <p className="empty__text">
                Procedimentos, normas e fichas publicados aqui ficam disponíveis para toda a
                organização, sem depender de matrícula em curso.
              </p>
            </div>
          </div>
        ) : visiveis.length === 0 ? (
          /* Filtro sem resultado NÃO é o mesmo que biblioteca vazia: a saída de
             um é limpar o filtro, a do outro é publicar um documento. */
          <div className="empty">
            <span className="empty__rule" aria-hidden="true" />
            <div className="empty__inner">
              <span className="empty__icon">
                <Search aria-hidden />
              </span>
              <h3 className="empty__title">Nada com esses filtros</h3>
              <p className="empty__text">
                Nenhum dos {documentos.length} documentos combina com o que você escolheu.
              </p>
            </div>
          </div>
        ) : (
          <ul className="biblioteca__lista">
            {visiveis.map((doc) => {
              const Icone = ICONE[doc.kind];

              return (
                <li className="biblioteca__item" key={doc.id}>
                  <span className="biblioteca__icone" data-tipo={doc.kind}>
                    <Icone aria-hidden />
                  </span>

                  <div className="biblioteca__texto">
                    <button
                      type="button"
                      className="biblioteca__nome"
                      onClick={() => void baixar(doc.id)}
                    >
                      {doc.name}
                    </button>
                    {doc.description ? (
                      <p className="biblioteca__descricao">{doc.description}</p>
                    ) : null}
                    <p className="biblioteca__meta">
                      {ROTULO_DO_TIPO[doc.kind]} · {doc.sizeLabel}
                      {doc.tema ? ` · ${doc.tema}` : ""}
                    </p>
                  </div>

                  {podePublicar ? (
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => void remover(doc.id, doc.name)}
                      aria-label={`Remover ${doc.name}`}
                    >
                      <Trash2 aria-hidden />
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

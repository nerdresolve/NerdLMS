"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, ExternalLink, FileText } from "lucide-react";

import { KIND_LABEL, readingProgress, type ContentKind } from "@nerdlms/core/courses/content.ts";

/**
 * Aula de documento — o curso que se lê.
 *
 * O guia §4 pede muito mais que vídeo, e há cursos que existem justamente para
 * a pessoa passar pelo material inteiro. Por isso este componente não só EXIBE:
 * ele rastreia por onde a pessoa passou, e é esse rastro que libera o botão de
 * concluir.
 *
 * PDF abre embutido — o navegador já o renderiza, sem biblioteca e sem mandar
 * o arquivo para servidor de terceiro, o que importa num treinamento com
 * conteúdo interno. Os formatos de escritório ficam para download, com o tipo
 * anunciado.
 */

export function DocumentViewer({
  src,
  kind,
  title,
  pageCount,
  pagesSeen,
  onPageSeen,
}: {
  src: string;
  kind: ContentKind;
  title: string;
  pageCount?: number;
  pagesSeen: number[];
  /** Avisa que a pessoa chegou nesta página. */
  onPageSeen: (page: number) => void;
}) {
  const [pagina, setPagina] = useState(1);

  /* As páginas vistas NESTA sessão, somadas às que vieram do servidor.

     `pagesSeen` é a prop carregada quando a página abriu e não muda depois — o
     servidor não reenvia a cada virada. Sem acumular aqui, o percentual só
     contava a primeira e a atual: cinco de cinco páginas lidas mostravam 40%,
     que foi o que apareceu ao testar. */
  const [vistasLocais, setVistasLocais] = useState<number[]>(pagesSeen);
  const percentual = readingProgress([...vistasLocais, pagina], pageCount);

  /* A primeira página conta assim que a aula abre: quem está vendo já a viu. */
  const jaAvisou = useRef(new Set<number>());

  useEffect(() => {
    if (jaAvisou.current.has(pagina)) return;
    jaAvisou.current.add(pagina);

    setVistasLocais((atuais) => (atuais.includes(pagina) ? atuais : [...atuais, pagina]));
    onPageSeen(pagina);
  }, [pagina, onPageSeen]);

  const total = pageCount ?? 0;

  function irPara(destino: number) {
    if (destino < 1 || (total > 0 && destino > total)) return;
    setPagina(destino);
  }

  /* Sem contagem de páginas não há como navegar página a página; o documento
     aparece inteiro e a rolagem é do próprio visualizador do navegador. */
  const navegavel = total > 1;

  if (kind === "pdf") {
    return (
      <div className="doc">
        <div className="doc__frame">
          {/* `#page=` é entendido pelo visualizador nativo do navegador; a
              chave no `key` força recarregar ao mudar de página, senão o
              fragmento sozinho não move o documento já carregado. */}
          <iframe
            key={pagina}
            className="doc__embed"
            src={`${src}#page=${pagina}&toolbar=1&view=FitH`}
            title={title}
          />
        </div>

        {navegavel ? (
          <div className="doc__nav">
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              disabled={pagina <= 1}
              onClick={() => irPara(pagina - 1)}
            >
              <ChevronLeft aria-hidden /> Anterior
            </button>

            <p className="doc__counter" aria-live="polite">
              Página {pagina} de {total}
              {percentual !== null ? <span className="doc__read"> · {percentual}% lido</span> : null}
            </p>

            <button
              type="button"
              className="btn btn--primary btn--sm"
              disabled={pagina >= total}
              onClick={() => irPara(pagina + 1)}
            >
              Próxima <ChevronRight aria-hidden />
            </button>
          </div>
        ) : null}

        {/* Baixar é sempre oferecido: o visualizador embutido não serve a quem
            usa leitor de tela com o PDF aberto no aplicativo próprio. */}
        <p className="doc__actions">
          <a className="btn btn--ghost btn--sm" href={src} download>
            <Download aria-hidden /> Baixar o arquivo
          </a>
        </p>
      </div>
    );
  }

  if (kind === "image") {
    return (
      <div className="doc">
        <img className="doc__image" src={src} alt={title} />
      </div>
    );
  }

  if (kind === "audio") {
    return (
      <div className="doc">
        {/* `controls` sem `autoplay`: começar sozinho num escritório é hostil. */}
        <audio className="doc__audio" src={src} controls preload="metadata" />
      </div>
    );
  }

  if (kind === "link") {
    return (
      <div className="doc doc--placeholder">
        <span className="doc__icon">
          <ExternalLink aria-hidden />
        </span>
        <p className="doc__text">Esta aula está em um site externo.</p>
        {/* `noopener` porque a página de destino não é nossa. */}
        <a className="btn btn--primary" href={src} target="_blank" rel="noopener noreferrer">
          Abrir <ExternalLink aria-hidden />
        </a>
      </div>
    );
  }

  /* Slides, documentos e planilhas: o navegador não renderiza, e converter no
     servidor exigiria LibreOffice no container. Baixar é honesto — e o tipo
     aparece para a pessoa saber o que vai abrir. */
  return (
    <div className="doc doc--placeholder">
      <span className="doc__icon">
        <FileText aria-hidden />
      </span>
      <p className="doc__text">
        {KIND_LABEL[kind]} — abra no aplicativo do seu computador.
      </p>
      <a className="btn btn--primary" href={src} download>
        <Download aria-hidden /> Baixar {KIND_LABEL[kind].toLowerCase()}
      </a>
    </div>
  );
}

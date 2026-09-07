"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Inbox, Search } from "lucide-react";

import { CourseCard } from "@/features/dashboard/dashboard-view.tsx";
import { EnrollButton } from "./enroll-button.tsx";
import { useFeature } from "@/features/tenant/feature-context.tsx";

import { SaveButton } from "./save-button.tsx";
import {
  catalogCounts,
  queryCatalog,
  type CatalogItem,
  type CatalogFilter,
  type CatalogSort,
} from "@nerdlms/core/courses/catalog.ts";

import "./catalog.css";

/* A ordem segue o percurso do aluno, e os três primeiros somam o total de
   "Todos". "Salvos" atravessa os outros e por isso vem depois. */
const TABS: Array<{ id: CatalogFilter; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "not_started", label: "Não iniciados" },
  { id: "in_progress", label: "Em andamento" },
  { id: "completed", label: "Concluídos" },
  { id: "saved", label: "Salvos" },
];

const SORTS: Array<{ id: CatalogSort; label: string }> = [
  { id: "continue", label: "Continuar de onde parei" },
  { id: "alphabetical", label: "Ordem alfabética" },
  { id: "progress", label: "Maior progresso" },
];

export interface CatalogViewProps {
  /* `CatalogItem` e não `CatalogEntry`: a view usa só curso, resumo e o
     marcador de salvo. Aceitar o contrato mínimo permite que a biblioteca —
     onde a matrícula pode não existir — reaproveite esta tela sem duplicá-la. */
  entries: Array<CatalogItem & { enrolled?: boolean }>;
  title: string;
  subtitle: string;
  /** Filtro inicial. "Concluídos" e "Favoritos" são a mesma tela com outro recorte. */
  initialFilter?: CatalogFilter;
  /** Quando a tela é dedicada a um recorte, a barra de abas não faz sentido. */
  showTabs?: boolean;
  /**
   * Mostra o botão de matrícula abaixo de cada card. A biblioteca liga;
   * "Meus cursos" não, porque lá a pessoa já está matriculada em tudo.
   *
   * É um booleano e não uma função de renderização: função não atravessa a
   * fronteira servidor→cliente (o React não consegue serializar), e a página
   * que monta esta tela roda no servidor.
   */
  showEnroll?: boolean;
  emptyTitle: string;
  emptyText: string;
  /**
   * Categorias do cliente, para o seletor de assunto.
   *
   * Vem pronta e achatada em `<optgroup>` pela página: a árvore inteira não
   * atravessa a fronteira servidor→cliente sem motivo, e o seletor só precisa
   * de dois níveis para agrupar.
   */
  categories?: CategoryChoice[];
}

export interface CategoryChoice {
  slug: string;
  name: string;
  /** Nome da categoria mãe. Ausente quando esta é raiz. */
  parentName?: string;
}

export function CatalogView({
  entries,
  title,
  subtitle,
  initialFilter = "all",
  showTabs = true,
  showEnroll = false,
  emptyTitle,
  emptyText,
  categories = [],
}: CatalogViewProps) {
  const [filter, setFilter] = useState<CatalogFilter>(initialFilter);
  const [sort, setSort] = useState<CatalogSort>("continue");
  const podeFavoritar = useFeature("favoritos");
  const [search, setSearch] = useState("");
  const [categorySlug, setCategorySlug] = useState("");

  const counts = useMemo(() => catalogCounts(entries), [entries]);
  const visible = useMemo(
    () => queryCatalog(entries, { filter, sort, search, ...(categorySlug ? { categorySlug } : {}) }),
    [entries, filter, sort, search, categorySlug],
  );

  /* Agrupa por categoria mãe para o `<optgroup>`. As raízes ficam soltas, sem
     grupo: envolvê-las num grupo de nome igual ao próprio item seria ruído. */
  const gruposDeCategoria = useMemo(() => {
    const grupos = new Map<string, CategoryChoice[]>();
    const soltas: CategoryChoice[] = [];

    for (const item of categories) {
      if (!item.parentName) {
        soltas.push(item);
        continue;
      }
      const lista = grupos.get(item.parentName) ?? [];
      lista.push(item);
      grupos.set(item.parentName, lista);
    }

    return { grupos: [...grupos.entries()], soltas };
  }, [categories]);

  function onTabKeyDown(event: React.KeyboardEvent, index: number) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const step = event.key === "ArrowRight" ? 1 : -1;
    const next = TABS[(index + step + TABS.length) % TABS.length];
    if (next) {
      setFilter(next.id);
      document.getElementById(`tab-${next.id}`)?.focus();
    }
  }

  return (
    <div className="catalog">
      <div className="page-head">
        <h1 className="page-head__title">{title}</h1>
        <p className="page-head__sub">{subtitle}</p>
      </div>

      <div className="catalog__toolbar">
        <div className="search">
          <Search aria-hidden />
          <label className="sr-only" htmlFor="busca">
            Buscar curso
          </label>
          <input
            className="input"
            id="busca"
            type="search"
            placeholder="Buscar por título ou tema"
            autoComplete="off"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {categories.length > 0 ? (
          <div className="catalog__sort">
            <label className="catalog__sort-label" htmlFor="categoria">
              Assunto
            </label>
            <select
              className="select"
              id="categoria"
              value={categorySlug}
              onChange={(event) => setCategorySlug(event.target.value)}
            >
              <option value="">Todos os assuntos</option>
              {gruposDeCategoria.soltas.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.name}
                </option>
              ))}
              {gruposDeCategoria.grupos.map(([pai, filhas]) => (
                <optgroup key={pai} label={pai}>
                  {filhas.map((item) => (
                    <option key={item.slug} value={item.slug}>
                      {item.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        ) : null}

        <div className="catalog__sort">
          <label className="catalog__sort-label" htmlFor="ordenacao">
            Ordenar por
          </label>
          <select
            className="select"
            id="ordenacao"
            value={sort}
            onChange={(event) => setSort(event.target.value as CatalogSort)}
          >
            {SORTS.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {showTabs ? (
      <div className="tabs" role="tablist" aria-label="Filtrar cursos">
        {TABS.map(({ id, label }, index) => (
          <button
            key={id}
            type="button"
            className="tabs__tab"
            role="tab"
            id={`tab-${id}`}
            aria-controls="resultados"
            aria-selected={filter === id}
            tabIndex={filter === id ? 0 : -1}
            onClick={() => setFilter(id)}
            onKeyDown={(event) => onTabKeyDown(event, index)}
          >
            {label}
            <span className="tabs__count">{counts[id]}</span>
          </button>
        ))}
      </div>
      ) : null}

      {/* As abas filtram uma única região; o rótulo dela acompanha a aba ativa. */}
      <div
        id="resultados"
        {...(showTabs ? { role: "tabpanel" as const, "aria-labelledby": `tab-${filter}` } : {})}
        tabIndex={0}
      >
        <p className="status-text" role="status">
          {visible.length === 1 ? "1 curso encontrado" : `${visible.length} cursos encontrados`}
        </p>

        {visible.length > 0 ? (
          <div className="course-grid">
            {visible.map((entry) => (
              /* A ação fica FORA do card: o card inteiro é um link, e um
                 botão dentro dele aninharia dois interativos — inválido em
                 HTML e confuso no teclado. */
              <div className="catalog-item" key={entry.course.id}>
                <CourseCard course={entry.course} summary={entry.summary} level={2} estado={entry.estado} />
                {showEnroll ? (
                  <EnrollButton courseId={entry.course.id} enrolled={entry.enrolled === true} />
                ) : null}
                {/* `saved` vive na matrícula: sem ela não há onde gravar. */}
                {entry.enrolled === true && podeFavoritar ? (
                  <SaveButton courseId={entry.course.id} saved={entry.saved} />
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty">
            <span className="empty__rule" aria-hidden="true" />
            <div className="empty__inner">
              <span className="empty__icon">
                <Inbox aria-hidden />
              </span>
              <h2 className="empty__title">{emptyTitle}</h2>
              <p className="empty__text">{emptyText}</p>
              <div className="empty__actions">
                <Link className="btn btn--secondary" href="/cursos">
                  Ver catálogo
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

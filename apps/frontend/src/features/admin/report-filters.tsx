"use client";

import { useState } from "react";

import { useUnitLabel } from "@/features/tenant/tenant-context.tsx";
import { Download } from "lucide-react";

/**
 * Recortes do relatório.
 *
 * Monta a URL e deixa o navegador baixar: o relatório continua sendo um link,
 * então funciona ao colar o endereço e não depende de JavaScript para o caso
 * simples. O formulário só evita que alguém tenha que escrever a query à mão.
 *
 * Os projetos vêm do painel, que já os lista — pedir digitação livre erraria
 * no acento e devolveria relatório vazio sem explicar por quê.
 */
/** Os relatórios que a tela oferece. Espelha `ReportKind` do backend. */
type TipoRelatorio = "progresso" | "usuarios" | "notas" | "cursos";

export function ReportFilters({ projects }: { projects: string[] }) {
  const unitLabel = useUnitLabel();
  const [tipo, setTipo] = useState<TipoRelatorio>("progresso");
  const [ativos, setAtivos] = useState("");
  const [projeto, setProjeto] = useState("");
  const [concluidos, setConcluidos] = useState(false);

  const params = new URLSearchParams({ tipo });
  /* O catálogo de cursos não aceita recorte de pessoa: curso não tem projeto
     nem data de último acesso — quem tem é o aluno. Mandar os parâmetros
     mesmo assim sugeriria um filtro que não filtra nada. */
  if (ativos && tipo !== "cursos") params.set("ativos", ativos);
  if (projeto && tipo !== "cursos") params.set("projeto", projeto);
  if (concluidos && tipo === "progresso") params.set("concluidos", "1");

  return (
    <form className="report-filters" action="/api/relatorios" method="get">
      <div className="report-filters__row">
        <label className="report-filters__field">
          <span className="report-filters__label">Relatório</span>
          <select
            className="select"
            name="tipo"
            value={tipo}
            onChange={(event) => setTipo(event.target.value as TipoRelatorio)}
          >
            <option value="progresso">Progresso por curso</option>
            <option value="usuarios">Usuários</option>
            <option value="notas">Notas</option>
            <option value="cursos">Catálogo de cursos</option>
          </select>
        </label>

        <label className="report-filters__field">
          <span className="report-filters__label">Período ativo</span>
          <select
            className="select"
            name="ativos"
            value={ativos}
            onChange={(event) => setAtivos(event.target.value)}
          >
            <option value="">Sem recorte</option>
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
          </select>
        </label>

        <label className="report-filters__field">
          <span className="report-filters__label">{unitLabel}</span>
          <select
            className="select"
            name="projeto"
            value={projeto}
            onChange={(event) => setProjeto(event.target.value)}
          >
            <option value="">Todos</option>
            {projects.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="report-filters__row report-filters__row--end">
        {/* Só faz sentido no relatório de progresso: o de usuários não tem
            linha de curso para filtrar. */}
        {tipo === "progresso" ? (
          <label className="checkbox">
            <input
              type="checkbox"
              name="concluidos"
              value="1"
              checked={concluidos}
              onChange={(event) => setConcluidos(event.target.checked)}
            />
            <span className="checkbox__box" aria-hidden="true" />
            Somente cursos concluídos
          </label>
        ) : null}

        <a className="btn btn--primary" href={`/api/relatorios?${params.toString()}`}>
          <Download aria-hidden /> Baixar CSV
        </a>
      </div>
    </form>
  );
}

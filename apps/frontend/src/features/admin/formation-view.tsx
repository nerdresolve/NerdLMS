"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  GraduationCap,
  Pencil,
  Plus,
  Route,
  Target,
  Trash2,
} from "lucide-react";

import { campoObrigatorio } from "@/lib/campo-obrigatorio.ts";

import "./formation.css";

/**
 * Planos de formação por cargo.
 *
 * A PERGUNTA DA TELA
 *
 * "O que forma um Analista de Desenvolvimento PLENO, e quem já está formado?"
 *
 * O plano lista trilhas, cursos e competências. Quando declara um cargo,
 * alcança sozinho quem tem aquele cargo — o contrário seria alguém lembrar de
 * atribuir a cada contratação, e o esquecimento não aparece: a pessoa
 * simplesmente fica sem plano, e nada acusa.
 *
 * A COLUNA QUE IMPORTA É "FORMADAS", NÃO A MÉDIA
 *
 * A média diz como a equipe está caminhando; "formadas" diz quantas pessoas
 * podem assumir o posto hoje. Uma equipe com média de 90% e ninguém formado é
 * uma equipe sem ninguém pronto, e a média sozinha esconderia isso.
 */

export interface ExigenciaNaTela {
  id: string;
  /** Id da trilha, do curso ou da competência — o que a edição marca. */
  alvoId: string;
  tipo: "trilha" | "curso" | "competencia";
  nome: string;
  nivelExigido?: number;
  cumprida?: boolean;
  /** O plano de onde ela veio, quando é herdada. */
  herdadaDe?: string;
}

export interface PessoaNaTela {
  id: string;
  nome: string;
  percentual: number;
  completa: boolean;
  falta: string[];
}

export interface PlanoNaTela {
  id: string;
  nome: string;
  descricao: string | null;
  jobTitle: string | null;
  /** Do próprio até a raiz: ["SÊNIOR", "PLENO", "JR"]. */
  cadeia: string[];
  /** O plano que este continua, para o formulário de edição preencher. */
  continuaId: string | null;
  exigencias: ExigenciaNaTela[];
  pessoas: PessoaNaTela[];
  formadas: number;
  percentualMedio: number;
}

export interface OpcaoDeItem {
  id: string;
  nome: string;
}

const ICONE = { trilha: Route, curso: GraduationCap, competencia: Target } as const;
const ROTULO = { trilha: "Trilha", curso: "Curso", competencia: "Competência" } as const;

export function FormationView({
  planos,
  trilhas,
  cursos,
  competencias,
  cargos,
}: {
  planos: PlanoNaTela[];
  trilhas: OpcaoDeItem[];
  cursos: OpcaoDeItem[];
  competencias: OpcaoDeItem[];
  cargos: string[];
}) {
  const router = useRouter();

  /* `null` é o formulário fechado, `"novo"` é criação, e um id é a edição
     daquele plano. Um estado só para as três situações porque o formulário é o
     mesmo: dois estados independentes deixariam abrir os dois ao mesmo tempo. */
  const [editando, setEditando] = useState<string | null>(null);
  const aberto = editando !== null;
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [continuaId, setContinuaId] = useState("");
  const [escolhidos, setEscolhidos] = useState<ExigenciaNaTela[]>([]);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function alternar(tipo: ExigenciaNaTela["tipo"], opcao: OpcaoDeItem) {
    setEscolhidos((atuais) => {
      const jaTem = atuais.some((i) => i.tipo === tipo && i.id === opcao.id);
      return jaTem
        ? atuais.filter((i) => !(i.tipo === tipo && i.id === opcao.id))
        : [...atuais, { id: opcao.id, alvoId: opcao.id, tipo, nome: opcao.nome }];
    });
  }

  const marcado = (tipo: ExigenciaNaTela["tipo"], id: string) =>
    escolhidos.some((i) => i.tipo === tipo && i.id === id);

  function fechar() {
    setEditando(null);
    setNome("");
    setDescricao("");
    setJobTitle("");
    setContinuaId("");
    setEscolhidos([]);
    setErro(null);
  }

  function abrirNovo() {
    fechar();
    setEditando("novo");
  }

  /**
   * Abre o formulário com o plano carregado.
   *
   * Só as exigências PRÓPRIAS entram marcadas. As herdadas não se editam aqui —
   * trazê-las marcadas faria a edição gravá-las como próprias, e a herança
   * viraria uma cópia que para de acompanhar o plano de origem.
   */
  function abrirEdicao(plano: PlanoNaTela) {
    setEditando(plano.id);
    setNome(plano.nome);
    setDescricao(plano.descricao ?? "");
    setJobTitle(plano.jobTitle ?? "");
    setContinuaId(plano.continuaId ?? "");
    setErro(null);

    /* A própria é a que NÃO tem origem: `herdadaDe` ausente. Uma lista separada
       das próprias seria uma segunda verdade sobre a mesma coisa. */
    setEscolhidos(
      plano.exigencias
        .filter((e) => e.herdadaDe === undefined)
        .map((e) => ({ ...e, id: e.alvoId })),
    );
  }

  async function excluir(plano: PlanoNaTela) {
    /* A confirmação diz o que o plano ALCANÇA, e não só o nome: "excluir o
       plano X?" não informa se aquilo pesa sobre quatro pessoas ou nenhuma. */
    const alcance =
      plano.pessoas.length === 0
        ? "Ele não alcança ninguém hoje."
        : `Ele alcança ${plano.pessoas.length} ${
            plano.pessoas.length === 1 ? "pessoa" : "pessoas"
          }, que deixam de ter formação exigida.`;

    if (!confirm(`Excluir o plano "${plano.nome}"? ${alcance} Nenhum progresso é apagado.`)) {
      return;
    }

    setBusy(true);
    setErro(null);

    try {
      const resposta = await fetch("/api/formacao", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planoId: plano.id }),
      });

      const corpo = (await resposta.json().catch(() => ({}))) as { error?: string };

      if (!resposta.ok) {
        setErro(corpo.error ?? "Não foi possível excluir o plano.");
        return;
      }

      /* Fecha o formulário se ele estava editando justamente este plano: deixar
         aberto um formulário de algo que não existe mais grava num id morto. */
      if (editando === plano.id) fechar();

      router.refresh();
    } catch {
      setErro("Não foi possível falar com o servidor. Verifique sua conexão.");
    } finally {
      setBusy(false);
    }
  }

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault();
    setBusy(true);
    setErro(null);

    const edicao = editando !== null && editando !== "novo";

    try {
      const resposta = await fetch("/api/formacao", {
        method: edicao ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(edicao ? { planoId: editando } : {}),
          nome,
          descricao,
          jobTitle,
          continuaId,
          itens: escolhidos.map((i) => ({ tipo: i.tipo, alvoId: i.id })),
        }),
      });

      const corpo = (await resposta.json().catch(() => ({}))) as { error?: string };

      if (!resposta.ok) {
        setErro(corpo.error ?? "Não foi possível salvar o plano.");
        return;
      }

      fechar();
      router.refresh();
    } catch {
      setErro("Não foi possível falar com o servidor. Verifique sua conexão.");
    } finally {
      setBusy(false);
    }
  }

  const grupos = [
    { tipo: "trilha" as const, titulo: "Trilhas", opcoes: trilhas },
    { tipo: "curso" as const, titulo: "Cursos", opcoes: cursos },
    { tipo: "competencia" as const, titulo: "Competências", opcoes: competencias },
  ];

  return (
    <>
      <div className="page-head">
        <h1 className="page-head__title">Formação por cargo</h1>
        <p className="page-head__sub">
          O que forma alguém por completo num cargo: um conjunto de trilhas, cursos e
          competências. Quem tem o cargo recebe o plano sozinho.
        </p>
      </div>

      {erro ? (
        <p className="error" role="alert">
          <AlertCircle aria-hidden="true" />
          <span>{erro}</span>
        </p>
      ) : null}

      {planos.length === 0 ? (
        <p className="platform__hint">
          Nenhum plano ainda. Sem plano, ninguém tem formação exigida e a tela do gestor não
          consegue dizer quem está pronto para o posto.
        </p>
      ) : null}

      {planos.map((plano) => (
        <section
          className="course-section formacao-plano"
          aria-labelledby={`plano-${plano.id}`}
          key={plano.id}
        >
          <h2 className="course-section__title" id={`plano-${plano.id}`}>
            {plano.nome}
            {plano.jobTitle ? <span className="badge">{plano.jobTitle}</span> : null}
          </h2>

          {plano.descricao ? <p className="platform__hint">{plano.descricao}</p> : null}

          <div className="retake-fila__acoes">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => abrirEdicao(plano)}
              disabled={busy}
            >
              <Pencil aria-hidden /> Editar plano
            </button>
            <button
              type="button"
              className="btn btn--ghost formacao__excluir"
              onClick={() => void excluir(plano)}
              disabled={busy}
            >
              <Trash2 aria-hidden /> Excluir
            </button>
          </div>

          {/* A CADEIA APARECE, e não só o resultado dela.

              Um plano que continua outro mostra exigências que ninguém escreveu
              ali. Sem dizer de onde vêm, quem abre a tela conclui que o sistema
              inventou — e a primeira reação é tentar removê-las aqui. */}
          {plano.cadeia.length > 1 ? (
            <p className="platform__hint">
              Continua: {plano.cadeia.slice(1).join(" → ")}
            </p>
          ) : null}

          <p className="platform__hint">
            {/* "Formadas" primeiro: é o número que responde quantas pessoas
                podem assumir o posto hoje. */}
            <strong>
              {plano.formadas} de {plano.pessoas.length}
            </strong>{" "}
            {plano.pessoas.length === 1 ? "pessoa formada" : "pessoas formadas"} · média de{" "}
            {plano.percentualMedio}%
            {plano.jobTitle === null ? " · alcança só quem for atribuído à mão" : ""}
          </p>

          <div className="formacao__exigencias">
            {plano.exigencias.map((item) => {
              const Icone = ICONE[item.tipo];
              return (
                <span className="chip" data-herdada={item.herdadaDe ? "" : undefined} key={item.id}>
                  <Icone aria-hidden />
                  {item.nome}
                  <span className="chip__conta">
                    {item.herdadaDe ? `de ${item.herdadaDe}` : ROTULO[item.tipo]}
                  </span>
                </span>
              );
            })}
          </div>

          {plano.pessoas.length === 0 ? (
            <p className="platform__hint">
              Ninguém com este cargo. Confira a grafia em Usuários, ou atribua o plano à mão.
            </p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Pessoa</th>
                    <th scope="col">Formação</th>
                    <th scope="col">O que falta</th>
                  </tr>
                </thead>
                <tbody>
                  {plano.pessoas.map((pessoa) => (
                    <tr key={pessoa.id}>
                      <td data-label="Pessoa">{pessoa.nome}</td>
                      <td data-label="Formação">
                        <span className="formacao__barra" aria-hidden="true">
                          <span
                            className="formacao__preenchida"
                            data-completa={pessoa.completa || undefined}
                            style={{ width: `${pessoa.percentual}%` }}
                          />
                        </span>{" "}
                        {pessoa.percentual}%
                      </td>
                      <td data-label="O que falta">
                        {/* `completa` do domínio, e NÃO "a lista de pendências
                            está vazia". As duas divergem no plano sem
                            exigência: nada falta porque nada é exigido, e a
                            tela dizia "Formada" ao lado de 0%. */}
                        {pessoa.completa ? (
                          <span className="formacao__pronta">Formada</span>
                        ) : pessoa.falta.length === 0 ? (
                          <span className="platform__hint">Plano sem exigências</span>
                        ) : (
                          /* O que falta, escrito: uma barra em 60% não diz o
                             que fazer, e é isso que o gestor precisa saber. */
                          pessoa.falta.join(" · ")
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}

      <section className="course-section" aria-labelledby="novo-plano">
        <h2 className="course-section__title" id="novo-plano">
          {editando !== null && editando !== "novo" ? "Editando o plano" : "Novo plano"}
        </h2>

        {aberto ? (
          <form className="platform__form" onSubmit={salvar} method="post">
            <div className="field">
              <label className="field__label" htmlFor="plano-nome">
                Nome
              </label>
              <input
                className="input"
                id="plano-nome"
                value={nome}
                onChange={(evento) => setNome(evento.target.value)}
                maxLength={120}
                placeholder="Ex.: Formação do Analista de Desenvolvimento PLENO"
                {...campoObrigatorio("Dê um nome ao plano.")}
              />
            </div>

            <div className="field">
              <label className="field__label" htmlFor="plano-cargo">
                Cargo alcançado (em branco: só por atribuição manual)
              </label>
              <input
                className="input"
                id="plano-cargo"
                list="cargos-existentes"
                value={jobTitle}
                onChange={(evento) => setJobTitle(evento.target.value)}
                maxLength={120}
                placeholder="Ex.: Analista de Desenvolvimento PLENO"
              />
              {/* Os cargos que EXISTEM no cadastro, para o nome bater.
                  Digitado à mão, "Analista PLENO" e "Analista Pleno" seriam dois
                  cargos, e o plano alcançaria metade das pessoas. */}
              <datalist id="cargos-existentes">
                {cargos.map((cargo) => (
                  <option key={cargo} value={cargo} />
                ))}
              </datalist>
              <p className="platform__hint">
                {cargos.length === 0
                  ? "Nenhum cargo cadastrado ainda. O cargo vem do diretório, no campo de função da pessoa."
                  : `${cargos.length} cargo(s) no cadastro. Escolha um da lista para o nome bater.`}
              </p>
            </div>

            <div className="field">
              <label className="field__label" htmlFor="plano-continua">
                Continua o plano de (opcional)
              </label>
              <select
                className="select"
                id="plano-continua"
                value={continuaId}
                onChange={(evento) => setContinuaId(evento.target.value)}
              >
                <option value="">Não continua nenhum</option>
                {/* O próprio plano fora da lista: continuar a si mesmo é o ciclo
                    mais fácil de criar por engano, e o servidor o recusa — não
                    oferecê-lo evita a viagem. */}
                {planos.filter((plano) => plano.id !== editando).map((plano) => (
                  <option key={plano.id} value={plano.id}>
                    {plano.nome}
                  </option>
                ))}
              </select>
              <p className="platform__hint">
                {/* O motivo escrito, porque a alternativa é copiar o comum em
                    cada senioridade e esquecer de mudar em duas delas. */}
                Tudo que o plano escolhido exige passa a valer aqui também. Assim o comum a JR,
                PLENO e SÊNIOR se escreve uma vez só.
              </p>
            </div>

            <div className="field">
              <label className="field__label" htmlFor="plano-descricao">
                Descrição
              </label>
              <input
                className="input"
                id="plano-descricao"
                value={descricao}
                onChange={(evento) => setDescricao(evento.target.value)}
                maxLength={200}
                placeholder="Uma linha sobre o que este cargo precisa dominar."
              />
            </div>

            {grupos.map((grupo) => (
              <div className="field" key={grupo.tipo}>
                <span className="field__label">{grupo.titulo}</span>
                {grupo.opcoes.length === 0 ? (
                  <p className="platform__hint">Nada cadastrado ainda.</p>
                ) : (
                  <div className="prefs__col">
                    {grupo.opcoes.map((opcao) => (
                      <label className="checkbox" key={opcao.id}>
                        <input
                          type="checkbox"
                          checked={marcado(grupo.tipo, opcao.id)}
                          onChange={() => alternar(grupo.tipo, opcao)}
                        />
                        <span aria-hidden="true" className="checkbox__box" />
                        <span>{opcao.nome}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <div className="retake-fila__acoes">
              <button
                type="submit"
                className="btn btn--primary"
                disabled={busy || escolhidos.length === 0}
              >
                {busy
                  ? "Salvando"
                  : editando !== null && editando !== "novo"
                    ? "Salvar plano"
                    : "Criar plano"}
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={fechar}
                disabled={busy}
              >
                Cancelar
              </button>
              {/* O botão desabilitado diz o que falta em vez de ficar inerte. */}
              <span className="status-text" role="status">
                {escolhidos.length === 0
                  ? "Escolha ao menos uma trilha, curso ou competência."
                  : `${escolhidos.length} exigência(s) escolhida(s).`}
              </span>
            </div>
          </form>
        ) : (
          <div className="retake-fila__acoes">
            <button type="button" className="btn btn--primary" onClick={abrirNovo}>
              <Plus aria-hidden /> Novo plano
            </button>
          </div>
        )}
      </section>
    </>
  );
}

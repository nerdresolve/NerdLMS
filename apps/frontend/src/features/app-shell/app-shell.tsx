"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Award,
  BarChart3,
  BookMarked,
  CalendarDays,
  Check,
  ClipboardCheck,
  GraduationCap,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PanelLeft,
  PenSquare,
  Plug,
  Route,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Sun,
  Target,
  TrendingUp,
  Trophy,
  User,
  UsersRound,
  X,
} from "lucide-react";

import type { Role } from "@nerdlms/core/auth/permissions.ts";

import { applyTheme, readTheme } from "@/lib/theme.ts";

import { BRANDING_PADRAO, NOME_PADRAO } from "@nerdlms/core/tenancy/branding.ts";

import { useFeatures } from "@/features/tenant/feature-context.tsx";
import { useTenant } from "@/features/tenant/tenant-context.tsx";
import { GlobalSearch } from "./global-search.tsx";
import { NotificationBell } from "./notification-bell.tsx";

import "./app-shell.css";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ "aria-hidden"?: boolean }>;
  badge?: number;
  /**
   * Funcionalidade que sustenta este item.
   *
   * Desligada, o item some do menu. O 404 da rota é quem de fato fecha a
   * porta (a URL continua digitável) — isto evita oferecer o caminho.
   */
  feature?: string;
}

interface NavGroup {
  section?: string;
  items: NavItem[];
}

/** Navegação do aluno — a base que todo papel enxerga. */
const LEARNER_GROUPS: NavGroup[] = [
  {
    items: [
      { label: "Dashboard", href: "/dashboard", icon: Home },
      { label: "Meus cursos", href: "/meus-cursos", icon: GraduationCap },
      { label: "Concluídos", href: "/concluidos", icon: Check },
    ],
  },
  {
    section: "Aprender",
    items: [
      { label: "Trilhas", href: "/trilhas", icon: Route, feature: "trilhas" },
      { label: "Conquistas", href: "/conquistas", icon: Trophy, feature: "gamificacao" },
      { label: "Agenda", href: "/agenda", icon: CalendarDays, feature: "agenda" },
    ],
  },
  {
    section: "Biblioteca",
    items: [
      { label: "Todos os cursos", href: "/cursos", icon: BookMarked },
      { label: "Favoritos", href: "/favoritos", icon: Star, feature: "favoritos" },
      /* "Configurações" (/configuracoes) continua fora: a tela ainda não
         existe, e link para 404 é pior que item ausente. */
    ],
  },
];

const ACCOUNT_GROUP: NavGroup = {
  section: "Conta",
  items: [
    { label: "Perfil", href: "/perfil", icon: User },
    { label: "Sair", href: "/sair", icon: LogOut },
  ],
};

const INSTRUCTOR_GROUP: NavGroup = {
  section: "Instrutor",
  items: [
    { label: "Meus cursos", href: "/instrutor/cursos", icon: PenSquare },
    { label: "Correção", href: "/instrutor/correcao", icon: ClipboardCheck },
    { label: "Engajamento", href: "/instrutor/engajamento", icon: BarChart3 },
  ],
};

const MANAGER_GROUP: NavGroup = {
  section: "Gestão",
  items: [
    { label: "Painel do projeto", href: "/gestor", icon: LayoutDashboard },
    { label: "Minha equipe", href: "/gestor/equipe", icon: UsersRound },
  ],
};

const ADMIN_GROUP: NavGroup = {
  section: "Administração",
  items: [
    { label: "Painel", href: "/admin", icon: LayoutDashboard },
    { label: "Usuários", href: "/admin/usuarios", icon: UsersRound },
    { label: "Auditoria", href: "/admin/auditoria", icon: ScrollText },
    { label: "Plataforma", href: "/admin/plataforma", icon: SlidersHorizontal },
    { label: "Badges", href: "/admin/badges", icon: Award },
    { label: "Competências", href: "/admin/competencias", icon: Target },
    { label: "Analytics", href: "/admin/analytics", icon: TrendingUp },
    { label: "Integrações", href: "/admin/integracoes", icon: Plug },
    { label: "Acesso", href: "/admin/acesso", icon: ShieldCheck },
  ],
};

/**
 * Navegação por papel.
 *
 * Instrutor e administrador **também são alunos** — fazem cursos como todo
 * mundo —, então a área deles se soma à navegação base em vez de substituí-la.
 *
 * Esconder um item não é autorização: cada rota checa permissão no servidor.
 * A navegação só evita oferecer o que a pessoa não pode abrir.
 */
export function navGroupsFor(role: Role): NavGroup[] {
  const groups = [...LEARNER_GROUPS];
  if (role === "instructor" || role === "admin") groups.push(INSTRUCTOR_GROUP);
  if (role === "manager") groups.push(MANAGER_GROUP);
  if (role === "admin") groups.push(ADMIN_GROUP);
  groups.push(ACCOUNT_GROUP);
  return groups;
}

/** Navegação do aluno. Mantida como export para o gerador do protótipo. */
export const NAV_GROUPS: NavGroup[] = navGroupsFor("learner");

function initialsOf(fullName: string): string {
  return fullName
    .split(" ")
    .map((part) => part[0] ?? "")
    .slice(0, 2)
    .join("");
}

function Nav({ groups, currentPath, currentKind, onNavigate }: { groups: NavGroup[]; currentPath: string; currentKind: "page" | "location"; onNavigate?: () => void }) {
  return (
    <nav className="sidebar__nav" aria-label="Navegação principal">
      {groups.map((group, groupIndex) => (
        <div key={group.section ?? `group-${groupIndex}`}>
          {group.section ? <p className="sidebar__section">{group.section}</p> : null}
          {group.items.map(({ label, href, icon: Icon, badge }) =>
            /* Sair é POST, não link: como GET, o prefetch do <Link> abria a
               rota sozinho ao montar a navegação e deslogava quem tinha
               acabado de entrar. Um formulário só é enviado por clique. */
            href === "/sair" ? (
              <form key={href} action={href} method="post" className="nav-item__form">
                <button
                  type="submit"
                  className="nav-item nav-item--button"
                  {...(onNavigate ? { onClick: onNavigate } : {})}
                >
                  <Icon aria-hidden />
                  <span className="nav-item__label">{label}</span>
                </button>
              </form>
            ) : (
              <Link
                key={href}
                className="nav-item"
                href={href}
                {...(onNavigate ? { onClick: onNavigate } : {})}
                {...(href === currentPath ? { "aria-current": currentKind } : {})}
              >
                <Icon aria-hidden />
                <span className="nav-item__label">{label}</span>
                {badge ? <span className="nav-item__badge">{badge}</span> : null}
              </Link>
            ),
          )}
        </div>
      ))}
    </nav>
  );
}

function UserFoot({ fullName }: { fullName: string }) {
  return (
    <div className="sidebar__foot">
      <span className="avatar" aria-hidden="true">
        {initialsOf(fullName)}
      </span>
      <span className="sidebar__user-text">
        <span className="sidebar__user-name">{fullName}</span>
        <br />
        <Link className="sidebar__user-link" href="/perfil">
          Ver perfil
        </Link>
      </span>
    </div>
  );
}

/**
 * Navegação inferior no mobile.
 *
 * Cinco destinos no alcance do polegar, tirados dos mesmos grupos da sidebar
 * para não existirem duas listas que podem divergir. O drawer continua ali
 * para o resto: aqui entra só o que se usa todo dia.
 *
 * Some no desktop, onde a sidebar já cumpre esse papel.
 */
function MobileNav({ groups, currentPath }: { groups: NavGroup[]; currentPath: string }) {
  /* Os quatro primeiros itens que a pessoa tem direito a ver, mais o perfil.
     Papel diferente traz destinos diferentes, e a barra acompanha sozinha. */
  const itens = groups
    .flatMap((group) => group.items)
    .filter((item) => item.href !== "/sair")
    .slice(0, 5);

  return (
    <nav className="mobile-nav" aria-label="Navegação rápida">
      {itens.map(({ label, href, icon: Icon }) => (
        <Link
          key={href}
          className="mobile-nav__item"
          href={href}
          {...(href === currentPath ? { "aria-current": "page" } : {})}
        >
          <Icon aria-hidden />
          <span className="mobile-nav__label">{label}</span>
        </Link>
      ))}
    </nav>
  );
}

interface AppShellProps {
  fullName: string;
  /** Rota destacada na navegação. */
  currentPath: string;
  /** Conteúdo do slot de contexto da topbar — normalmente o breadcrumb. */
  topbar?: React.ReactNode;
  /**
   * "page" quando a rota destacada É a página aberta; "location" quando ela é
   * apenas a seção que a contém (ex.: uma página de curso dentro de "Meus
   * cursos"). Dois aria-current="page" no mesmo documento fazem o leitor de
   * tela anunciar duas páginas atuais.
   */
  currentKind?: "page" | "location";
  /** Define quais áreas aparecem na navegação. O padrão é a visão do aluno. */
  role?: Role;
  children: React.ReactNode;
}

export function AppShell({ fullName, currentPath, currentKind = "page", role = "learner", topbar, children }: AppShellProps) {
  const features = useFeatures();
  const tenant = useTenant();

  /* Logo do cliente, com o padrão do produto como reserva. São duas porque a
     barra lateral é escura e a do topo é clara: uma logo só perderia contraste
     em um dos dois fundos. */
  const logoLight = tenant?.branding.logoLightUrl ?? BRANDING_PADRAO.logoLight;
  const logoDark = tenant?.branding.logoDarkUrl ?? BRANDING_PADRAO.logoDark;
  const tenantName = tenant?.name ?? NOME_PADRAO;

  /* Um grupo que perdeu todos os itens some junto: uma seção "Aprender" vazia
     é pior que a ausência dela. */
  const groups = navGroupsFor(role)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.feature || features[item.feature] === true),
    }))
    .filter((group) => group.items.length > 0);
  /* Começa em `false` de propósito: no servidor não há como saber a escolha,
     e um palpite diferente do HTML entregue quebraria a hidratação. O efeito
     abaixo corrige o ícone assim que a página vive no navegador — o TEMA em
     si já está certo antes disso, aplicado pelo script inline do layout. */
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(readTheme() === "dark");
  }, []);

  /* O tema vive no atributo do <html>, como os tokens esperam, e a escolha
     fica em `localStorage` — sem isso o refresh voltava ao claro mesmo depois
     de a pessoa ter escolhido o escuro. */
  function toggleTheme() {
    const next = !dark;
    setDark(next);
    applyTheme(next ? "dark" : "light");
  }

  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const drawerRef = useRef<HTMLDivElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    openButtonRef.current?.focus();
  }, []);

  // Esc fecha e Tab não escapa do drawer enquanto ele está aberto.
  useEffect(() => {
    if (!drawerOpen) return;

    closeButtonRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeDrawer();
        return;
      }
      if (event.key !== "Tab" || !drawerRef.current) return;

      const focusable = drawerRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen, closeDrawer]);

  return (
    <>
      <a className="skip-link" href="#conteudo">
        Ir para o conteúdo
      </a>

      {/*.app é o container das consultas @container;.shell é consultado */}
      <div className="app">
        <div className="shell" data-sidebar={collapsed ? "collapsed" : "expanded"}>
        <aside className="sidebar">
          <div className="sidebar__head">
            {/* Variante BRANCA: a sidebar é violeta escuro nos dois temas
                (`--sidebar-bg` é #03115E no claro e a superfície escura no
                dark), e a marca violeta sumia contra ela.

                `sizes` evita baixar a variante de 640px para uma marca de
                132px: sem ele o Next serve a maior do srcset.

                width/height são os do ARQUIVO (wordmark 600×165, mark
                228×117). Estavam ambos como 600×170 — proporção errada nos
                dois, e no `mark` grosseiramente: 3.53 contra 1.95 reais. */}
            <Image className="sidebar__logo" src={logoDark} alt={tenantName} width={600} height={165} sizes="132px" priority />
            <Image className="sidebar__mark" src={logoDark} alt={tenantName} width={228} height={117} sizes="34px" />
            <button
              type="button"
              className="sidebar__toggle"
              aria-expanded={!collapsed}
              aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
              onClick={() => setCollapsed((value) => !value)}
            >
              <PanelLeft aria-hidden />
            </button>
          </div>

          <Nav groups={groups} currentPath={currentPath} currentKind={currentKind} />
          <UserFoot fullName={fullName} />
        </aside>

        <div>
          <header className="topbar">
            <button
              ref={openButtonRef}
              type="button"
              className="icon-button topbar__menu"
              aria-label="Abrir menu"
              aria-expanded={drawerOpen}
              aria-controls="app-drawer"
              onClick={() => setDrawerOpen(true)}
            >
              <Menu aria-hidden />
            </button>

            {/* Duas variantes, uma visível por tema (o CSS decide).
                A topbar acompanha `--surface-card`: branca no claro, quase
                preta no escuro — e a marca violeta cai para 3.37:1 ali. Trocar
                por CSS evita depender de estado do React, que no primeiro
                render ainda não sabe o tema. A escondida não é baixada: o
                `display:none` impede a requisição. */}
            <Image className="topbar__logo topbar__logo--light" src={logoLight} alt={tenantName} width={600} height={165} sizes="92px" />
            <Image className="topbar__logo topbar__logo--dark" src={logoDark} alt="" aria-hidden width={600} height={165} sizes="92px" />
            {topbar ? <div className="topbar__context">{topbar}</div> : null}
            <span className="topbar__spacer" />

            {features.busca === true ? <GlobalSearch /> : null}
            <button
              type="button"
              className="icon-button"
              aria-label={dark ? "Usar tema claro" : "Usar tema escuro"}
              aria-pressed={dark}
              onClick={toggleTheme}
            >
              {dark ? <Sun aria-hidden /> : <Moon aria-hidden />}
            </button>
            <NotificationBell />
            {/* O nome acessível precisa CONTER o texto visível (WCAG 2.5.3):
                com `aria-label="Sua conta"` sobre as iniciais, quem navega por
                voz dizia "MS" e o comando não encontrava o botão. */}
            <Link className="icon-button icon-button--avatar" href="/perfil" aria-label={`${initialsOf(fullName)} — sua conta`}>
              {initialsOf(fullName)}
            </Link>
          </header>

            <main className="content" id="conteudo">
              {children}
            </main>
          </div>
        </div>
      </div>

      <MobileNav groups={groups} currentPath={currentPath} />

      <div className="drawer-backdrop" data-open={drawerOpen} onClick={closeDrawer} />
      <div
        ref={drawerRef}
        className="drawer"
        id="app-drawer"
        data-open={drawerOpen}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        hidden={!drawerOpen}
      >
        <div className="sidebar__head">
          {/* Branca pelo mesmo motivo da sidebar: o drawer usa o mesmo fundo. */}
          <Image className="sidebar__logo" src={logoDark} alt={tenantName} width={600} height={165} sizes="132px" />
          <button ref={closeButtonRef} type="button" className="sidebar__toggle" aria-label="Fechar menu" onClick={closeDrawer}>
            <X aria-hidden />
          </button>
        </div>
        <Nav groups={groups} currentPath={currentPath} currentKind={currentKind} onNavigate={closeDrawer} />
        <UserFoot fullName={fullName} />
      </div>
    </>
  );
}

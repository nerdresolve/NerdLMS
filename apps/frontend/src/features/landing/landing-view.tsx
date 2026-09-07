import Image from "next/image";
import Link from "next/link";
import { BookOpen, Clock, GraduationCap, Mail, TrendingUp, Users } from "lucide-react";

import { FluidWave } from "@/components/brand/fluid-wave.tsx";
import { LANDING_POINTS, type LandingStat } from "@nerdlms/core/landing.ts";

import "./landing.css";

/**
 * Tela de acesso inicial. Única superfície pública e único lugar onde a voz da
 * marca se levanta — dentro do app o tom volta a ser direto.
 *
 * Sem fotografia fornecida, o agrupamento à direita usa a forma de marca e
 * espaços reservados explícitos, em vez de imagem de banco.
 */
const POINT_ICONS = {
  "book-open": BookOpen,
  clock: Clock,
  "trending-up": TrendingUp,
} as const;

export function LandingView({
  stats,
  nome,
  logoLight,
  logoDark,
}: {
  stats: LandingStat[];
  /* A marca do cliente. Vem de cima porque quem resolve o tenant é a rota:
     esta tela é a primeira coisa que alguém de fora vê, e trazia o logo de um
     cliente fixo no JSX. */
  nome: string;
  logoLight: string;
  logoDark: string;
}) {
  return (
    <div className="landing">
      <header className="landing__header">
        {/* Duas variantes, uma por tema: no escuro a marca violeta quase some
            contra o fundo. O CSS decide, então vale já no primeiro render —
            estado do React ainda não sabe o tema nessa hora. */}
        <Image className="landing__logo landing__logo--light" src={logoLight} alt={nome} width={600} height={165} priority />
        <Image className="landing__logo landing__logo--dark" src={logoDark} alt="" aria-hidden width={600} height={165} />
        <span className="landing__header-spacer" />
        <nav className="landing__header-actions" aria-label="Acesso">
          <Link className="btn btn--secondary" href="#sobre">
            Sobre a plataforma
          </Link>
          <Link className="btn btn--primary" href="/login">
            Entrar
          </Link>
        </nav>
      </header>

      <main className="landing__hero" id="conteudo">
        <div className="landing__copy">
          <h1 className="landing__title">
            Treinamento da <em>operação</em>, no seu ritmo
          </h1>
          <p className="landing__lead">
            Os cursos da sua empresa em um lugar só. A aula retoma de onde você parou, no computador
            ou no celular.
          </p>
          <div className="landing__actions">
            <Link className="btn btn--primary" href="/login">
              Começar agora
            </Link>
            <Link className="btn btn--secondary" href="#sobre">
              Saiba mais
            </Link>
          </div>
        </div>

        <div className="landing__art" aria-hidden="true">
          <span className="landing__halo" />
          <span className="landing__blob">
            <FluidWave variant="layered" />
          </span>

          <span className="landing__badge landing__badge--a">
            <GraduationCap aria-hidden />
          </span>
          <span className="landing__badge landing__badge--b">
            <Mail aria-hidden />
          </span>
          <span className="landing__badge landing__badge--c">
            <TrendingUp aria-hidden />
          </span>

          {["a", "b"].map((position) => (
            <span key={position} className={`landing__tile landing__tile--${position}`}>
              <FluidWave variant="organic" />
              <Users aria-hidden className="icon" />
            </span>
          ))}
        </div>
      </main>

      {stats.length > 0 ? (
      <div className="landing__stats-wrap">
        <FluidWave variant="band" className="landing__stats-wave" />
        <div className="landing__stats-bleed">
          <dl className="landing__stats">
            {stats.map((stat) => (
              <div className="landing__stat" key={stat.label}>
                <dt className="landing__stat-label">{stat.label}</dt>
                <dd className="landing__stat-value">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      ) : null}

      <section className="landing__about" id="sobre" aria-labelledby="sobre-titulo">
        <h2 className="landing__about-title" id="sobre-titulo">
          O que a plataforma faz
        </h2>
        <div className="landing__points">
          {LANDING_POINTS.map((point) => {
            const Icon = POINT_ICONS[point.icon];
            return (
              <article className="landing__point" key={point.title}>
                <span className="landing__point-icon">
                  <Icon aria-hidden />
                </span>
                <h3 className="landing__point-title">{point.title}</h3>
                <p className="landing__point-text">{point.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <footer className="landing__footer">
        <div className="landing__footer-inner">
          <Image className="landing__footer-logo landing__logo--light" src={logoLight} alt={nome} width={600} height={165} />
          <Image className="landing__footer-logo landing__logo--dark" src={logoDark} alt="" aria-hidden width={600} height={165} />
          <span>Plataforma de ensino corporativo.</span>
          <span className="landing__header-spacer" />
          <span>O acesso é liberado pelo seu gestor.</span>
        </div>
      </footer>
    </div>
  );
}

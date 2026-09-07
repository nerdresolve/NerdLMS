import Image from "next/image";
import Link from "next/link";
import { BookOpen, Clock, GraduationCap, Mail, TrendingUp, Users } from "lucide-react";

import { BrandMosaic } from "@/components/brand/brand-mosaic.tsx";
import { LANDING_POINTS, type LandingStat } from "@nerdlms/core/landing.ts";
import { NOME_PADRAO } from "@nerdlms/core/tenancy/branding.ts";

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

export function LandingView({ stats }: { stats: LandingStat[] }) {
  return (
    <div className="landing">
      <header className="landing__header">
        {/* Duas variantes, uma por tema: no escuro a marca azul quase some
            contra o fundo. O CSS decide, então vale já no primeiro render —
            estado do React ainda não sabe o tema nessa hora. */}
        <Image className="landing__logo landing__logo--light" src="/brand/nerdresolve-wordmark.png" alt={NOME_PADRAO} width={600} height={165} priority />
        <Image className="landing__logo landing__logo--dark" src="/brand/nerdresolve-wordmark-white.png" alt="" aria-hidden width={600} height={165} />
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
            Os cursos da Exemplo S.A. em um lugar só. A aula retoma de onde você parou, no
            computador ou no celular.
          </p>
          <div className="landing__actions">
            <Link className="btn btn--primary" href="/login">
              Começar agora
            </Link>
            <Link className="btn btn--secondary" href="#sobre">
              Saiba mais
            </Link>
          </div>

          {/* Os números vivem DENTRO do hero, sob os botões.

              Eram uma seção própria, de largura inteira, entre o hero e o
              "Sobre": três dados pequenos ocupando 10% de uma faixa e 90% de
              vazio, com filete em cima e embaixo para delimitar quase nada.
              Aqui eles têm função — sustentam a promessa do título — e de
              quebra preenchem a coluna, que terminava nos botões e deixava um
              buraco até a dobra. */}
          {stats.length > 0 ? (
            <dl className="landing__stats">
              {stats.map((stat) => (
                <div className="landing__stat" key={stat.label}>
                  <dt className="landing__stat-label">{stat.label}</dt>
                  <dd className="landing__stat-value">{stat.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>

        <div className="landing__art" aria-hidden="true">
          <span className="landing__halo" />
          <span className="landing__blob">
            <BrandMosaic variant="layered" tone="silhueta" />
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
              <Users aria-hidden className="icon" />
            </span>
          ))}
        </div>
      </main>

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
          <Image className="landing__footer-logo landing__logo--light" src="/brand/nerdresolve-wordmark.png" alt={NOME_PADRAO} width={600} height={165} />
          <Image className="landing__footer-logo landing__logo--dark" src="/brand/nerdresolve-wordmark-white.png" alt="" aria-hidden width={600} height={165} />
          <span>Plataforma de ensino corporativo.</span>
          <span className="landing__header-spacer" />
          <span>O acesso é liberado pelo seu gestor.</span>
        </div>
      </footer>
    </div>
  );
}

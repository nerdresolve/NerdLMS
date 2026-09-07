import type { Metadata } from "next";
import Image from "next/image";

import { BRANDING_PADRAO, NOME_PADRAO } from "@nerdlms/core/tenancy/branding.ts";

import { FluidWave } from "@/components/brand/fluid-wave.tsx";
import { LoginForm } from "@/features/auth/login-form.tsx";
import { SsoButtons } from "@/features/auth/sso-buttons.tsx";
import { ssoOptionsForLogin } from "@/features/auth/sso-options.ts";
import { tenantOfRequest } from "@/lib/tenant-request.ts";
import "@/features/auth/login.css";

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await tenantOfRequest();
  const nome = tenant?.name ?? NOME_PADRAO;

  return {
    title: "Entrar",
    description: `Acesse a plataforma de ensino da ${nome}.`,
    robots: { index: false, follow: false },
  };
}

/* Os provedores vêm do banco a cada visita: ligar o SSO na administração tem
   de refletir na tela de login sem esperar por revalidação de cache. */
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const sso = await ssoOptionsForLogin();
  const tenant = await tenantOfRequest();

  /* A marca do cliente, com a do produto como reserva. Sem isto, a primeira
     tela que alguém vê traz o logo de outro cliente. */
  const nome = tenant?.name ?? NOME_PADRAO;
  const logo = tenant?.branding.logoDarkUrl ?? BRANDING_PADRAO.logoDark;

  return (
    <main className="page">
      <div className="viewport">
        <div className="auth">
          <section className="brand">
            <FluidWave variant="vertical" className="brand__waves" />

            {/* Versão branca: este logo fica sobre o gradiente violeta da marca. A
                colorida some no fundo — é escura sobre escuro. */}
            <Image
              className="brand__logo"
              src={logo}
              alt={nome}
              width={600}
              height={165}
              priority
            />

            <p className="brand__tagline">
              <strong>Aprender transforma.</strong>
              Conhecimento move.
            </p>

            <svg className="brand__squiggle" viewBox="0 0 72 12" fill="none" aria-hidden="true" focusable="false">
              <path
                d="M1 7C7 1 13 1 19 7s12 6 18 0 12-6 18 0 12 6 16 2"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
              />
            </svg>

            <FluidWave variant="edge" className="brand__edge" />
          </section>

          {/* Fora do `.brand` de propósito: a onda cruza a divisa entre as duas
              colunas, e o `overflow: hidden` do painel violeta a recortaria
              exatamente na emenda — que é onde ela precisa aparecer. */}
          <FluidWave variant="split" className="brand__split" />

          <section className="form-panel">
            <div className="form-panel__inner">
              <h1 className="title">Bem-vindo de volta!</h1>
              <p className="subtitle">Acesse sua conta para continuar.</p>

              <LoginForm />

              {/* O separador e os botões vêm juntos do componente: sem
                  provedor configurado, um "ou continue com" sobre nada seria
                  uma promessa vazia. */}
              <SsoButtons options={sso} error={erro ?? null} />

              <p className="foot">
                Não tem uma conta? <a className="link" href="/suporte">Fale com seu administrador.</a>
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

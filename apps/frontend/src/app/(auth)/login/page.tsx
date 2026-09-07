import { NOME_PADRAO } from "@nerdlms/core/tenancy/branding.ts";
import type { Metadata } from "next";
import Image from "next/image";

import { BrandMosaic } from "@/components/brand/brand-mosaic.tsx";
import { LoginForm } from "@/features/auth/login-form.tsx";
import { loginMode } from "@/features/auth/login-mode.ts";
import { SsoButtons } from "@/features/auth/sso-buttons.tsx";
import { ssoOptionsForLogin } from "@/features/auth/sso-options.ts";
import "@/features/auth/login.css";

export const metadata: Metadata = {
  title: "Entrar · a organização",
  description: "Acesse a plataforma de ensino da organização.",
  robots: { index: false, follow: false },
};

/* Os provedores vêm do banco a cada visita: ligar o SSO na administração tem
   de refletir na tela de login sem esperar por revalidação de cache. */
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const [sso, modo] = await Promise.all([ssoOptionsForLogin(), loginMode()]);

  return (
    <main className="page">
      <div className="viewport">
        <div className="auth">
          <section className="brand">
            <BrandMosaic variant="vertical" className="brand__waves" tone="silhueta" />

            {/* Versão branca: este logo fica sobre o gradiente azul da marca. A
                colorida some no fundo — é escura sobre escuro. */}
            <Image
              className="brand__logo"
              src="/brand/nerdresolve-wordmark-white.png"
              alt={NOME_PADRAO}
              width={400}
              height={170}
              priority
            />

            <p className="brand__tagline">
              <strong>Aprender transforma.</strong>
              Conhecimento move.
            </p>

            {/* Régua da marca: os três acentos em blocos retos, no lugar do
                rabisco à mão-livre que havia aqui. Traço à mão-livre não é
                vocabulário da organização — o material dela é todo módulo,
                canto reto e círculo. */}
            <span className="brand__rule" aria-hidden="true" />
          </section>

          <section className="form-panel">
            <div className="form-panel__inner">
              <h1 className="title">Bem-vindo de volta!</h1>
              <p className="subtitle">Acesse sua conta para continuar.</p>

              <LoginForm diretorio={modo.diretorio} senhaLocal={modo.senhaLocal} />

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

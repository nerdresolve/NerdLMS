import { NOME_PADRAO } from "@nerdlms/core/tenancy/branding.ts";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { BrandMosaic } from "@/components/brand/brand-mosaic.tsx";
import { ConfirmResetForm, RequestResetForm } from "@/features/auth/reset-form.tsx";
import "@/features/auth/login.css";

export const metadata: Metadata = {
  title: "Redefinir senha · a organização",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Redefinição de senha.
 *
 * Uma página para os dois passos: sem token, pede o e-mail; com token, define a
 * senha. Separar em duas rotas obrigaria o link do e-mail a conhecer qual
 * delas usar, e o passo seguinte é sempre o mesmo.
 */
export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <main className="auth-page">
      <div className="viewport">
        <div className="auth">
          <section className="brand">
            <BrandMosaic variant="vertical" className="brand__waves" tone="silhueta" />

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
          </section>

          <section className="form-panel">
            <div className="form-panel__inner">
              <h1 className="title">{token ? "Escolha uma nova senha" : "Recuperar acesso"}</h1>
              <p className="subtitle">
                {token
                  ? "Este link vale uma vez só. Depois de salvar, use a senha nova para entrar."
                  : "Informe o e-mail cadastrado e enviaremos um link de redefinição."}
              </p>

              {token ? <ConfirmResetForm token={token} /> : <RequestResetForm />}

              <p className="status-text">
                <Link href="/login">Voltar para o login</Link>
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

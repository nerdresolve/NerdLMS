import { redirect } from "next/navigation";

import { currentFeatures, currentUser } from "@/lib/auth/session.ts";
import { paletteToCss } from "@nerdlms/core/tenancy/branding.ts";

import { FeatureProvider } from "@/features/tenant/feature-context.tsx";
import { TenantProvider } from "@/features/tenant/tenant-context.tsx";

/**
 * Layout do grupo autenticado.
 *
 * Existe por uma razão só: declarar que estas telas são renderizadas por
 * requisição, nunca no build.
 *
 * Toda página deste grupo mostra dados de UMA pessoa — progresso, matrículas,
 * certificados. Prerenderizar qualquer uma delas produziria um HTML fixo,
 * gerado sem requisição e sem sessão, e esse mesmo HTML seria servido a todo
 * mundo (: autorização acontece no servidor, a cada acesso).
 *
 * É também o que faz `next build` terminar hoje: as camadas de dados recusam
 * rodar em produção enquanto a fonte real não existe (TASK-004/TASK-006), e
 * esse `throw` acontecia durante o prerender. Com a renderização dinâmica, ele
 * volta a ser o que sempre quis ser — uma barreira em tempo de execução, não um
 * erro de build.
 */
export const dynamic = "force-dynamic";

/**
 * Além de forçar renderização por requisição, o layout é o portão de entrada
 * do grupo: sem sessão válida, ninguém passa daqui.
 *
 * Ficar num lugar só importa. Se cada página repetisse a checagem, bastaria
 * uma esquecer para abrir um buraco — e a página esquecida seria justamente a
 * que ninguém revisou.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");

  /* Tenant e funcionalidades entram aqui, e não em cada página: são 19 telas
     usando o AppShell, e passar por prop obrigaria todas a repassar algo que a
     maioria não usa — bastaria uma esquecer para a tela dela falar "projeto"
     enquanto as outras falam "concessionária", ou para uma funcionalidade
     desligada reaparecer só ali. */
  const features = await currentFeatures();

  /* A paleta do cliente entra como variáveis CSS num wrapper, não numa folha
     de estilo: ela muda por requisição, e uma folha por tenant seria um
     arquivo estático que não acompanha a troca de cor. String vazia quando o
     cliente não personalizou — aí os tokens do Design System valem sozinhos. */
  const palette = paletteToCss(user.tenant.branding.brandColor);

  return (
    <TenantProvider tenant={user.tenant}>
      <FeatureProvider features={features}>
        {/* Uma regra `:root` injetada, não `style` inline: as variáveis
            precisam valer para a árvore inteira, inclusive para o que é
            renderizado em portal (busca, painel de avisos) — e portal sai do
            wrapper, então herdaria os tokens padrão.

            O conteúdo é gerado por `paletteToCss`, que só emite hexadecimal
            validado: não há caminho para texto do cliente chegar aqui. */}
        {palette ? (
          <style dangerouslySetInnerHTML={{ __html: `:root{${palette}}` }} />
        ) : null}
        {children}
      </FeatureProvider>
    </TenantProvider>
  );
}

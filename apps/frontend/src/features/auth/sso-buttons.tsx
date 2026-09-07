import { Info } from "lucide-react";

import { GoogleMark, MicrosoftMark } from "@/components/brand/provider-marks.tsx";

/**
 * Entrada pelo provedor de identidade da empresa.
 *
 * Componente de SERVIDOR, e é o que permite não mostrar nada quando o cliente
 * não usa SSO: a lista chega pronta de quem renderizou a página, sem uma
 * chamada extra do navegador e sem um pisca-pisca de botões que aparecem
 * depois de carregar.
 *
 * Sem provedor configurado o bloco inteiro some — inclusive o "ou continue
 * com", que sem botão nenhum embaixo ficaria pendurado no vazio.
 */

export interface SsoOption {
  id: string;
  provider: string;
  displayName: string;
}

function marca(provider: string) {
  if (provider === "google") return <GoogleMark />;
  if (provider === "microsoft") return <MicrosoftMark />;
  return null;
}

export function SsoButtons({ options, error }: { options: SsoOption[]; error?: string | null }) {
  if (options.length === 0 && !error) return null;

  return (
    <>
      <div className="divider" role="separator">
        ou continue com
      </div>

      {/* `data-unico` estica o botão quando há um só: o grid de duas colunas
          deixaria metade da largura vazia ao lado dele. */}
      <div className="sso" data-unico={options.length === 1 || undefined}>
        {options.map((opcao) => (
          <a
            key={opcao.id}
            className="btn btn--secondary"
            href={`/api/sso/iniciar?provedor=${encodeURIComponent(opcao.id)}`}
          >
            {marca(opcao.provider)}
            {/* O nome fica VISÍVEL, não só para leitor de tela. O cliente
                personaliza esse texto — "Entrar com a conta ACME" — e um
                ícone sozinho não comunica isso a quem não reconhece a marca
                do provedor que a empresa dele usa. */}
            <span>{opcao.displayName}</span>
          </a>
        ))}
      </div>

      <div className="notice" data-visible={error ? "true" : "false"} role="status">
        {error ? (
          <>
            <Info aria-hidden="true" />
            <span>{error}</span>
          </>
        ) : null}
      </div>
    </>
  );
}

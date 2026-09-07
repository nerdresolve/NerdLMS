/**
 * Provedores de SSO pré-configurados.
 *
 * A plataforma é white-label, e quem implanta para um cliente novo não deveria
 * precisar descobrir a URL de autorização do Google nem o formato do endpoint
 * de token da Microsoft. Esses valores são públicos, estáveis e iguais para
 * todo mundo — não há razão para cada cliente redescobri-los.
 *
 * O que muda por cliente são duas coisas: `client_id` e `client_secret`, que
 * saem do console do provedor. E, no caso da Microsoft, o `tenant` do Entra.
 * O resto vem daqui pronto.
 *
 * `generico` existe para quem não usa nenhum dos dois — Okta, Keycloak, Auth0.
 * Aí sim os endpoints são preenchidos à mão, porque não há como adivinhá-los.
 */

export type ProviderId = "google" | "microsoft" | "generico";

export interface ProviderPreset {
  id: ProviderId;
  /** Nome no botão de login: "Entrar com o Google". */
  label: string;
  /**
   * Endpoints do provedor.
   *
   * `null` em `generico` porque não existe valor padrão possível — quem
   * escolhe genérico informa os três.
   */
  authorizationUrl: string | null;
  tokenUrl: string | null;
  jwksUrl: string | null;
  /** `iss` esperado dentro do id_token. */
  issuer: string | null;
  /**
   * Escopos pedidos na autorização.
   *
   * `openid` é obrigatório pelo protocolo — sem ele o provedor devolve um
   * token de acesso comum e nenhum `id_token`, e o login não acontece.
   */
  scopes: string[];
  /**
   * Precisa de um identificador do locatário do provedor.
   *
   * A Microsoft precisa: o mesmo endpoint serve todas as empresas, e o
   * caminho carrega o tenant. O Google não — os endpoints dele são globais.
   */
  requiresTenantId: boolean;
  /** O que dizer a quem está configurando, na tela de administração. */
  hint: string;
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "google",
    label: "Google",
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    jwksUrl: "https://www.googleapis.com/oauth2/v3/certs",
    issuer: "https://accounts.google.com",
    scopes: ["openid", "email", "profile"],
    requiresTenantId: false,
    hint:
      "No Google Cloud Console, em APIs e Serviços > Credenciais, crie um ID do cliente OAuth do tipo aplicativo da Web. Cole aqui o ID e a chave secreta, e registre lá a URL de retorno mostrada abaixo.",
  },
  {
    id: "microsoft",
    label: "Microsoft",
    /* `{tenant}` é substituído pelo ID do diretório do cliente. O literal
       `common` funcionaria, mas aceitaria qualquer conta Microsoft do mundo —
       inclusive pessoais. Numa plataforma corporativa isso é uma porta
       aberta, então o tenant é obrigatório. */
    authorizationUrl: "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token",
    jwksUrl: "https://login.microsoftonline.com/{tenant}/discovery/v2.0/keys",
    issuer: "https://login.microsoftonline.com/{tenant}/v2.0",
    scopes: ["openid", "email", "profile"],
    requiresTenantId: true,
    hint:
      "No portal do Entra ID, em Registros de aplicativo, registre um aplicativo. O ID do diretório (locatário) fica na visão geral; o ID e a chave secreta do cliente saem de Certificados e segredos.",
  },
  {
    id: "generico",
    label: "OpenID Connect",
    authorizationUrl: null,
    tokenUrl: null,
    jwksUrl: null,
    issuer: null,
    scopes: ["openid", "email", "profile"],
    requiresTenantId: false,
    hint:
      "Para Okta, Keycloak, Auth0 e afins. Os três endereços saem do documento de descoberta do provedor, geralmente em /.well-known/openid-configuration.",
  },
];

const POR_ID = new Map(PROVIDER_PRESETS.map((p) => [p.id, p]));

export function providerPreset(id: string): ProviderPreset | undefined {
  return POR_ID.get(id as ProviderId);
}

/**
 * Troca `{tenant}` pelo diretório do cliente.
 *
 * Devolve `null` quando o provedor exige tenant e ele não veio: um endereço
 * com `{tenant}` literal chegaria à Microsoft e voltaria um erro que não
 * explica nada. Falhar aqui, na configuração, é mais barato que falhar no
 * meio do login de alguém.
 */
export function resolveEndpoint(template: string | null, tenantId: string | null): string | null {
  if (!template) return null;
  if (!template.includes("{tenant}")) return template;
  if (!tenantId || !tenantId.trim()) return null;
  return template.replaceAll("{tenant}", tenantId.trim());
}

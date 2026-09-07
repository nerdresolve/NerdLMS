/**
 * O launch do LTI 1.3 em três etapas — o "OIDC third-party initiated login".
 *
 * O launch direto entrega o `id_token` no primeiro POST. Funciona com muita
 * ferramenta, mas uma ferramenta certificada pela 1EdTech RECUSA: o padrão
 * exige que ela confirme que o launch partiu de quem diz ter partido.
 *
 * As três etapas:
 *
 *   1. INICIAÇÃO — a plataforma manda a pessoa ao `oidc_login_uri` da
 *      ferramenta, com `iss`, `login_hint` e `target_link_uri`. Nenhum dado
 *      sensível aqui: é só "alguém quer abrir isto, venha buscar".
 *
 *   2. AUTENTICAÇÃO — a ferramenta responde chamando a nossa URL de
 *      autenticação, com o `state` DELA e um `nonce` DELA. É a confirmação:
 *      só quem conhece a configuração da ferramenta chega neste passo.
 *
 *   3. ENTREGA — devolvemos o `id_token` assinado, carregando o `state` e o
 *      `nonce` que ELA mandou. Ela confere que são os seus, e sabe que o
 *      launch é legítimo.
 *
 * O `nonce` da etapa 3 é o da FERRAMENTA, não o nosso. Trocar os dois é o erro
 * clássico aqui: o token passaria pela nossa validação e seria recusado pela
 * dela, com uma mensagem que não aponta para o lado errado.
 */

export interface InitiationParams {
  /** Nós, como emissor. O mesmo `iss` que vai no token. */
  iss: string;
  /** Quem quer abrir. Volta na etapa 2 para sabermos de quem se trata. */
  loginHint: string;
  /** O endereço final, dentro da ferramenta. */
  targetLinkUri: string;
  /** Nosso identificador do launch, para reencontrá-lo na etapa 2. */
  ltiMessageHint: string;
  clientId: string;
  deploymentId: string;
}

/**
 * Os campos da etapa 1.
 *
 * Vão por POST, como o padrão define. `client_id` e `lti_deployment_id` são
 * opcionais na especificação, mas mandá-los evita que uma ferramenta usada por
 * várias plataformas precise adivinhar de qual veio.
 */
export function initiationPayload(params: InitiationParams): Record<string, string> {
  return {
    iss: params.iss,
    login_hint: params.loginHint,
    target_link_uri: params.targetLinkUri,
    lti_message_hint: params.ltiMessageHint,
    client_id: params.clientId,
    lti_deployment_id: params.deploymentId,
  };
}

export interface AuthRequest {
  scope: string;
  responseType: string;
  clientId: string;
  redirectUri: string;
  loginHint: string;
  state: string;
  nonce: string;
  prompt: string;
  responseMode: string;
  ltiMessageHint: string | null;
}

export type AuthValidation =
  | { ok: true; request: AuthRequest }
  | { ok: false; error: string };

/**
 * Confere o pedido de autenticação da etapa 2.
 *
 * Cada exigência vem da especificação, e cada uma existe por um motivo:
 *
 *   `scope=openid` e `response_type=id_token` — é um fluxo de identidade, não
 *   de acesso a recurso. Outro valor significa que a ferramenta está falando
 *   outro protocolo.
 *
 *   `response_mode=form_post` — o token tem de voltar no CORPO. Em query
 *   string ele apareceria no log do servidor, no histórico e no `Referer`.
 *
 *   `prompt=none` — a pessoa já está autenticada aqui; o padrão proíbe pedir
 *   login de novo no meio do launch.
 *
 *   `redirect_uri` — conferido contra a lista cadastrada por quem chama, não
 *   aqui. É a checagem mais importante das cinco, e a que exige o banco.
 */
export function validateAuthRequest(params: URLSearchParams): AuthValidation {
  const pegar = (chave: string): string => params.get(chave)?.trim() ?? "";

  const scope = pegar("scope");
  if (scope !== "openid") {
    return { ok: false, error: "O escopo do pedido não é openid." };
  }

  const responseType = pegar("response_type");
  if (responseType !== "id_token") {
    return { ok: false, error: "O tipo de resposta pedido não é id_token." };
  }

  const responseMode = pegar("response_mode");
  if (responseMode !== "form_post") {
    /* Em query string o token viraria histórico do navegador e log de acesso
       — uma credencial guardada em texto em três lugares. */
    return { ok: false, error: "O token só é entregue por form_post." };
  }

  const prompt = pegar("prompt");
  if (prompt !== "none") {
    return { ok: false, error: "O launch não pede autenticação de novo." };
  }

  const clientId = pegar("client_id");
  if (!clientId) return { ok: false, error: "Pedido sem client_id." };

  const redirectUri = pegar("redirect_uri");
  if (!redirectUri) return { ok: false, error: "Pedido sem redirect_uri." };

  const loginHint = pegar("login_hint");
  if (!loginHint) return { ok: false, error: "Pedido sem login_hint." };

  const nonce = pegar("nonce");
  if (!nonce) {
    /* Sem o nonce DELA, o token entregue não prova nada para ela: seria um
       token que ela não pode ligar ao pedido que fez. */
    return { ok: false, error: "Pedido sem nonce." };
  }

  return {
    ok: true,
    request: {
      scope,
      responseType,
      clientId,
      redirectUri,
      loginHint,
      /* `state` é opcional no padrão. A ferramenta que manda espera de volta;
         a que não manda, não. Exigir quebraria ferramentas corretas. */
      state: pegar("state"),
      nonce,
      prompt,
      responseMode,
      ltiMessageHint: params.get("lti_message_hint"),
    },
  };
}

/**
 * O `redirect_uri` está entre os cadastrados?
 *
 * Comparação EXATA, string por string. Aceitar por prefixo deixaria
 * `https://ferramenta.com.evil.com` passar por `https://ferramenta.com` — e o
 * `id_token` assinado por nós iria para o endereço de outra pessoa, que é a
 * credencial inteira entregue de bandeja.
 */
export function isRegisteredRedirect(redirectUri: string, registrados: string[]): boolean {
  return registrados.some((cadastrado) => cadastrado.trim() === redirectUri.trim());
}

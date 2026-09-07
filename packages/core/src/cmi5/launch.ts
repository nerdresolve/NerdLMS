/**
 * Os parâmetros de launch do cmi5.
 *
 * O conteúdo é aberto num iframe com estes valores na URL. Diferente do SCORM,
 * que procura um objeto no `window`, o cmi5 recebe tudo por parâmetro e fala
 * com o LRS por HTTP — o que o torna utilizável fora do navegador: um app de
 * campo, um simulador em outra máquina.
 */

export interface LaunchParams {
  /** Onde o LRS deste produto atende. */
  endpoint: string;
  /** `Basic <token>`, já pronto para o cabeçalho `Authorization`. */
  fetchUrl: string;
  /** A pessoa, no formato de ator do xAPI. */
  actorJson: string;
  /** A unidade, como IRI. */
  activityId: string;
  /** A sessão — é o que liga os statements a esta tentativa. */
  registration: string;
}

/**
 * Monta a URL que o iframe carrega.
 *
 * `fetch` em vez do token direto na URL: o cmi5 define que o conteúdo BUSCA a
 * credencial num endereço de uso único, em vez de recebê-la pronta. A diferença
 * importa porque a URL do iframe aparece no histórico do navegador e no
 * `Referer` de tudo que o conteúdo carregar — o token não pode estar ali.
 */
export function buildLaunchUrl(base: string, params: LaunchParams): string {
  const url = new URL(base);

  url.searchParams.set("endpoint", params.endpoint);
  url.searchParams.set("fetch", params.fetchUrl);
  url.searchParams.set("actor", params.actorJson);
  url.searchParams.set("activityId", params.activityId);
  url.searchParams.set("registration", params.registration);

  return url.toString();
}

/**
 * O ator, no formato que o cmi5 exige.
 *
 * `account` e não `mbox`: o cmi5 recomenda identificar por conta em vez de
 * e-mail justamente porque e-mail é dado pessoal que atravessa para o conteúdo
 * de terceiro. Com `account`, o que sai daqui é um identificador opaco e o
 * nome — o suficiente para o conteúdo cumprimentar a pessoa, sem entregar o
 * endereço dela.
 */
export function actorParaCmi5(input: {
  userId: string;
  fullName: string;
  homePage: string;
}): string {
  return JSON.stringify({
    objectType: "Agent",
    name: input.fullName,
    account: { homePage: input.homePage, name: input.userId },
  });
}

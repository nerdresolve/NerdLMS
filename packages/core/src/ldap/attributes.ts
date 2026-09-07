/**
 * Os atributos do diretório, traduzidos para o que este produto entende.
 *
 * Cada função aqui existe porque a forma que o Active Directory guarda o dado
 * não é a forma que serve para usar: o identificador vem em dezesseis bytes com
 * a ordem trocada, os grupos vêm como caminhos completos na árvore, e o estado
 * da conta vem como bits somados num inteiro.
 */

/**
 * O `objectGUID` como texto.
 *
 * POR QUE A ORDEM DOS BYTES É ESSA
 *
 * O AD guarda dezesseis bytes crus. Lidos em ordem, dariam um texto; lidos como
 * o Windows lê, dão OUTRO. Os três primeiros grupos do GUID são inteiros
 * gravados em little-endian — o quarto byte vem primeiro —, e os dois últimos
 * grupos são bytes em ordem direta. É a estrutura `GUID` do Windows aparecendo
 * na serialização.
 *
 * Isso importa porque o mesmo objeto precisa dar o MESMO texto aqui e em
 * qualquer outra ferramenta da empresa que já tenha gravado esse identificador
 * — o `Get-ADUser` do PowerShell, o `new Guid(byte[])` do .NET, o relatório que
 * alguém exportou. Ler em ordem direta produziria um identificador que só este
 * sistema reconhece, e a primeira integração revelaria o engano.
 */
export function guidToString(bytes: Buffer): string | null {
  if (bytes.length !== 16) return null;

  const hex = (i: number): string => bytes[i]!.toString(16).padStart(2, "0");
  const faixa = (de: number, ate: number): string => {
    let saida = "";
    for (let i = de; i < ate; i += 1) saida += hex(i);
    return saida;
  };

  return [
    hex(3) + hex(2) + hex(1) + hex(0),
    hex(5) + hex(4),
    hex(7) + hex(6),
    faixa(8, 10),
    faixa(10, 16),
  ].join("-");
}

/**
 * O nome do grupo, extraído do caminho dele na árvore.
 *
 * `memberOf` devolve o DN inteiro:
 *
 *     CN=Treinamento_Admin,OU=Grupos,DC=empresa,DC=local
 *
 * e o que interessa é `Treinamento_Admin`.
 *
 * A conta ingênua — cortar no primeiro `=` e depois na primeira vírgula —
 * funciona até o dia em que um grupo se chame `Compras, Suprimentos`. O DN
 * escapa essa vírgula com barra invertida (`CN=Compras\, Suprimentos,OU=...`) e
 * a conta ingênua devolve `Compras\`, que não casa com nada. Aqui a barra
 * invertida é respeitada: o caractere seguinte a ela é sempre literal.
 */
export function grupoDoDn(dn: string): string | null {
  const texto = dn.trim();

  /* Só o primeiro componente. `CN=` é o que o AD usa para grupo; a comparação
     ignora maiúsculas porque a grafia varia entre servidores. */
  const igual = texto.indexOf("=");
  if (igual <= 0) return null;
  if (texto.slice(0, igual).trim().toLowerCase() !== "cn") return null;

  /* Os BYTES do nome, não os caracteres.

     A forma hexadecimal do escape (`\C3\A7` para "ç") descreve UM caractere em
     DOIS bytes, e decodificar cada um sozinho daria dois caracteres inválidos.
     Juntar os bytes e converter no fim é o que respeita isso. */
  const bytes: number[] = [];
  const empurrar = (s: string): void => {
    for (const b of Buffer.from(s, "utf8")) bytes.push(b);
  };

  for (let i = igual + 1; i < texto.length; i += 1) {
    const c = texto[i]!;

    if (c === "\\") {
      const par = texto.slice(i + 1, i + 3);

      /* Duas formas de escape convivem no RFC 4514: `\,` — a barra e o próprio
         caractere — e `\2C`, o código do caractere em hexadecimal. O
         OpenLDAP devolve a segunda; ler só a primeira transformava
         `Compras\2C Suprimentos` em `Compras2C Suprimentos`, um nome que não
         casa com mapeamento nenhum. Foi um servidor de verdade que mostrou
         isso — o teste de unidade usava a forma que já funcionava. */
      if (/^[0-9a-f]{2}$/i.test(par)) {
        bytes.push(parseInt(par, 16));
        i += 2;
        continue;
      }

      const proximo = texto[i + 1];
      if (proximo === undefined) break;
      empurrar(proximo);
      i += 1;
      continue;
    }

    /* Vírgula sem escape separa componentes; `+` sem escape junta um RDN
       composto, e o que vem depois já não é o nome. */
    if (c === "," || c === "+") break;

    empurrar(c);
  }

  const limpo = Buffer.from(bytes).toString("utf8").trim();
  return limpo || null;
}

/** Os nomes dos grupos de uma lista de `memberOf`, sem repetição e sem vazios. */
export function gruposDe(memberOf: string[]): string[] {
  const nomes = new Set<string>();

  for (const dn of memberOf) {
    const nome = grupoDoDn(dn);
    if (nome) nomes.add(nome);
  }

  return [...nomes];
}

/**
 * Os bits de `userAccountControl` que dizem respeito a entrar ou não.
 *
 * O atributo é um inteiro onde cada bit é uma propriedade da conta. Só estes
 * três decidem se alguém deveria conseguir autenticar; os outros descrevem
 * política de senha e tipo de conta, que não são assunto daqui.
 */
export const UAC = {
  DESABILITADA: 0x0002,
  BLOQUEADA: 0x0010,
  SENHA_EXPIRADA: 0x800000,
} as const;

export interface EstadoDaConta {
  desabilitada: boolean;
  bloqueada: boolean;
}

export function estadoDaConta(userAccountControl: number): EstadoDaConta {
  return {
    desabilitada: (userAccountControl & UAC.DESABILITADA) !== 0,
    /* O bit de bloqueio no `userAccountControl` é pouco confiável no AD — quem
       manda de verdade é `lockoutTime` comparado com a duração da política. Ele
       fica aqui porque OpenLDAP e outros diretórios o usam, e porque ler o bit
       não custa nada. A decisão de recusar NÃO se apoia só nele. */
    bloqueada: (userAccountControl & UAC.BLOQUEADA) !== 0,
  };
}

/**
 * O CPF, só com os dígitos.
 *
 * O diretório guarda como a pessoa que cadastrou digitou: com pontos, com
 * traço, ou nenhum dos dois. Guardar as três formas faria a mesma pessoa
 * parecer três, e qualquer comparação futura falharia sem dizer por quê.
 *
 * Sem validar dígito verificador: o dado é do diretório da empresa, e recusá-lo
 * aqui impediria alguém de entrar por causa de um erro de digitação em outro
 * sistema. O que não serve fica vazio.
 */
export function somenteDigitos(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const digitos = valor.replace(/\D/g, "");
  return digitos.length === 11 ? digitos : null;
}

/** Primeiro valor de um atributo, como texto. */
export function texto(
  atributos: Map<string, Buffer[]>,
  nome: string,
): string | null {
  const valor = atributos.get(nome.toLowerCase())?.[0];
  if (!valor) return null;

  const s = valor.toString("utf8").trim();
  return s || null;
}

/** Todos os valores de um atributo, como texto. */
export function textos(atributos: Map<string, Buffer[]>, nome: string): string[] {
  return (atributos.get(nome.toLowerCase()) ?? [])
    .map((v) => v.toString("utf8").trim())
    .filter(Boolean);
}

/**
 * Um atributo numérico.
 *
 * `lockoutTime` é um FILETIME de 64 bits — mais que o `Number` do JavaScript
 * representa com exatidão. Aqui isso não importa: a única pergunta é se ele é
 * ZERO, e a perda de precisão nos dígitos baixos não transforma zero em outra
 * coisa. Se um dia for preciso a data do bloqueio, este caminho terá de virar
 * `BigInt`.
 */
export function numero(
  atributos: Map<string, Buffer[]>,
  nome: string,
): number | null {
  const s = texto(atributos, nome);
  if (s === null) return null;

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

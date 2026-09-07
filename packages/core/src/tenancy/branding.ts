/**
 * Identidade visual por cliente.
 *
 * Um white-label sem branding é software com o nome de outra empresa na tela.
 * Mas personalizar cor tem um risco: o cliente escolhe um tom bonito, e o
 * texto branco em cima dele fica ilegível.
 *
 * Por isso o cliente informa UMA cor, e as demais são derivadas aqui. Pedir
 * seis cores convidaria a combinações que reprovam em contraste — e WCAG AA é
 * régua do produto, não escolha por cliente (guia §34).
 */

import { ARQUIVOS, COR, NOME } from "../brand/brand.config.ts";

export interface Branding {
  logoLightUrl: string | null;
  logoDarkUrl: string | null;
  faviconUrl: string | null;
  brandColor: string | null;
  mailFromName: string | null;
  mailFromEmail: string | null;
}

/**
 * A marca do PRODUTO — reexportada de `brand/brand.config.ts`, que é o arquivo
 * que um fork edita. Aqui só se consome; lá se decide.
 *
 * Aparece enquanto o domínio não identificar nenhum cliente: acesso inicial,
 * login, recuperação de senha, validação pública de certificado. Todo cliente
 * com tenant cadastrado vê o PRÓPRIO nome e as próprias logos.
 */
export const NOME_PADRAO = NOME;

export const BRANDING_PADRAO = {
  logoLight: ARQUIVOS.logoClaro,
  logoDark: ARQUIVOS.logoEscuro,
  favicon: ARQUIVOS.favicon,
  brandColor: COR,
} as const;

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function parseHex(hex: string): Rgb | null {
  const limpo = hex.trim().replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(limpo)) return null;

  return {
    r: parseInt(limpo.slice(0, 2), 16),
    g: parseInt(limpo.slice(2, 4), 16),
    b: parseInt(limpo.slice(4, 6), 16),
  };
}

function toHex({ r, g, b }: Rgb): string {
  const canal = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, "0");
  return `#${canal(r)}${canal(g)}${canal(b)}`;
}

/**
 * Luminância relativa (WCAG 2.x).
 *
 * É o que permite calcular contraste de verdade em vez de chutar pelo brilho
 * aparente: o olho humano é muito mais sensível ao verde que ao azul, e uma
 * média simples dos canais erraria feio justamente no azul da marca.
 */
export function luminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;

  const canal = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * canal(rgb.r) + 0.7152 * canal(rgb.g) + 0.0722 * canal(rgb.b);
}

/** Razão de contraste entre duas cores. 4.5 é o mínimo do WCAG AA para texto. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const claro = Math.max(la, lb);
  const escuro = Math.min(la, lb);
  return (claro + 0.05) / (escuro + 0.05);
}

/** Escurece ou clareia mantendo o matiz. `fator` negativo escurece. */
function ajustar(hex: string, fator: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;

  const alvo = fator < 0 ? 0 : 255;
  const peso = Math.abs(fator);

  return toHex({
    r: rgb.r + (alvo - rgb.r) * peso,
    g: rgb.g + (alvo - rgb.g) * peso,
    b: rgb.b + (alvo - rgb.b) * peso,
  });
}

export interface BrandPalette {
  brand: string;
  brandHover: string;
  brandActive: string;
  brandDeep: string;
  brandSubtle: string;
  /** Texto sobre a cor de marca: branco ou quase preto, o que contrastar. */
  onBrand: string;
  /**
   * A marca usada COMO TEXTO, sobre fundo claro.
   *
   * Não é a mesma coisa que `brand`: ali a cor é fundo e o texto se adapta;
   * aqui a cor É o texto, e o fundo é o card branco. Um amarelo de marca dá
   * 1.27:1 sobre branco — invisível. Esta variante escurece até passar,
   * mantendo o matiz, e é por isso que existe separada.
   */
  textBrand: string;
}

/**
 * A paleta completa, a partir de uma cor.
 *
 * **A cor do cliente é preservada.** Quem escolhe amarelo recebe amarelo — o
 * que muda é o texto por cima. Escurecer o amarelo até ele passar com branco
 * produziria um marrom, e entregar marrom a quem pediu amarelo é
 * descaracterizar a marca de alguém para resolver um problema que o texto
 * resolve.
 *
 * O contraste é garantido escolhendo entre texto branco e quase-preto — o que
 * contrastar mais com a cor. É assim que uma marca amarela funciona no mundo
 * real: texto escuro em cima.
 *
 * A única cor derivada com ajuste é `brandDeep`, usada em gradiente e sombra,
 * onde não há texto por cima.
 */
export function paletteFrom(brandColor: string | null): BrandPalette {
  const brand = parseHex(brandColor ?? "") ? brandColor! : BRANDING_PADRAO.brandColor;

  /* O texto acompanha a cor, não o contrário. */
  const comBranco = contrastRatio(brand, "#FFFFFF");
  const comEscuro = contrastRatio(brand, "#0B1120");
  const passaComBranco = comBranco >= comEscuro;

  return {
    brand,
    /* Hover e ativo escurecem numa marca escura e CLAREIAM numa clara: numa
       cor amarela, escurecer o hover reduziria o contraste com o texto escuro
       que fica em cima, e o botão pareceria apagar ao receber o ponteiro. */
    brandHover: ajustar(brand, passaComBranco ? -0.12 : 0.12),
    brandActive: ajustar(brand, passaComBranco ? -0.22 : 0.22),
    brandDeep: ajustar(brand, -0.55),
    brandSubtle: ajustar(brand, 0.88),
    onBrand: passaComBranco ? "#FFFFFF" : "#0B1120",
    textBrand: escurecerAteLer(brand),
  };
}

/**
 * Escurece uma cor até ela servir de TEXTO sobre fundo claro.
 *
 * Aqui escurecer é correto — ao contrário da superfície, onde entregaria
 * marrom a quem pediu amarelo. Um rótulo em amarelo puro sobre card branco é
 * ilegível, e legibilidade de texto não é negociável (WCAG 1.4.3).
 */
function escurecerAteLer(hex: string): string {
  let cor = hex;

  for (let passo = 0; passo < 20 && contrastRatio(cor, "#FFFFFF") < 4.5; passo += 1) {
    cor = ajustar(cor, -0.1);
  }

  return cor;
}

/**
 * A paleta como variáveis CSS, para injetar no `<html>`.
 *
 * Devolve string vazia quando o cliente não personalizou: sem regra nenhuma,
 * os tokens do Design System valem como sempre valeram.
 */
export function paletteToCss(brandColor: string | null): string {
  if (!brandColor || !parseHex(brandColor)) return "";

  const p = paletteFrom(brandColor);

  return [
    `--brand:${p.brand}`,
    `--brand-hover:${p.brandHover}`,
    `--brand-active:${p.brandActive}`,
    `--brand-accent:${p.brand}`,
    `--brand-deep:${p.brandDeep}`,
    `--surface-brand:${p.brand}`,
    `--surface-brand-subtle:${p.brandSubtle}`,
    `--text-brand:${p.textBrand}`,
    `--text-on-brand:${p.onBrand}`,
    `--border-brand:${p.brand}`,
    `--fill:${p.brand}`,
    /* O grafismo em quatro cores é o do produto. Para um cliente que
       personaliza a marca, ele vira monocromático na cor dele — quatro tons da
       mesma família, derivados aqui. Manter o amarelo e o verde do símbolo
       alheio seria pôr a marca de uma empresa dentro do produto de outra. */
    `--tile-blue:${p.brandHover}`,
    `--tile-navy:${p.brandDeep}`,
    `--tile-sun:${p.brand}`,
    `--tile-leaf:${p.brandActive}`,
    `--tile-ring:${p.brand}`,
    `--gradient-brand:linear-gradient(150deg,${p.brand} 0%,${p.brandHover} 55%,${p.brandDeep} 100%)`,
  ].join(";");
}

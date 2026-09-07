import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  badgeSvg,
  criteriaNarrative,
  openBadgeAssertion,
  openBadgeClass,
  openBadgeIssuer,
} from "./open-badges.ts";

const BASE = "https://ead.exemplo.com.br";

/** O mesmo hash que o backend usa: sha256 do e-mail com o sal. */
function hashEmail(email: string, salt: string): string {
  return `sha256$${createHash("sha256").update(email.toLowerCase() + salt).digest("hex")}`;
}

describe("Open Badges 2.0: F6-01", () => {
  test("o emissor aponta para o próprio domínio", () => {
    const issuer = openBadgeIssuer({
      baseUrl: BASE,
      tenantName: "a organização",
      email: "treinamento@exemplo.com",
    });

    assert.equal(issuer["@context"], "https://w3id.org/openbadges/v2");
    assert.equal(issuer.type, "Issuer");
    assert.equal(issuer.id, `${BASE}/api/badges/issuer`);
    assert.equal(issuer.name, "a organização");
  });

  test("o emissor sem e-mail não inventa campo vazio", () => {
    /* Um `email: ""` no documento é pior que a ausência: um validador o trata
       como endereço inválido. */
    const issuer = openBadgeIssuer({ baseUrl: BASE, tenantName: "X", email: null });

    assert.equal("email" in issuer, false);
  });

  test("o badge tem imagem, o padrão exige", () => {
    /* Sem `image`, o documento não renderiza em nenhum leitor externo. */
    const classe = openBadgeClass({
      baseUrl: BASE,
      badgeId: "b1",
      name: "NR-10 Básico",
      description: "Segurança em instalações elétricas.",
      criteriaText: "Concluir o curso NR-10.",
    });

    assert.equal(classe.type, "BadgeClass");
    assert.equal(classe.image, `${BASE}/api/badges/b1/imagem.svg`);
    assert.equal(classe.issuer, `${BASE}/api/badges/issuer`);
    assert.deepEqual(classe.criteria, {
      type: "Criteria",
      narrative: "Concluir o curso NR-10.",
    });
  });

  test("O E-MAIL NUNCA APARECE EM TEXTO na assertion", () => {
    /* A assertion é um documento público — é o que o verificador busca.
       O e-mail em texto transformaria cada badge compartilhado num endereço
       exposto a quem coletar. */
    const email = "maria.souza@exemplo.com";

    const assertion = openBadgeAssertion(
      {
        baseUrl: BASE,
        code: "ABC123DEF456",
        badgeId: "b1",
        recipientEmail: email,
        salt: "sal-desta-emissao",
        awardedAt: "2026-03-01T12:00:00.000Z",
        expiresAt: null,
        revoked: false,
      },
      hashEmail,
    );

    const texto = JSON.stringify(assertion);
    assert.equal(texto.includes(email), false, "o e-mail vazou no documento público");
    assert.equal(texto.includes("maria.souza"), false);

    const recipient = assertion.recipient as Record<string, unknown>;
    assert.equal(recipient.hashed, true);
    assert.equal(recipient.salt, "sal-desta-emissao");
    assert.match(String(recipient.identity), /^sha256\$[0-9a-f]{64}$/);
  });

  test("quem já sabe o e-mail consegue conferir o hash", () => {
    /* É essa a garantia do formato: não revela, mas permite verificar. */
    const assertion = openBadgeAssertion(
      {
        baseUrl: BASE,
        code: "ABC123DEF456",
        badgeId: "b1",
        recipientEmail: "Maria.Souza@exemplo.com",
        salt: "sal",
        awardedAt: "2026-03-01T12:00:00.000Z",
        expiresAt: null,
        revoked: false,
      },
      hashEmail,
    );

    const recipient = assertion.recipient as Record<string, unknown>;

    /* Caixa diferente, mesmo hash: e-mail não distingue maiúscula. */
    assert.equal(recipient.identity, hashEmail("maria.souza@exemplo.com", "sal"));
  });

  test("a emissão revogada continua acessível e se declara revogada", () => {
    /* Sumir com ela faria o verificador ver "não encontrado", indistinguível de
       erro nosso. */
    const assertion = openBadgeAssertion(
      {
        baseUrl: BASE,
        code: "ABC123DEF456",
        badgeId: "b1",
        recipientEmail: "x@y.com",
        salt: "s",
        awardedAt: "2026-03-01T12:00:00.000Z",
        expiresAt: null,
        revoked: true,
        revokedReason: "Emitido por engano.",
      },
      hashEmail,
    );

    assert.equal(assertion.revoked, true);
    assert.equal(assertion.revocationReason, "Emitido por engano.");
    assert.equal(assertion.id, `${BASE}/api/badges/emissao/ABC123DEF456`);
  });

  test("a validade entra como `expires` só quando existe", () => {
    const comValidade = openBadgeAssertion(
      {
        baseUrl: BASE, code: "A", badgeId: "b", recipientEmail: "x@y.com", salt: "s",
        awardedAt: "2026-03-01T12:00:00.000Z", expiresAt: "2027-03-01T12:00:00.000Z", revoked: false,
      },
      hashEmail,
    );
    const semValidade = openBadgeAssertion(
      {
        baseUrl: BASE, code: "A", badgeId: "b", recipientEmail: "x@y.com", salt: "s",
        awardedAt: "2026-03-01T12:00:00.000Z", expiresAt: null, revoked: false,
      },
      hashEmail,
    );

    assert.equal(comValidade.expires, "2027-03-01T12:00:00.000Z");
    assert.equal("expires" in semValidade, false);
  });

  test("a verificação é hospedada no nosso domínio", () => {
    const assertion = openBadgeAssertion(
      {
        baseUrl: BASE, code: "A", badgeId: "b", recipientEmail: "x@y.com", salt: "s",
        awardedAt: "2026-03-01T12:00:00.000Z", expiresAt: null, revoked: false,
      },
      hashEmail,
    );

    assert.deepEqual(assertion.verification, { type: "HostedBadge" });
  });

  test("o texto do critério fala português, não schema", () => {
    assert.match(criteriaNarrative("course_completed", { courseName: "NR-10" }), /Concluir o curso NR-10/);
    assert.match(criteriaNarrative("courses_count", { threshold: 3 }), /3 cursos/);
    assert.match(criteriaNarrative("grade_above", { courseName: "NR-10", threshold: 80 }), /80%/);
    assert.match(criteriaNarrative("manual", {}), /equipe/i);
  });

  test("o SVG escapa o que vem de fora", () => {
    /* O nome do badge é digitado por alguém do cliente e vai para dentro de um
       documento XML servido pela plataforma. */
    const svg = badgeSvg('Badge <script>alert("x")</script>', "#0A33CC", "BA");

    assert.equal(svg.includes("<script>"), false);
    assert.ok(svg.includes("&lt;script&gt;"));
    assert.ok(svg.includes("<title"));
  });

  test("cor inválida no SVG cai para o padrão", () => {
    /* A cor vem da marca do cliente; qualquer coisa que não seja hex viraria
       atributo injetado no SVG. */
    const comInjecao = badgeSvg("X", '" onload="alert(1)', "X");

    assert.equal(comInjecao.includes("onload"), false);
    assert.ok(comInjecao.includes("#0A33CC"));

    const valida = badgeSvg("X", "#FF0000", "X");
    assert.ok(valida.includes("#FF0000"));
  });
});

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { decideLink, type LinkInput } from "./linking.ts";

function entrada(over: Partial<LinkInput> = {}): LinkInput {
  return {
    provider: "google",
    subject: "sub-123",
    email: "ana@empresa.com.br",
    fullName: "Ana Souza",
    linked: null,
    byEmail: null,
    allowJit: false,
    jitRole: "learner",
    ...over,
  };
}

describe("SSO, vínculo de conta", () => {
  test("quem já tem vínculo entra direto", () => {
    const d = decideLink(
      entrada({ linked: { provider: "google", subject: "sub-123", userId: "u-1" } }),
    );

    assert.deepEqual(d, { kind: "login", userId: "u-1" });
  });

  test("quem já tinha conta com o mesmo e-mail é vinculado no primeiro login", () => {
    const d = decideLink(
      entrada({
        byEmail: { id: "u-9", email: "ana@empresa.com.br", status: "active", hasAnyLink: false },
      }),
    );

    assert.deepEqual(d, { kind: "link-and-login", userId: "u-9" });
  });

  test("sem conta e sem permissão de criar, recusa", () => {
    const d = decideLink(entrada({ allowJit: false }));

    assert.equal(d.kind, "refuse");
    assert.match(d.kind === "refuse" ? d.reason : "", /administrador/i);
  });

  test("sem conta e com permissão, cria", () => {
    const d = decideLink(entrada({ allowJit: true, jitRole: "learner" }));

    assert.deepEqual(d, {
      kind: "create",
      email: "ana@empresa.com.br",
      fullName: "Ana Souza",
      role: "learner",
    });
  });

  test("o papel de quem é criado vem da configuração do cliente", () => {
    const d = decideLink(entrada({ allowJit: true, jitRole: "instructor" }));
    assert.equal(d.kind === "create" && d.role, "instructor");
  });

  test("sem nome, o e-mail vira o nome", () => {
    /* Melhor que uma lista de pessoas com o campo vazio; a pessoa corrige no
       perfil depois. */
    const d = decideLink(entrada({ allowJit: true, fullName: null }));
    assert.equal(d.kind === "create" && d.fullName, "ana@empresa.com.br");
  });

  test("nome só com espaços também vira o e-mail", () => {
    const d = decideLink(entrada({ allowJit: true, fullName: "   " }));
    assert.equal(d.kind === "create" && d.fullName, "ana@empresa.com.br");
  });

  test("o e-mail de quem é criado vem normalizado", () => {
    const d = decideLink(entrada({ allowJit: true, email: " Ana@Empresa.COM.BR " }));
    assert.equal(d.kind === "create" && d.email, "ana@empresa.com.br");
  });
});

describe("SSO, conta desativada", () => {
  test("conta inativa não entra, mesmo com vínculo", () => {
    /* É o acesso que uma empresa mais quer cortar no dia de um desligamento.
       Sem esta conferência, desligar alguém no painel deixaria o SSO aberto. */
    const d = decideLink(
      entrada({
        linked: { provider: "google", subject: "sub-123", userId: "u-1" },
        byEmail: { id: "u-1", email: "ana@empresa.com.br", status: "inactive", hasAnyLink: true },
      }),
    );

    assert.equal(d.kind, "refuse");
    assert.match(d.kind === "refuse" ? d.reason : "", /inativa/i);
  });

  test("conta inativa não é vinculada por e-mail", () => {
    const d = decideLink(
      entrada({
        byEmail: { id: "u-9", email: "ana@empresa.com.br", status: "inactive", hasAnyLink: false },
      }),
    );

    assert.equal(d.kind, "refuse");
  });

  test("quem está pendente e ainda não entrou consegue entrar pelo SSO", () => {
    /* É o fluxo esperado: o administrador cadastra a pessoa, ela nunca definiu
       senha, e o primeiro acesso é pelo provedor da empresa. */
    const d = decideLink(
      entrada({
        byEmail: { id: "u-9", email: "ana@empresa.com.br", status: "pending", hasAnyLink: false },
      }),
    );

    assert.equal(d.kind, "link-and-login");
  });
});

describe("SSO, o vínculo manda mais que o e-mail", () => {
  test("e-mail trocado no provedor não perde a conta", () => {
    /* Quem casa e troca de sobrenome recebe outro endereço e continua a mesma
       pessoa. O vínculo é por `sub` justamente por isso. */
    const d = decideLink(
      entrada({
        email: "ana.souza.silva@empresa.com.br",
        linked: { provider: "google", subject: "sub-123", userId: "u-1" },
        byEmail: null,
      }),
    );

    assert.deepEqual(d, { kind: "login", userId: "u-1" });
  });

  test("o vínculo vence quando aponta para conta diferente da do e-mail", () => {
    /* Acontece quando o e-mail de alguém é reatribuído a outra pessoa na
       empresa. Seguir o e-mail entregaria a conta antiga ao novo dono do
       endereço; seguir o `sub` mantém cada um na sua. */
    const d = decideLink(
      entrada({
        linked: { provider: "google", subject: "sub-123", userId: "u-antigo" },
        byEmail: { id: "u-novo", email: "ana@empresa.com.br", status: "active", hasAnyLink: false },
      }),
    );

    assert.equal(d.kind === "login" && d.userId, "u-antigo");
  });
});

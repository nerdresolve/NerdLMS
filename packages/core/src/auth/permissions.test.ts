import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { can, highlightsAsInstructor, type Actor, type Resource } from "./permissions.ts";

const admin: Actor = { id: "u-admin", role: "admin" };
const author: Actor = { id: "u-prof", role: "instructor" };
const otherInstructor: Actor = { id: "u-prof2", role: "instructor" };
const learner: Actor = { id: "u-aluno", role: "learner" };
const otherLearner: Actor = { id: "u-aluno2", role: "learner" };

const published: Resource = { kind: "course", authorId: author.id, status: "published" };
const draft: Resource = { kind: "course", authorId: author.id, status: "draft" };

describe("Admin", () => {
  test("cria, edita e exclui qualquer curso, inclusive de outro autor", () => {
    for (const action of ["create", "update", "delete", "publish"] as const) {
      assert.equal(can(admin, action, published), true, action);
      assert.equal(can(admin, action, { kind: "course", authorId: "qualquer", status: "draft" }), true, action);
    }
  });

  test("vê o engajamento geral da plataforma", () => {
    assert.equal(can(admin, "read", { kind: "analytics", scope: "platform" }), true);
    assert.equal(can(learner, "read", { kind: "analytics", scope: "platform" }), false);
    assert.equal(can(author, "read", { kind: "analytics", scope: "platform" }), false);
  });

  test("gerencia usuários; ninguém mais gerencia", () => {
    assert.equal(can(admin, "update", { kind: "user" }), true);
    assert.equal(can(author, "update", { kind: "user" }), false);
    assert.equal(can(learner, "read", { kind: "user" }), false);
  });

  test("não responde com a tag Professor: a tag é de autoria, não de hierarquia", () => {
    assert.equal(can(admin, "highlight", { kind: "comment", authorId: admin.id, courseAuthorId: author.id }), false);
  });
});

describe("Instructor", () => {
  test("cria curso", () => {
    assert.equal(can(author, "create", draft), true);
  });

  test("edita e exclui apenas o que é seu", () => {
    const alheio: Resource = { kind: "course", authorId: otherInstructor.id, status: "published" };
    for (const action of ["update", "delete", "publish"] as const) {
      assert.equal(can(author, action, published), true, `próprio: ${action}`);
      assert.equal(can(author, action, alheio), false, `alheio: ${action}`);
    }
  });

  test("lê rascunho próprio, mas não rascunho alheio", () => {
    assert.equal(can(author, "read", draft), true);
    assert.equal(can(otherInstructor, "read", draft), false);
    assert.equal(can(otherInstructor, "read", published), true);
  });

  test("vê o engajamento dos alunos dos seus cursos, não dos outros", () => {
    assert.equal(can(author, "read", { kind: "analytics", scope: "course", courseAuthorId: author.id }), true);
    assert.equal(
      can(author, "read", { kind: "analytics", scope: "course", courseAuthorId: otherInstructor.id }),
      false,
    );
  });

  test("lê o progresso de aluno do seu curso, mas não altera", () => {
    const progresso: Resource = { kind: "progress", learnerId: learner.id, courseAuthorId: author.id };
    assert.equal(can(author, "read", progresso), true);
    assert.equal(can(author, "update", progresso), false);
    assert.equal(
      can(author, "read", { kind: "progress", learnerId: learner.id, courseAuthorId: otherInstructor.id }),
      false,
    );
  });

  test("não matricula ninguém", () => {
    assert.equal(can(author, "enroll", { kind: "enrollment", learnerId: learner.id, courseAuthorId: author.id }), false);
  });

  test("modera comentários do seu curso; não os de curso alheio", () => {
    const noSeuCurso: Resource = { kind: "comment", authorId: learner.id, courseAuthorId: author.id };
    const emOutro: Resource = { kind: "comment", authorId: learner.id, courseAuthorId: otherInstructor.id };
    assert.equal(can(author, "delete", noSeuCurso), true);
    assert.equal(can(author, "delete", emOutro), false);
  });

  test("não edita o texto do comentário de outra pessoa", () => {
    assert.equal(can(author, "update", { kind: "comment", authorId: learner.id, courseAuthorId: author.id }), false);
  });
});

describe("Learner", () => {
  test("matricula a si mesmo, nunca outra pessoa", () => {
    assert.equal(
      can(learner, "enroll", { kind: "enrollment", learnerId: learner.id, courseAuthorId: author.id }),
      true,
    );
    assert.equal(
      can(learner, "enroll", { kind: "enrollment", learnerId: otherLearner.id, courseAuthorId: author.id }),
      false,
    );
  });

  test("lê e escreve o próprio progresso; não toca no de outro aluno", () => {
    const meu: Resource = { kind: "progress", learnerId: learner.id, courseAuthorId: author.id };
    const alheio: Resource = { kind: "progress", learnerId: otherLearner.id, courseAuthorId: author.id };
    assert.equal(can(learner, "read", meu), true);
    assert.equal(can(learner, "update", meu), true);
    assert.equal(can(learner, "read", alheio), false, "IDOR: progresso de outro aluno");
    assert.equal(can(learner, "update", alheio), false, "IDOR: escrita em progresso alheio");
  });

  test("comenta e responde", () => {
    const comentario: Resource = { kind: "comment", authorId: learner.id, courseAuthorId: author.id };
    assert.equal(can(learner, "comment", comentario), true);
    assert.equal(can(learner, "reply", comentario), true);
  });

  test("apaga o próprio comentário, não o dos outros", () => {
    assert.equal(can(learner, "delete", { kind: "comment", authorId: learner.id, courseAuthorId: author.id }), true);
    assert.equal(
      can(learner, "delete", { kind: "comment", authorId: otherLearner.id, courseAuthorId: author.id }),
      false,
    );
  });

  test("não enxerga curso em rascunho", () => {
    assert.equal(can(learner, "read", draft), false);
    assert.equal(can(learner, "read", published), true);
  });

  test("não cria nem edita curso", () => {
    for (const action of ["create", "update", "delete", "publish"] as const) {
      assert.equal(can(learner, action, published), false, action);
    }
  });

  test("vê só o próprio painel de progresso", () => {
    assert.equal(can(learner, "read", { kind: "analytics", scope: "self", learnerId: learner.id }), true);
    assert.equal(can(learner, "read", { kind: "analytics", scope: "self", learnerId: otherLearner.id }), false);
  });
});

describe("Tag Professor", () => {
  test("só o instrutor autor do curso destaca a resposta", () => {
    assert.equal(highlightsAsInstructor(author, author.id), true);
    assert.equal(highlightsAsInstructor(otherInstructor, author.id), false);
    assert.equal(highlightsAsInstructor(learner, author.id), false);
    assert.equal(highlightsAsInstructor(admin, author.id), false);
  });

  test("um aluno não vira professor mudando o próprio id", () => {
    // Simula o payload adulterado: aluno tentando se passar pelo autor.
    const impostor: Actor = { id: author.id, role: "learner" };
    assert.equal(highlightsAsInstructor(impostor, author.id), false);
  });
});

describe("Falha fechada", () => {
  test("ação desconhecida é negada", () => {
    assert.equal(can(learner, "publish" as never, published), false);
    assert.equal(can(author, "enroll", published), false);
  });

  test("papel desconhecido não recebe permissão", () => {
    const estranho = { id: "x", role: "auditor" } as unknown as Actor;
    assert.equal(can(estranho, "read", { kind: "user" }), false);
    assert.equal(can(estranho, "update", published), false);
  });
});

describe("Manager, o Gestor da proposta", () => {
  const gestor: Actor = { id: "u5", role: "manager", project: "Unidade Leste" };

  test("lê o engajamento do próprio projeto, não o de outro", () => {
    assert.equal(can(gestor, "read", { kind: "analytics", scope: "project", project: "Unidade Leste" }), true);
    assert.equal(can(gestor, "read", { kind: "analytics", scope: "project", project: "Unidade Central" }), false);
  });

  test("não vê o engajamento da plataforma inteira, isso é do admin", () => {
    assert.equal(can(gestor, "read", { kind: "analytics", scope: "platform" }), false);
  });

  test("gerencia gente do próprio projeto, nunca de outro", () => {
    assert.equal(can(gestor, "create", { kind: "user", project: "Unidade Leste" }), true);
    assert.equal(can(gestor, "create", { kind: "user", project: "Unidade Sul" }), false);
    assert.equal(can(gestor, "create", { kind: "user" }), false, "usuário sem projeto não é dele");
  });

  test("matricula a equipe: é o caso do treinamento obrigatório", () => {
    assert.equal(
      can(gestor, "enroll", { kind: "enrollment", learnerId: "s1", courseAuthorId: "u2" }),
      true,
    );
  });

  test("não cria, edita nem publica curso, conteúdo é do instrutor", () => {
    const curso: Resource = { kind: "course", authorId: "u2", status: "published" };
    for (const action of ["create", "update", "delete", "publish"] as const) {
      assert.equal(can(gestor, action, curso), false, action);
    }
  });

  test("não enxerga rascunho", () => {
    assert.equal(can(gestor, "read", { kind: "course", authorId: "u2", status: "draft" }), false);
  });

  test("não responde com a tag Professor", () => {
    assert.equal(can(gestor, "highlight", { kind: "comment", authorId: gestor.id, courseAuthorId: "u2" }), false);
  });

  test("gestor sem projeto definido não enxerga nada", () => {
    const semProjeto: Actor = { id: "u6", role: "manager" };
    assert.equal(can(semProjeto, "read", { kind: "analytics", scope: "project", project: "Unidade Leste" }), false);
    assert.equal(can(semProjeto, "create", { kind: "user", project: "Unidade Leste" }), false);
  });
});

describe("Recorte por projeto para os demais papéis", () => {
  test("instrutor não lê engajamento de projeto", () => {
    assert.equal(can(author, "read", { kind: "analytics", scope: "project", project: "Unidade Leste" }), false);
  });

  test("aluno não lê engajamento de projeto", () => {
    assert.equal(can(learner, "read", { kind: "analytics", scope: "project", project: "Unidade Leste" }), false);
  });

  test("admin lê qualquer recorte", () => {
    assert.equal(can(admin, "read", { kind: "analytics", scope: "project", project: "Unidade Leste" }), true);
  });
});

describe("Comentário, editar é do autor, moderar é do dono do curso", () => {
  const meu: Resource = { kind: "comment", authorId: learner.id, courseAuthorId: author.id };
  const alheio: Resource = { kind: "comment", authorId: otherLearner.id, courseAuthorId: author.id };

  test("o autor edita o que escreveu", () => {
    assert.equal(can(learner, "update", meu), true);
  });

  test("ninguém edita comentário alheio, nem admin, nem o dono do curso", () => {
    // Moderar é REMOVER, e remover deixa rastro em auditoria. Reescrever a fala
    // de alguém mantendo o nome dessa pessoa embaixo seria pôr palavras na boca
    // dela: um "eu concordo" poderia virar "eu discordo" sem sinal nenhum.
    assert.equal(can(author, "update", alheio), false);
    assert.equal(can(admin, "update", alheio), false);
    assert.equal(can(otherLearner, "update", meu), false);
  });

  test("o autor apaga o próprio comentário", () => {
    assert.equal(can(learner, "delete", meu), true);
  });

  test("o instrutor modera o que está NO CURSO DELE", () => {
    assert.equal(can(author, "delete", alheio), true);
  });

  test("instrutor de outro curso não modera", () => {
    // Sem este recorte, qualquer instrutor apagaria comentário de qualquer
    // curso da plataforma — moderação vira poder solto, não responsabilidade.
    assert.equal(
      can(otherInstructor, "delete", { kind: "comment", authorId: learner.id, courseAuthorId: author.id }),
      false,
    );
  });

  test("aluno não modera o comentário de outro aluno", () => {
    assert.equal(can(otherLearner, "delete", meu), false);
  });

  test("admin modera qualquer comentário", () => {
    assert.equal(can(admin, "delete", alheio), true);
  });
});

describe("Curso arquivado, aposenta sem expulsar", () => {
  const arquivado = (enrolled?: boolean): Resource => ({
    kind: "course",
    authorId: author.id,
    status: "archived",
    ...(enrolled === undefined ? {} : { enrolled }),
  });

  test("quem já cursava continua lendo", () => {
    // Arquivar tira o curso do catálogo; não tira do aluno o que ele já
    // começou. Sem isto, arquivar levava junto a página, as aulas e o
    // certificado de quem já havia concluído.
    assert.equal(can(learner, "read", arquivado(true)), true);
  });

  test("quem não cursava não vê", () => {
    assert.equal(can(learner, "read", arquivado(false)), false);
    assert.equal(can(learner, "read", arquivado()), false);
  });

  test("arquivado não vira porta para escrever", () => {
    // Ler o que já se cursava é uma coisa; comentar ou concluir aula em curso
    // aposentado é outra — a permissão de leitura não pode arrastar as demais.
    assert.equal(can(learner, "update", arquivado(true)), false);
    assert.equal(can(learner, "enroll", arquivado(true)), false);
  });

  test("o autor continua enxergando o próprio curso arquivado", () => {
    assert.equal(can(author, "read", arquivado()), true);
    assert.equal(can(author, "update", arquivado()), true);
  });

  test("instrutor de outro curso não lê arquivado alheio", () => {
    assert.equal(can(otherInstructor, "read", arquivado()), false);
  });
});

describe("Fronteira de tenant, nada atravessa", () => {
  const T1 = "tenant-nerdlms";
  const T2 = "tenant-acme";

  const adminT1: Actor = { id: "u-admin", role: "admin", tenantId: T1 };
  const instrutorT1: Actor = { id: "u-prof", role: "instructor", tenantId: T1 };
  const alunoT1: Actor = { id: "u-aluno", role: "learner", tenantId: T1 };

  const cursoT2: Resource & { tenantId: string } = {
    kind: "course",
    authorId: "u-prof",
    status: "published",
    tenantId: T2,
  };

  test("NEM O ADMIN enxerga o dado de outro cliente", () => {
    // É o teste que dá sentido a todos os outros. "Acesso irrestrito" vale
    // dentro do próprio tenant; a empresa vizinha simplesmente não existe.
    // Se esta checagem viesse DEPOIS do bloco do admin, ele passaria.
    assert.equal(can(adminT1, "read", cursoT2), false);
    assert.equal(can(adminT1, "update", cursoT2), false);
    assert.equal(can(adminT1, "delete", cursoT2), false);
  });

  test("instrutor não lê curso publicado de outro cliente", () => {
    // Curso publicado é legível por qualquer instrutor DENTRO do tenant.
    // Fora dele, o status não importa.
    assert.equal(can(instrutorT1, "read", cursoT2), false);
  });

  test("aluno não lê curso publicado de outro cliente", () => {
    assert.equal(can(alunoT1, "read", cursoT2), false);
  });

  test("dentro do mesmo tenant, as regras de papel continuam valendo", () => {
    const cursoT1: Resource & { tenantId: string } = { ...cursoT2, tenantId: T1 };
    assert.equal(can(adminT1, "read", cursoT1), true);
    assert.equal(can(alunoT1, "read", cursoT1), true);
    // O aluno continua sem poder editar: a fronteira de tenant não afrouxa
    // nem endurece o que vem depois dela.
    assert.equal(can(alunoT1, "update", cursoT1), false);
  });

  test("a fronteira vale para todo tipo de recurso, não só curso", () => {
    assert.equal(
      can(adminT1, "read", { kind: "user", tenantId: T2 }),
      false,
    );
    assert.equal(
      can(adminT1, "read", { kind: "analytics", scope: "platform", tenantId: T2 }),
      false,
    );
    assert.equal(
      can(adminT1, "delete", { kind: "comment", authorId: "x", courseAuthorId: "y", tenantId: T2 }),
      false,
    );
  });

  test("sem tenant declarado, decide o papel, não vira permissão implícita", () => {
    // A transição: chamadas antigas ainda não informam tenant. A ausência não
    // pode virar "pode tudo" nem "não pode nada" — quem decide continua sendo
    // a regra de papel, como antes desta mudança.
    const semTenant: Resource = { kind: "course", authorId: "u-prof", status: "published" };
    assert.equal(can(alunoT1, "read", semTenant), true);
    assert.equal(can(alunoT1, "update", semTenant), false);

    const atorSemTenant: Actor = { id: "u-aluno", role: "learner" };
    assert.equal(can(atorSemTenant, "read", cursoT2), true);
  });
});

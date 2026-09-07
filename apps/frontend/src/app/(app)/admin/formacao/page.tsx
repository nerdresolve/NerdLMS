import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { formacaoPorCargoUseCase } from "@nerdlms/backend/competencies/formation-use-case.ts";
import { findAllTracks } from "@nerdlms/backend/courses/tracks-repository.ts";
import { findAllCourses } from "@nerdlms/backend/courses/courses-repository.ts";
import { oQueFalta } from "@nerdlms/core/competencies/plano-de-formacao.ts";
import { query } from "@nerdlms/backend/db/pool.ts";

import { AppShell } from "@/features/app-shell/app-shell.tsx";
import { Breadcrumb } from "@/components/breadcrumb.tsx";
import { FormationView } from "@/features/admin/formation-view.tsx";
import { actorOf, requireUser, toDisplayUser } from "@/lib/auth/session.ts";

export const metadata: Metadata = { title: "Formação por cargo · Admin" };

/* Um plano criado agora precisa aparecer ao voltar para a tela. */
export const dynamic = "force-dynamic";

/**
 * Formação por cargo.
 *
 * Só administrador: o plano define o que um cargo inteiro precisa cumprir, e
 * isso é decisão de programa de treinamento. O caso de uso confere de novo.
 */
export default async function FormationPage() {
  const user = await requireUser();
  if (user.role !== "admin") notFound();

  const [planos, trilhas, cursos, competencias, cargos] = await Promise.all([
    formacaoPorCargoUseCase(actorOf(user)),
    findAllTracks(user.tenant.id),
    findAllCourses(user.tenant.id),
    query<{ id: string; name: string }>(
      `SELECT id, name FROM competencies WHERE tenant_id = $1 AND active ORDER BY name`,
      [user.tenant.id],
    ),
    /* Os cargos que EXISTEM no cadastro, para o campo do plano oferecer a
       grafia certa: digitado à mão, "Analista PLENO" e "Analista Pleno" seriam
       dois cargos e o plano alcançaria metade das pessoas. */
    query<{ job_title: string }>(
      `SELECT DISTINCT job_title
         FROM users
        WHERE tenant_id = $1 AND status = 'active' AND btrim(coalesce(job_title, '')) <> ''
        ORDER BY job_title`,
      [user.tenant.id],
    ),
  ]);

  return (
    <AppShell
      topbar={<Breadcrumb items={[{ label: "Administração", href: "/admin" }, { label: "Formação" }]} />}
      fullName={toDisplayUser(user).fullName}
      role={user.role}
      currentPath="/admin/formacao"
    >
      <FormationView
        planos={planos.map((item) => ({
          id: item.plano.id,
          nome: item.plano.nome,
          descricao: item.plano.descricao,
          jobTitle: item.plano.jobTitle,
          cadeia: item.cadeia,
          continuaId: item.plano.continuaId,
          /* As exigências EFETIVAS, já com a herança resolvida: é contra elas
             que o percentual de cada pessoa foi medido. */
          exigencias: item.exigencias.map((e) => ({
            id: e.id,
            alvoId: e.alvoId,
            tipo: e.tipo,
            nome: e.nome,
            ...(e.nivelExigido !== undefined ? { nivelExigido: e.nivelExigido } : {}),
            ...(e.herdadaDe !== undefined ? { herdadaDe: e.herdadaDe } : {}),
          })),
          pessoas: item.pessoas.map((pessoa) => ({
            id: pessoa.id,
            nome: pessoa.nome,
            percentual: pessoa.formacao.percentual,
            completa: pessoa.formacao.completa,
            falta: oQueFalta(pessoa.formacao).map((f) => f.nome),
          })),
          formadas: item.resumo.formadas,
          percentualMedio: item.resumo.percentualMedio,
        }))}
        trilhas={trilhas.map((t) => ({ id: t.id, nome: t.title }))}
        cursos={cursos.map((c) => ({ id: c.id, nome: c.title }))}
        competencias={competencias.map((c) => ({ id: c.id, nome: c.name }))}
        cargos={cargos.map((c) => c.job_title)}
      />
    </AppShell>
  );
}

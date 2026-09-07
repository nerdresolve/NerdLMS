import { Users } from "lucide-react";

import { InviteForm, StatusToggle } from "./user-actions.tsx";
import type { Role } from "@nerdlms/core/auth/permissions.ts";
import type { UsersPageData } from "./data.ts";

import "@/features/studio/studio.css";

const ROLE_LABEL: Record<Role, string> = {
  learner: "Aluno",
  manager: "Gestor",
  instructor: "Instrutor",
  admin: "Administrador",
};

const STATUS_LABEL = {
  active: "Ativo",
  pending: "Pendente",
  inactive: "Inativo",
} as const;

/**
 * Gestão de usuários.
 *
 * Hoje é leitura. Convite, edição e desativação entram junto com a API de
 * usuários — e enquanto não entram, esta tela não oferece botão que não
 * funcione.
 */
/* `unitLabel` por PROP, não por hook: este é Server Component, e o contexto do
   tenant vive no cliente. Quem renderiza já tem a sessão em mãos. */
export function UsersView({ users, unitLabel }: Omit<UsersPageData, "admin"> & { unitLabel: string }) {
  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head__text">
          <h1 className="page-head__title">Usuários</h1>
          <p className="page-head__sub">
            Todas as pessoas com acesso à plataforma. Convidar cria a conta pendente; a senha é
            definida por quem recebe.
          </p>
        </div>
      </div>

      <section className="course-section" aria-labelledby="convidar">
        <h2 className="course-section__title" id="convidar">
          Convidar pessoa
        </h2>
        <InviteForm />
      </section>

      <section className="course-section" aria-labelledby="lista">
        <h2 className="course-section__title" id="lista">
          {users.length} {users.length === 1 ? "pessoa" : "pessoas"}
        </h2>

        {users.length > 0 ? (
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">Usuários cadastrados na plataforma</caption>
              <thead>
                <tr>
                  <th scope="col">Nome</th>
                  <th scope="col">Papel</th>
                  <th scope="col">{unitLabel}</th>
                  <th scope="col">Situação</th>
                  <th scope="col">Matrículas</th>
                  <th scope="col">Acesso</th>
                </tr>
              </thead>
              <tbody>
                {users.map(({ user, enrollments }) => (
                  <tr key={user.id}>
                    <td data-label="Nome">{user.fullName}</td>
                    <td data-label="Papel">{ROLE_LABEL[user.role]}</td>
                    <td data-label={unitLabel}>{user.project ?? "-"}</td>
                    <td data-label="Situação">
                      <span
                        className={`badge${user.status === "active" ? " badge--success" : user.status === "inactive" ? " badge--inactive" : " badge--pending"}`}
                      >
                        {STATUS_LABEL[user.status ?? "pending"]}
                      </span>
                    </td>
                    <td data-label="Matrículas" data-num>{enrollments}</td>
                    <td data-label="Acesso">
                      <StatusToggle userId={user.id} status={user.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            <span className="empty__rule" aria-hidden="true" />
            <div className="empty__inner">
              <span className="empty__icon">
                <Users aria-hidden />
              </span>
              <h3 className="empty__title">Nenhum usuário cadastrado</h3>
              <p className="empty__text">Quando alguém receber acesso, aparece aqui.</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

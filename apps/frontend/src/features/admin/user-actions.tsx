"use client";

import { useRouter } from "next/navigation";

import { useUnitLabel } from "@/features/tenant/tenant-context.tsx";
import { useState } from "react";
import { Info, Power, UserPlus } from "lucide-react";

import type { Role } from "@nerdlms/core/auth/permissions.ts";
import { campoObrigatorio } from "@/lib/campo-obrigatorio.ts";

const ROLE_OPTIONS: Array<{ value: Role; label: string }> = [
  { value: "learner", label: "Aluno" },
  { value: "instructor", label: "Instrutor" },
  { value: "manager", label: "Gestor" },
  { value: "admin", label: "Administrador" },
];

/**
 * Formulário de convite.
 *
 * Não pede senha: o convite cria a conta pendente e a pessoa escolhe a própria
 * senha no primeiro acesso. Um administrador que digita a senha de outro passa
 * a saber a senha de outro.
 */
export function InviteForm() {
  const unitLabel = useUnitLabel();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [role, setRole] = useState<Role>("learner");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const value = (name: string) =>
      (form.elements.namedItem(name) as HTMLInputElement | null)?.value ?? "";

    setBusy(true);
    setNotice(null);

    try {
      const response = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName: value("fullName"),
          email: value("email"),
          role,
          project: value("project"),
        }),
      });

      if (response.ok) {
        form.reset();
        setRole("learner");
        setNotice("Convite criado. A pessoa define a senha no primeiro acesso.");
        router.refresh();
        return;
      }

      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setNotice(body.error ?? "Não foi possível convidar.");
    } catch {
      setNotice("Não foi possível falar com o servidor. Verifique sua conexão.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="invite-form" onSubmit={handleSubmit}>
      <div className="field">
        <label className="field__label" htmlFor="convite-nome">
          Nome
        </label>
        <input className="input" id="convite-nome" name="fullName" type="text" {...campoObrigatorio("Escreva o nome de quem vai receber o convite.")} />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="convite-email">
          E-mail
        </label>
        <input className="input" id="convite-email" name="email" type="email" {...campoObrigatorio("Informe o e-mail para onde o convite vai.")} />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="convite-papel">
          Papel
        </label>
        <select
          className="input"
          id="convite-papel"
          value={role}
          onChange={(event) => setRole(event.target.value as Role)}
        >
          {ROLE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="convite-projeto">
          {unitLabel} {role === "manager" ? "(obrigatório para gestor)" : "(opcional)"}
        </label>
        <input className="input" id="convite-projeto" name="project" type="text" />
      </div>

      <button type="submit" className="btn btn--primary" disabled={busy}>
        <UserPlus aria-hidden /> {busy ? "Convidando…" : "Convidar"}
      </button>

      <div className="notice" data-visible={notice ? "true" : "false"} role="status">
        {notice ? (
          <>
            <Info aria-hidden="true" />
            <span>{notice}</span>
          </>
        ) : null}
      </div>
    </form>
  );
}

/**
 * Ativa ou desativa uma conta.
 *
 * Desativar não apaga: progresso, matrícula e comentário continuam, e a pessoa
 * só perde o acesso. As sessões abertas caem junto — desativar alguém que
 * continua navegando não desativou ninguém.
 */
export function StatusToggle({ userId, status }: { userId: string; status: "active" | "pending" | "inactive" | undefined }) {
  /* Três situações, não duas. Convite ainda não aceito é `pending`, e chamar
     isso de "Reativar" diz que a conta foi desativada, o que não aconteceu.
     Só quem já esteve ativo e saiu volta com "Reativar". */
  const active = status === "active";
  const rotulo = active ? "Desativar" : status === "pending" ? "Cancelar convite" : "Reativar";
  const descricao = active
    ? "Desativar acesso"
    : status === "pending"
      ? "Cancelar convite pendente"
      : "Reativar acesso";
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      const response = await fetch("/api/usuarios", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId, active: !active }),
      });
      if (response.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className="btn btn--secondary btn--small"
      onClick={handleClick}
      disabled={busy}
      aria-label={descricao}
    >
      <Power aria-hidden /> {rotulo}
    </button>
  );
}

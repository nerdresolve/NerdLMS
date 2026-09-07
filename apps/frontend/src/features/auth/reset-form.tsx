"use client";

import { useState } from "react";
import { AlertCircle, Check, Eye, EyeOff, Info } from "lucide-react";

import { PASSWORD_MIN_LENGTH } from "@nerdlms/core/validation/login.ts";

/**
 * Pedido de link de redefinição.
 *
 * A resposta é sempre a mesma, exista o e-mail ou não — dizer "não
 * encontramos" transformaria o formulário num verificador de contas.
 */
export function RequestResetForm() {
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement | null)?.value ?? "";

    setSending(true);
    setNotice(null);

    try {
      const response = await fetch("/api/auth/recuperar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const body = (await response.json().catch(() => ({}))) as { message?: string };
      setNotice(body.message ?? "Pedido registrado.");
      form.reset();
    } catch {
      setNotice("Não foi possível falar com o servidor. Verifique sua conexão.");
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="field">
        <label className="field__label" htmlFor="recuperar-email">
          E-mail
        </label>
        <input
          className="input"
          id="recuperar-email"
          name="email"
          type="email"
          placeholder="seu@email.com"
          required
        />
      </div>

      <button type="submit" className="btn btn--primary btn--block" disabled={sending}>
        {sending ? "Enviando…" : "Enviar link de redefinição"}
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
 * Define a senha nova a partir do token do link.
 *
 * A confirmação existe porque a senha é digitada às cegas: sem ela, um erro de
 * digitação vira uma conta inacessível, e o único caminho de volta é pedir
 * outro link.
 */
export function ConfirmResetForm({ token }: { token: string }) {
  const [showPassword, setShowPassword] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const value = (name: string) =>
      (form.elements.namedItem(name) as HTMLInputElement | null)?.value ?? "";

    const password = value("password");
    if (password !== value("confirm")) {
      setNotice("As duas senhas não são iguais.");
      return;
    }

    setSending(true);
    setNotice(null);

    try {
      const response = await fetch("/api/auth/recuperar", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      if (response.ok) {
        setDone(true);
        return;
      }

      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setNotice(body.error ?? "Não foi possível redefinir a senha.");
    } catch {
      setNotice("Não foi possível falar com o servidor. Verifique sua conexão.");
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div className="notice" data-visible="true" role="status">
        <Check aria-hidden="true" />
        <span>
          Senha redefinida. <a href="/login">Entrar agora</a>
        </span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="field">
        <label className="field__label" htmlFor="nova-senha">
          Nova senha
        </label>
        <div className="field__control">
          <input
            className="input input--with-affix"
            id="nova-senha"
            name="password"
            type={showPassword ? "text" : "password"}
            minLength={PASSWORD_MIN_LENGTH}
            required
          />
          <button
            type="button"
            className="affix"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
          >
            {showPassword ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          </button>
        </div>
        <p className="status-text">Ao menos {PASSWORD_MIN_LENGTH} caracteres.</p>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="confirmar-senha">
          Repita a senha
        </label>
        <input
          className="input"
          id="confirmar-senha"
          name="confirm"
          type={showPassword ? "text" : "password"}
          required
        />
      </div>

      <button type="submit" className="btn btn--primary btn--block" disabled={sending}>
        {sending ? "Salvando…" : "Redefinir senha"}
      </button>

      <div className="notice" data-visible={notice ? "true" : "false"} role="status">
        {notice ? (
          <>
            <AlertCircle aria-hidden="true" />
            <span>{notice}</span>
          </>
        ) : null}
      </div>
    </form>
  );
}

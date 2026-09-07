"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, Check, Eye, EyeOff, Info } from "lucide-react";

import { validateLoginInput, type LoginField } from "@nerdlms/core/validation/login.ts";

type FieldErrors = Partial<Record<LoginField, string>>;

export function LoginForm() {
  const identifierId = useId();
  const passwordId = useId();
  const rememberId = useId();

  const identifierRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const rememberRef = useRef<HTMLInputElement>(null);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  /** Reexecuta a regra compartilhada; o backend repetirá a mesma validação. */
  function validate(): FieldErrors {
    const result = validateLoginInput({
      identifier: identifierRef.current?.value ?? "",
      password: passwordRef.current?.value ?? "",
    });
    return result.ok ? {} : result.errors;
  }

  function handleBlur(field: LoginField) {
    const next = validate();
    setErrors((current) => ({ ...current, [field]: next[field] }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);

    const found = validate();
    setErrors(found);

    if (found.identifier) {
      identifierRef.current?.focus();
      return;
    }
    if (found.password) {
      passwordRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          identifier: identifierRef.current?.value ?? "",
          password: passwordRef.current?.value ?? "",
          remember: rememberRef.current?.checked === true,
        }),
      });

      if (response.ok) {
        /* `location.assign` em vez do router: a sessão nasceu num cookie que o
           servidor acabou de emitir, e uma navegação completa garante que todo
           componente já renderize com ela. */
        window.location.assign("/dashboard");
        return;
      }

      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setNotice(body.error ?? "Não foi possível entrar. Tente de novo.");
      passwordRef.current?.focus();
    } catch {
      /* Falha de rede: a mensagem diz o que aconteceu sem culpar a credencial,
         que pode estar correta. */
      setNotice("Não foi possível falar com o servidor. Verifique sua conexão e tente de novo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label className="field__label" htmlFor={identifierId}>
            Email ou usuário
          </label>
          <div className="field__control">
            <input
              ref={identifierRef}
              className="input"
              id={identifierId}
              name="identifier"
              type="text"
              inputMode="email"
              autoComplete="username"
              placeholder="seu@email.com"
              aria-invalid={errors.identifier ? true : undefined}
              aria-describedby={`${identifierId}-error`}
              onBlur={() => handleBlur("identifier")}
            />
          </div>
          <p className="error" id={`${identifierId}-error`} role="alert">
            {errors.identifier ? (
              <>
                <AlertCircle aria-hidden="true" />
                <span>{errors.identifier}</span>
              </>
            ) : null}
          </p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor={passwordId}>
            Senha
          </label>
          <div className="field__control">
            <input
              ref={passwordRef}
              className="input input--with-affix"
              id={passwordId}
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={`${passwordId}-error`}
              onBlur={() => handleBlur("password")}
            />
            <button
              type="button"
              className="affix"
              aria-pressed={showPassword}
              aria-controls={passwordId}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              onClick={() => {
                setShowPassword((value) => !value);
                passwordRef.current?.focus();
              }}
            >
              {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </button>
          </div>
          <p className="error" id={`${passwordId}-error`} role="alert">
            {errors.password ? (
              <>
                <AlertCircle aria-hidden="true" />
                <span>{errors.password}</span>
              </>
            ) : null}
          </p>
        </div>

        <div className="row-between">
          <label className="checkbox" htmlFor={rememberId}>
            <input ref={rememberRef} type="checkbox" id={rememberId} name="remember" />
            <span className="checkbox__box" aria-hidden="true">
              <Check />
            </span>
            <span>Lembrar de mim</span>
          </label>
          <Link className="link" href="/redefinir-senha">
            Esqueceu sua senha?
          </Link>
        </div>

        <button className="btn btn--primary btn--block" type="submit" disabled={submitting}>
          {submitting ? (
            <>
              <span className="btn__spinner" aria-hidden="true" />
              <span>Entrando…</span>
            </>
          ) : (
            "Entrar"
          )}
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
    </>
  );
}

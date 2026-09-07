"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, Check, Eye, EyeOff, Info } from "lucide-react";

import { validateLoginInput, type LoginField } from "@nerdlms/core/validation/login.ts";
import { HOME } from "@nerdlms/core/auth/home.ts";

type FieldErrors = Partial<Record<LoginField, string>>;

export interface LoginFormProps {
  /**
   * O nome do diretório da empresa, quando há um ligado.
   *
   * Muda só o TEXTO. O caminho da autenticação é decidido no servidor, por
   * `signInUseCase` — passar essa decisão por aqui a deixaria ao alcance de
   * quem edita JavaScript no navegador.
   */
  diretorio?: string | null;
  /** A senha guardada aqui ainda vale para este cliente. */
  senhaLocal?: boolean;
}

export function LoginForm({ diretorio = null, senhaLocal = true }: LoginFormProps = {}) {
  /* Só rede: os campos são os do computador da empresa, e a redefinição de
     senha daqui não existe para essa pessoa. */
  const soRede = diretorio !== null && !senhaLocal;
  const identifierId = useId();
  const passwordId = useId();
  const rememberId = useId();

  const identifierRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const rememberRef = useRef<HTMLInputElement>(null);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  /* O BOTÃO SÓ VALE DEPOIS QUE O JAVASCRIPT ASSUMIU O FORMULÁRIO.

     Entre o HTML chegar e o React hidratar existe uma janela em que o clique é
     tratado pelo navegador, e não por `handleSubmit`. Nessa janela o envio é
     nativo: com `method="post"`, o servidor devolve a mesma tela de login e a
     pessoa fica sem resposta nenhuma — clicou, a página piscou, nada mudou.

     `useEffect` só roda depois da hidratação, então `pronto` é exatamente o
     sinal de que o clique será tratado por nós. O botão nasce desabilitado no
     HTML e habilita quando o comportamento existe.

     Não é hipótese: apertar o botão logo depois de preencher, com a máquina
     ocupada, reproduz a janela toda vez. */
  const [pronto, setPronto] = useState(false);
  useEffect(() => setPronto(true), []);
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
        /* Um destino só, para todo papel: `/dashboard` monta o painel de quem
           chegou. O papel não entra no endereço — quem trocasse de função
           ficaria com um atalho que não serve mais. */

        /* `location.assign` em vez do router: a sessão nasceu num cookie que o
           servidor acabou de emitir, e uma navegação completa garante que todo
           componente já renderize com ela. */
        window.location.assign(HOME);
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
      {/* `method="post"` num formulário que o JavaScript envia.

         Sem `method`, o padrão do HTML é GET. Enquanto a página ainda não
         hidratou — primeira visita, rede lenta, script bloqueado —, apertar
         Enter faz o navegador enviar de verdade, e um GET põe todos os
         campos na barra de endereço:

           /login?identifier=fulano%40exemplo.com&password=...

         A senha entra no histórico do navegador, no log de acesso do
         servidor, em qualquer proxy no caminho e no cabeçalho `Referer` das
         requisições seguintes. Com POST, os campos vão no corpo.

         Não é hipótese: aconteceu aqui, sob carga, com a URL acima. */}
      <form onSubmit={handleSubmit} method="post" noValidate>
        <div className="field">
          <label className="field__label" htmlFor={identifierId}>
            {soRede ? "Usuário da rede" : "Email ou usuário"}
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
              placeholder={soRede ? "seu.usuario" : "seu@email.com"}
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
            {soRede ? "Senha da rede" : "Senha"}
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
          {/* Com a senha vindo da rede, `/redefinir-senha` mandaria um e-mail
              para trocar uma senha que não é a usada para entrar — a pessoa
              seguiria o link, trocaria alguma coisa e continuaria sem
              conseguir. Quem redefine é o suporte de TI. */}
          {soRede ? (
            <Link className="link" href="/suporte">
              Esqueceu sua senha?
            </Link>
          ) : (
            <Link className="link" href="/redefinir-senha">
              Esqueceu sua senha?
            </Link>
          )}
        </div>

        <button className="btn btn--primary btn--block" type="submit" disabled={submitting || !pronto}>
          {submitting ? (
            <>
              <span className="btn__spinner" aria-hidden="true" />
              <span>Entrando…</span>
            </>
          ) : (
            "Entrar"
          )}
        </button>

        {soRede ? (
          <p className="foot">
            Use o mesmo usuário e senha do computador da empresa.
          </p>
        ) : null}

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

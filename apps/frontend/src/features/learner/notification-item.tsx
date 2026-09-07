"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Award, Bell, Megaphone } from "lucide-react";

import type { Notification } from "@nerdlms/core/courses/calendar.ts";

/* O ícone é escolhido aqui, não recebido por prop: um componente é uma
   função, e função não atravessa a fronteira servidor→cliente — o React não
   consegue serializá-la. Passar `Icon` de fora derrubava a página inteira. */
const ICON = {
  announcement: Megaphone,
  reminder: Bell,
  achievement: Award,
} as const;

/**
 * Um aviso da lista.
 *
 * É um botão, e não um `<article>` estático, porque marcar como lido é a única
 * ação que existe aqui — e antes o contador de não lidos nunca mudava, o que
 * fazia o selo "2 não lidos" parecer enfeite.
 *
 * Quem já leu continua vendo o aviso: o clique não some com nada, só tira o
 * destaque. Esconder o que foi lido faria a lista encolher sob o cursor.
 */
export function NotificationItem({
  item,
  formattedDate,
}: {
  item: Notification;
  formattedDate: string;
}) {
  const Icon = ICON[item.kind];
  const router = useRouter();
  const [lido, setLido] = useState(item.read);

  async function handleClick() {
    if (lido) return;

    setLido(true);
    try {
      const response = await fetch("/api/avisos", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notificationId: item.id }),
      });

      if (!response.ok) {
        setLido(false);
        return;
      }
      /* O contador do cabeçalho é renderizado no servidor. */
      router.refresh();
    } catch {
      setLido(false);
    }
  }

  return (
    <article className="notification" data-read={lido}>
      <span className="notification__icon" aria-hidden="true">
        <Icon />
      </span>
      <span className="notification__body">
        <span className="notification__title">{item.title}</span>
        <span className="notification__text">{item.body}</span>
        <span className="notification__time">{formattedDate}</span>
      </span>
      {lido ? null : (
        <button type="button" className="notification__read" onClick={handleClick}>
          Marcar como lido
        </button>
      )}
    </article>
  );
}

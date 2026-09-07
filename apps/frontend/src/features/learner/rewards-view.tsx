import { Award, Coins, Gift, Lock } from "lucide-react";

import { ProgressBar } from "@/features/dashboard/dashboard-view.tsx";
import type { RewardsPageData } from "./data.ts";

import "@/features/rewards/rewards.css";

/**
 * Conquistas: moedas, nível, medalhas e recompensas.
 *
 * Medalha ainda não conquistada **aparece**, apagada. É ela que diz o que
 * fazer em seguida — esconder deixaria a tela bonita e inútil.
 */
export function RewardsView({
  earnings,
  level,
  balance,
  badges,
  rewards,
  affordable,
}: Omit<RewardsPageData, "student">) {
  const affordableIds = new Set(affordable.map((reward) => reward.id));

  return (
    <div className="rewards">
      <div className="page-head">
        <h1 className="page-head__title">Conquistas</h1>
        <p className="page-head__sub">
          Cada aula concluída vira moeda. Cada curso terminado, um marco.
        </p>
      </div>

      <section className="level-card" aria-labelledby="nivel">
        <div className="level-card__body">
          <h2 className="level-card__title" id="nivel">
            Nível {level.level}
          </h2>

          <span className="coins">
            <span className="coins__icon" aria-hidden="true">
              <Coins />
            </span>
            <span className="coins__value">{balance}</span>
            <span className="coins__label">moedas disponíveis</span>
          </span>

          <div className="level-card__bar">
            <ProgressBar percent={level.percent} onBrand />
          </div>

          <p className="level-card__hint">
            {level.next === null
              ? "Nível máximo alcançado."
              : `Faltam ${level.next - earnings.coins} moedas para o nível ${level.level + 1}.`}
          </p>
        </div>
      </section>

      <section className="course-section" aria-labelledby="medalhas">
        <h2 className="course-section__title" id="medalhas">
          Medalhas
        </h2>
        <div className="badges">
          {badges.map((badge) => (
            <article className="badge-card" data-earned={badge.earned} key={badge.id}>
              <span className="badge-card__icon" aria-hidden="true">
                <Award />
              </span>
              <p className="badge-card__title">{badge.title}</p>
              <p className="badge-card__text">{badge.description}</p>
              <span className="badge-card__state">{badge.earned ? "Conquistada" : "Ainda não"}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="course-section" aria-labelledby="recompensas">
        <h2 className="course-section__title" id="recompensas">
          Recompensas
        </h2>
        <p className="status-text">
          {affordable.length > 0
            ? `Você já pode resgatar ${affordable.length} ${affordable.length === 1 ? "item" : "itens"}.`
            : "Nenhum item ao seu alcance com o saldo atual."}
        </p>

        <div className="rewards-grid">
          {rewards.map((reward) => {
            const canAfford = affordableIds.has(reward.id);
            return (
              <article className="reward" data-affordable={canAfford} key={reward.id}>
                <span className="reward__body">
                  <span className="reward__title">{reward.title}</span>
                  <span className="reward__text">{reward.description}</span>
                </span>
                <span className="reward__cost">
                  {canAfford ? <Gift aria-hidden /> : <Lock aria-hidden />} {reward.cost}
                </span>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

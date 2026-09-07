import { Fragment } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface Crumb {
  label: string;
  href?: string;
}

/**
 * Trilha de navegação. Vive na topbar (slot `topbar` do AppShell), como no kit
 * oficial. O último item é a página atual e não é link.
 */
export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav className="breadcrumb" aria-label="Trilha de navegação">
      {items.map((item, index) => {
        const last = index === items.length - 1;
        return (
          <Fragment key={item.label}>
            {index > 0 ? <ChevronRight className="breadcrumb__sep" aria-hidden /> : null}
            {last || !item.href ? (
              <span className="breadcrumb__current" aria-current="page">
                {item.label}
              </span>
            ) : (
              <Link href={item.href}>{item.label}</Link>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}

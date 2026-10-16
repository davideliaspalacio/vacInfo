"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House } from "lucide-react";
import clsx from "clsx";

/**
 * Logo de la cabecera. Es el enlace al inicio, así que lleva ícono de casa,
 * `title`/`aria-label` «Ir al inicio», hover visible y marca de página activa
 * cuando ya se está en `/`.
 */
export function LogoInicio({ organizacion }: { organizacion: string }) {
  const enInicio = usePathname() === "/";

  return (
    <Link
      href="/"
      title="Ir al inicio"
      aria-label="Ir al inicio"
      aria-current={enInicio ? "page" : undefined}
      className={clsx(
        "group flex items-center gap-3 rounded-xl px-2 py-1 transition hover:bg-bosque/10",
        enInicio && "bg-bosque/10 ring-1 ring-bosque/25",
      )}
    >
      <span
        aria-hidden
        className="h-10 w-10 shrink-0 rounded-[50%_42%_55%_45%] border-2 border-tinta bg-white shadow-[0_4px_0_rgba(23,63,42,0.18)]"
        style={{
          background:
            "radial-gradient(circle at 68% 25%, #111 0 13%, transparent 14%), radial-gradient(circle at 28% 68%, #111 0 19%, transparent 20%), #fff",
        }}
      />
      <span>
        <strong className="font-display flex items-center gap-1.5 text-xl leading-none text-bosque">
          <span className="group-hover:underline">VacInfo</span>
          <House className={clsx("h-4 w-4 shrink-0", enInicio ? "text-bosque" : "text-tinta-suave group-hover:text-bosque")} aria-hidden />
          {enInicio && <span className="rounded-full bg-lima px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-bosque">Inicio</span>}
        </strong>
        <span className="text-xs text-tinta-suave">{organizacion}</span>
      </span>
    </Link>
  );
}

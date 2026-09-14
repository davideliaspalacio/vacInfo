import { Suspense } from "react";
import Link from "next/link";
import clsx from "clsx";
import { IndicadorPestana } from "@/components/fincas/indicador-pestana";

type Cuenta = number | null | undefined;
type Opcion = { valor: string; texto: string; href: string; cuenta?: Cuenta | Promise<Cuenta> };

/** Pestañas de la ficha de finca; con `fincaId` se agregan al final los enlaces a Levante y Potreros. */
export function Pestanas({ opciones, activa, fincaId }: { opciones: Opcion[]; activa: string; fincaId?: string }) {
  const todas: Opcion[] = fincaId
    ? [
        ...opciones,
        { valor: "levante", texto: "Levante", href: `/fincas/${fincaId}/levante` },
        { valor: "potreros", texto: "Potreros", href: `/fincas/${fincaId}/potreros` },
      ]
    : opciones;

  return (
    <nav aria-label="Secciones de la finca" className="flex flex-wrap gap-2">
      {todas.map((o) => {
        const esActiva = o.valor === activa;
        const insignia = clsx("min-w-6 rounded-full px-2 text-center text-xs", esActiva ? "bg-bosque text-leche" : "bg-white/15");
        return (
          <Link
            key={o.valor}
            href={o.href}
            scroll={false}
            aria-current={esActiva ? "page" : undefined}
            className={clsx(
              "relative inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition",
              esActiva ? "border-lima bg-lima text-bosque" : "border-white/30 bg-[rgba(8,26,16,0.42)] text-leche hover:bg-[rgba(8,26,16,0.7)]",
            )}
          >
            {o.texto}
            {o.cuenta !== undefined && (
              <Suspense fallback={<span className={clsx(insignia, "animate-pulse")}>·</span>}>
                <Insignia valor={o.cuenta} className={insignia} />
              </Suspense>
            )}
            <IndicadorPestana />
          </Link>
        );
      })}
    </nav>
  );
}

async function Insignia({ valor, className }: { valor: Cuenta | Promise<Cuenta>; className: string }) {
  const n = await valor;
  return n == null ? null : <span className={className}>{n}</span>;
}

import Link from "next/link";
import clsx from "clsx";

type Opcion = { valor: string; texto: string; href: string; cuenta?: number };

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
      {todas.map((o) => (
        <Link
          key={o.valor}
          href={o.href}
          scroll={false}
          aria-current={o.valor === activa ? "page" : undefined}
          className={clsx(
            "inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition",
            o.valor === activa ? "border-lima bg-lima text-bosque" : "border-white/30 bg-[rgba(8,26,16,0.42)] text-leche hover:bg-[rgba(8,26,16,0.7)]",
          )}
        >
          {o.texto}
          {o.cuenta != null && (
            <span className={clsx("rounded-full px-2 text-xs", o.valor === activa ? "bg-bosque text-leche" : "bg-white/15")}>{o.cuenta}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}

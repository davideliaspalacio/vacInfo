import { Sprout } from "lucide-react";
import { hoyISO } from "@/lib/formato";
import { diasHasta, fechaLarga } from "@/components/registro/cuentas";

const NOMBRE_PLAN: Record<string, string> = { prueba: "Prueba gratis" };

export function CajaPlan({ plan, pruebaHasta }: { plan: string; pruebaHasta: string | null }) {
  const nombre = NOMBRE_PLAN[plan] ?? plan.charAt(0).toUpperCase() + plan.slice(1);
  const dias = pruebaHasta ? diasHasta(pruebaHasta, hoyISO()) : null;
  const enPrueba = plan === "prueba";

  return (
    <div className="rounded-2xl border border-[#cadba8] bg-lima-suave p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-lima text-bosque">
          <Sprout className="h-6 w-6" aria-hidden />
        </span>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-pasto-oscuro">Tu plan</p>
          <p className="font-display text-xl font-bold text-bosque">{nombre}</p>
        </div>
      </div>
      {enPrueba && pruebaHasta && dias !== null && (
        <div className="mt-3 text-sm">
          {dias >= 0 ? (
            <>
              <p className="font-bold text-bosque">Prueba gratis hasta el {fechaLarga(pruebaHasta)}</p>
              <p className="text-tinta-suave">
                {dias === 0 ? "Termina hoy." : `Quedan ${dias} ${dias === 1 ? "día" : "días"}.`} No se hace ningún cobro.
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/10" aria-hidden>
                <div className="h-full rounded-full bg-pasto" style={{ width: `${Math.min(100, Math.max(4, (dias / 30) * 100))}%` }} />
              </div>
            </>
          ) : (
            <p className="font-bold text-alerta">La prueba gratis terminó el {fechaLarga(pruebaHasta)}.</p>
          )}
        </div>
      )}
    </div>
  );
}

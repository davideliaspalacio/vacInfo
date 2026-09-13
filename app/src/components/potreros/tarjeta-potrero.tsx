import clsx from "clsx";
import { fecha, num } from "@/lib/formato";
import { ESTADOS_POTRERO, type EstadoPotrero } from "./rotacion";

const COLORES: Record<string, string> = {
  ocupado: "border-blue-300 bg-blue-50",
  bloqueado: "border-alerta/40 bg-[#fbe9e5]",
  listo: "border-pasto bg-lima-suave",
  descansando: "border-dorado bg-[#fdf3d6]",
  sin_datos: "border-black/10 bg-black/[0.03]",
};

const TEXTO: Record<string, string> = {
  ocupado: "text-campo-oscuro",
  bloqueado: "text-alerta",
  listo: "text-pasto-oscuro",
  descansando: "text-[#8a6100]",
  sin_datos: "text-tinta-suave",
};

const APLICACIONES: Record<string, string> = {
  fumigacion: "Fumigación",
  fertilizacion: "Fertilización",
  abonada: "Abonada",
  encalada: "Encalada",
  veneno_mosca: "Veneno mosca",
  veneno_roedores: "Veneno roedores",
};

export function TarjetaPotrero({ p, objetivo }: { p: EstadoPotrero; objetivo: number }) {
  const estado = ESTADOS_POTRERO[p.estado] ?? ESTADOS_POTRERO.sin_datos;
  const avance = p.dias_descanso != null ? Math.min(100, Math.round((p.dias_descanso / Math.max(objetivo, 1)) * 100)) : 0;

  return (
    <article className={clsx("flex min-h-40 flex-col justify-between rounded-2xl border-2 p-4", COLORES[p.estado] ?? COLORES.sin_datos)}>
      <div>
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-2xl font-bold text-bosque">{p.numero}</h3>
          <span className={clsx("text-xs font-bold uppercase tracking-wider", TEXTO[p.estado])}>{estado.texto}</span>
        </div>
        {(p.nombre || p.area_cuadras != null) && (
          <p className="text-xs text-tinta-suave">{[p.nombre, p.area_cuadras != null && `${num(p.area_cuadras)} cuadras`].filter(Boolean).join(" · ")}</p>
        )}
      </div>

      <div className="mt-3 space-y-1 text-sm">
        {p.estado === "ocupado" && (
          <>
            <p className="font-bold text-campo-oscuro">{p.grupo}</p>
            <p className="text-tinta-suave">
              {p.animales != null && `${num(p.animales)} animales · `}
              {p.dias_ocupado === 0 ? "entró hoy" : `${p.dias_ocupado} ${p.dias_ocupado === 1 ? "día" : "días"}`}
            </p>
          </>
        )}
        {p.estado === "bloqueado" && (
          <>
            <p className="font-bold text-alerta">No pastorear hasta {fecha(p.retiro_hasta).slice(0, 5)}</p>
            {p.aplicacion_producto && <p className="text-tinta-suave">{p.aplicacion_producto}</p>}
          </>
        )}
        {(p.estado === "descansando" || p.estado === "listo") && p.dias_descanso != null && (
          <>
            <p className={clsx("font-bold", TEXTO[p.estado])}>
              {p.dias_descanso}/{objetivo} días de descanso
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-white/80" aria-hidden>
              <div className={clsx("h-full rounded-full", p.estado === "listo" ? "bg-pasto" : "bg-dorado")} style={{ width: `${avance}%` }} />
            </div>
          </>
        )}
        {p.estado === "sin_datos" && <p className="text-tinta-suave">Sin rotaciones registradas</p>}
        {p.ultima_aplicacion && p.estado !== "bloqueado" && (
          <p className="text-xs text-tinta-suave">
            {APLICACIONES[p.aplicacion_tipo] ?? p.aplicacion_tipo} {fecha(p.ultima_aplicacion)}
            {p.aplicacion_producto && ` · ${p.aplicacion_producto}`}
          </p>
        )}
      </div>
    </article>
  );
}

export { APLICACIONES };

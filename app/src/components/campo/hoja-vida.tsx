import clsx from "clsx";
import { CalendarDays, CloudOff, Eye, HeartPulse, IdCard, Syringe, TriangleAlert } from "lucide-react";
import { fecha as textoFecha } from "@/lib/formato";
import { ESTADO_SANITARIO, SIN_DESCARGA, TIPO_SANITARIO, armarHojaVida, dias, textoRetiro } from "@/lib/offline/hoja-vida";
import type { DatoHoja, VistaHojaVida } from "@/lib/offline/hoja-vida";
import type { AnimalCatalogo, EventoSanitarioCatalogo } from "@/lib/offline/tipos";

function Dato({ dato }: { dato: DatoHoja }) {
  return (
    <div className="border-b border-slate-100 py-3 last:border-0">
      <dt className="text-sm font-semibold uppercase tracking-wide text-slate-500">{dato.etiqueta}</dt>
      <dd
        className={clsx(
          "text-xl font-bold leading-tight",
          dato.sinDescarga ? "text-base font-semibold text-amber-800" : dato.alerta ? "text-red-700" : "text-slate-900",
        )}
      >
        {dato.valor}
      </dd>
      {dato.detalle && <p className={clsx("mt-0.5 text-base", dato.alerta ? "font-semibold text-red-700" : "text-slate-600")}>{dato.detalle}</p>}
    </div>
  );
}

function Seccion({ icono, titulo, children }: { icono: React.ReactNode; titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="mb-1 flex items-center gap-2 text-lg font-bold text-slate-900">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">{icono}</span>
        {titulo}
      </h3>
      {children}
    </section>
  );
}

function Evento({ evento }: { evento: EventoSanitarioCatalogo }) {
  const detalles = [
    evento.diagnostico,
    evento.cuartos?.length ? `Cuartos: ${evento.cuartos.join(", ")}` : null,
    evento.dias_retiro ? `${dias(evento.dias_retiro)} de retiro de leche` : null,
    evento.proxima_fecha ? `Próxima: ${textoFecha(evento.proxima_fecha, true)}` : null,
  ].filter(Boolean);

  return (
    <li className="border-b border-slate-100 py-3 last:border-0">
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-lg font-bold text-slate-900">{TIPO_SANITARIO[evento.tipo] ?? evento.tipo}</span>
        <span className="text-base font-semibold text-slate-600">{textoFecha(evento.fecha, true)}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">{ESTADO_SANITARIO[evento.estado]}</span>
      </p>
      {evento.producto && <p className="text-base font-semibold text-slate-800">{evento.producto}</p>}
      {detalles.length > 0 && <p className="text-base text-slate-600">{detalles.join(" · ")}</p>}
    </li>
  );
}

function Salud({ vista }: { vista: VistaHojaVida }) {
  return (
    <Seccion icono={<Syringe className="h-5 w-5" aria-hidden />} titulo="Salud">
      {vista.retiro && (
        <p role="alert" className="mb-3 flex items-start gap-3 rounded-2xl border-2 border-red-300 bg-red-50 p-4 text-lg font-bold leading-snug text-red-800">
          <TriangleAlert className="mt-0.5 h-7 w-7 shrink-0" aria-hidden />
          {textoRetiro(vista.retiro)}
        </p>
      )}
      {vista.faltanDatos ? (
        <p className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-4 text-base font-semibold text-amber-900">{SIN_DESCARGA}</p>
      ) : vista.sanidad.length === 0 ? (
        <p className="py-2 text-base text-slate-600">
          Sin enfermedades, tratamientos ni vacunas registradas
          {vista.sanidadDesde ? ` desde el ${textoFecha(vista.sanidadDesde, true)}` : ""}.
        </p>
      ) : (
        <>
          <ul>
            {vista.sanidad.map((e, i) => (
              <Evento key={`${e.fecha}-${e.tipo}-${i}`} evento={e} />
            ))}
          </ul>
          {vista.sanidadDesde && <p className="mt-2 text-sm text-slate-500">Se guardan en el teléfono los registros desde el {textoFecha(vista.sanidadDesde, true)}.</p>}
        </>
      )}
    </Seccion>
  );
}

/**
 * Hoja de vida: pantalla de **solo lectura** del animal dentro de /campo/registrar.
 * No tiene formularios ni botones de guardar; todo sale del catálogo que el teléfono ya descargó.
 */
export function HojaVida({ animal, hoy, sanidadDesde }: { animal: AnimalCatalogo; hoy: string; sanidadDesde?: string | null }) {
  const vista = armarHojaVida(animal, { hoy, sanidadDesde });

  return (
    <div className="space-y-3">
      <p className="flex items-start gap-3 rounded-2xl border border-slate-300 bg-slate-50 p-4 text-base font-semibold text-slate-700">
        <Eye className="mt-0.5 h-6 w-6 shrink-0 text-slate-500" aria-hidden />
        Hoja de vida: aquí solo se mira. No se registra nada.
      </p>

      {vista.faltanDatos && (
        <p role="status" className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-base font-bold text-amber-900">
          <CloudOff className="mt-0.5 h-6 w-6 shrink-0" aria-hidden />
          {SIN_DESCARGA}
        </p>
      )}

      <Seccion icono={<IdCard className="h-5 w-5" aria-hidden />} titulo="Identificación">
        <dl>
          {vista.identificacion.map((d) => (
            <Dato key={d.etiqueta} dato={d} />
          ))}
        </dl>
      </Seccion>

      <Seccion icono={<CalendarDays className="h-5 w-5" aria-hidden />} titulo="Ciclo productivo">
        <dl>
          {vista.ciclo.map((d) => (
            <Dato key={d.etiqueta} dato={d} />
          ))}
        </dl>
      </Seccion>

      <Salud vista={vista} />

      <p className="flex items-start gap-2 px-1 text-sm text-slate-500">
        <HeartPulse className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        Las fechas y los días del ciclo los calcula la finca en el servidor; aquí se muestran tal como se descargaron.
      </p>
    </div>
  );
}

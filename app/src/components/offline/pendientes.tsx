"use client";

import { CircleCheck, Clock, RotateCcw, Trash2, TriangleAlert } from "lucide-react";
import { fechaHora } from "@/lib/offline/resumen";
import type { RegistroCola, RegistroHistorial } from "@/lib/offline/tipos";

/**
 * Lo que quedó sin enviar. Ya no es una pestaña de `/campo/registrar` (el cliente la quitó porque
 * enredaba): estas piezas se muestran desde la barra de estado, que es el único aviso que queda.
 *  · `ErroresPendientes`: lo que falló. Siempre visible, no se puede esconder.
 *  · `Pendientes`: el detalle que se despliega (lo que espera señal y lo ya enviado).
 */

function Acciones({
  registro,
  alReintentar,
  alDescartar,
}: {
  registro: RegistroCola;
  alReintentar: (ids: string[]) => void;
  alDescartar: (registro: RegistroCola) => void;
}) {
  return (
    <div className="mt-2 flex gap-2">
      {registro.estado === "error" && (
        <button
          type="button"
          onClick={() => alReintentar([registro.cliente_id])}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700"
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
          Reintentar
        </button>
      )}
      <button
        type="button"
        onClick={() => alDescartar(registro)}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-red-700"
      >
        <Trash2 className="h-4 w-4" aria-hidden />
        Descartar
      </button>
    </div>
  );
}

/** Registros que el servidor rechazó: se ven siempre, con el motivo y qué hacer. */
export function ErroresPendientes({
  cola,
  alReintentar,
  alDescartar,
}: {
  cola: RegistroCola[];
  alReintentar: (ids: string[]) => void;
  alDescartar: (registro: RegistroCola) => void;
}) {
  const conError = cola.filter((r) => r.estado === "error");
  if (conError.length === 0) return null;

  return (
    <section aria-label="Registros con error" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 font-bold text-red-800">
          <TriangleAlert className="h-5 w-5 shrink-0" aria-hidden />
          {conError.length === 1 ? "1 registro no se pudo enviar" : `${conError.length} registros no se pudieron enviar`}
        </h2>
        {conError.length > 1 && (
          <button
            type="button"
            onClick={() => alReintentar(conError.map((r) => r.cliente_id))}
            className="min-h-11 shrink-0 rounded-xl px-2 text-sm font-bold text-campo underline underline-offset-4"
          >
            Reintentar todos
          </button>
        )}
      </div>
      <ul className="space-y-2">
        {conError.map((r) => (
          <li key={r.cliente_id} className="rounded-xl border border-red-200 bg-white p-3">
            <p className="font-bold text-slate-900">{r.resumen}</p>
            <p className="mt-0.5 text-sm text-slate-500">Anotado {fechaHora(r.creado_en)}</p>
            <p className="mt-1 text-sm font-semibold text-red-800">{r.error ?? "El servidor no lo aceptó."}</p>
            <Acciones registro={r} alReintentar={alReintentar} alDescartar={alDescartar} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Detalle que se despliega desde la barra: lo que espera señal y lo último que se envió. */
export function Pendientes({
  cola,
  historial,
  alReintentar,
  alDescartar,
}: {
  cola: RegistroCola[];
  historial: RegistroHistorial[];
  alReintentar: (ids: string[]) => void;
  alDescartar: (registro: RegistroCola) => void;
}) {
  const esperando = cola.filter((r) => r.estado !== "error");

  return (
    <div className="space-y-5">
      <section>
        <h2 className="mb-3 font-display text-lg font-bold text-slate-900">Esperando señal</h2>
        {esperando.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 p-4 text-center text-slate-500">No hay registros por enviar.</p>
        ) : (
          <ul className="space-y-2">
            {esperando.map((r) => (
              <li key={r.cliente_id} className="rounded-2xl border border-slate-200 bg-white p-3">
                <p className="font-bold text-slate-900">{r.resumen}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500">
                  <Clock className="h-4 w-4" aria-hidden />
                  Esperando señal · anotado {fechaHora(r.creado_en)}
                </p>
                <Acciones registro={r} alReintentar={alReintentar} alDescartar={alDescartar} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {historial.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-bold text-slate-900">Enviados</h2>
          <ul className="space-y-2">
            {historial.slice(0, 30).map((r) => (
              <li key={r.cliente_id} className="rounded-2xl border border-slate-200 bg-white p-3">
                <p className="font-semibold text-slate-800">{r.resumen}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-emerald-700">
                  <CircleCheck className="h-4 w-4" aria-hidden />
                  {r.resultado === "duplicado" ? "Ya estaba enviado" : "Enviado"} · {fechaHora(r.sincronizado_en)}
                </p>
                {r.mensaje && <p className="mt-1 text-sm text-amber-800">{r.mensaje}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

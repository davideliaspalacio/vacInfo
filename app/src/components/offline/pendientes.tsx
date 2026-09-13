"use client";

import clsx from "clsx";
import { CircleCheck, Clock, RotateCcw, Trash2, TriangleAlert } from "lucide-react";
import { fechaHora } from "@/lib/offline/resumen";
import type { RegistroCola, RegistroHistorial } from "@/lib/offline/tipos";

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
  const conError = cola.filter((r) => r.estado === "error");

  return (
    <div className="space-y-5">
      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-display text-xl font-bold text-slate-900">Pendientes</h2>
          {conError.length > 1 && (
            <button type="button" onClick={() => alReintentar(conError.map((r) => r.cliente_id))} className="min-h-11 rounded-xl px-3 text-sm font-bold text-campo">
              Reintentar todos
            </button>
          )}
        </div>
        {cola.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-center text-slate-500">No hay registros por enviar.</p>
        ) : (
          <ul className="space-y-2">
            {cola.map((r) => (
              <li key={r.cliente_id} className={clsx("rounded-2xl border p-3", r.estado === "error" ? "border-red-200 bg-red-50" : "border-slate-200 bg-white")}>
                <p className="font-bold text-slate-900">{r.resumen}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500">
                  {r.estado === "error" ? (
                    <TriangleAlert className="h-4 w-4 text-red-700" aria-hidden />
                  ) : (
                    <Clock className="h-4 w-4" aria-hidden />
                  )}
                  {r.estado === "error" ? "No se pudo enviar" : "Esperando señal"} · anotado {fechaHora(r.creado_en)}
                </p>
                {r.error && <p className="mt-1 text-sm font-semibold text-red-800">{r.error}</p>}
                <div className="mt-2 flex gap-2">
                  {r.estado === "error" && (
                    <button
                      type="button"
                      onClick={() => alReintentar([r.cliente_id])}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700"
                    >
                      <RotateCcw className="h-4 w-4" aria-hidden />
                      Reintentar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => alDescartar(r)}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-red-700"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                    Descartar
                  </button>
                </div>
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

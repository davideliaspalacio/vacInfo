"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ChevronDown, ChevronUp, CloudOff, RefreshCw, Wifi } from "lucide-react";
import { fechaHora } from "@/lib/offline/resumen";
import { esAvisoDeEspera } from "@/lib/offline/cliente";
import type { RegistroCola, RegistroHistorial } from "@/lib/offline/tipos";
import { ErroresPendientes, Pendientes } from "./pendientes";
import type { Problema } from "./hooks";

/**
 * Único aviso de lo que falta por enviar. Antes `/campo/registrar` tenía una pestaña «Pendientes»;
 * el cliente la quitó, así que esta barra carga con todo:
 *  · siempre visible, con la señal, cuántos registros faltan y «Sincronizar ahora»;
 *  · lo que falló se ve aquí mismo, en rojo, con el motivo y los botones de reintentar o descartar
 *    (no se puede esconder: no hay otro lugar donde el trabajador se enteraría);
 *  · el resto del detalle (lo que espera señal y lo ya enviado) se despliega desde la barra.
 */
export function BarraEstado({
  enLinea,
  cola,
  historial,
  sincronizando,
  problema,
  ultimoSync,
  alSincronizar,
  alReintentar,
  alDescartar,
}: {
  enLinea: boolean;
  cola: RegistroCola[];
  historial: RegistroHistorial[];
  sincronizando: boolean;
  problema: Problema;
  ultimoSync: string | null;
  alSincronizar: () => void;
  alReintentar: (ids: string[]) => void;
  alDescartar: (registro: RegistroCola) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const pendientes = cola.length;
  const errores = cola.filter((r) => r.estado === "error").length;
  const hayDetalle = pendientes - errores > 0 || historial.length > 0;

  return (
    <section
      id="estado"
      aria-label="Estado de los registros"
      className={clsx(
        "mb-4 rounded-2xl border bg-white p-3 shadow-sm",
        errores > 0 ? "border-red-300" : pendientes > 0 ? "border-amber-300" : "border-slate-200",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className={clsx("flex items-center gap-2 font-bold", enLinea ? "text-emerald-700" : "text-amber-700")}>
            {enLinea ? <Wifi className="h-5 w-5" aria-hidden /> : <CloudOff className="h-5 w-5" aria-hidden />}
            {enLinea ? "En línea" : "Sin señal"}
          </p>
          <p className="mt-0.5 text-sm text-slate-600" aria-live="polite">
            {pendientes === 0 ? "Todo enviado" : `${pendientes} ${pendientes === 1 ? "registro pendiente" : "registros pendientes"}`}
            {errores > 0 && <span className="font-bold text-red-700"> · {errores} con error</span>}
          </p>
          <p className="text-xs text-slate-400">Último envío: {fechaHora(ultimoSync)}</p>
        </div>
        <button
          type="button"
          onClick={alSincronizar}
          disabled={!enLinea || sincronizando || pendientes === 0}
          className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-xl bg-campo px-4 font-bold text-white disabled:bg-slate-200 disabled:text-slate-500"
        >
          <RefreshCw className={clsx("h-5 w-5", sincronizando && "animate-spin")} aria-hidden />
          {sincronizando ? "Enviando…" : "Sincronizar ahora"}
        </button>
      </div>

      {problema && problema.tipo !== "sin-conexion" && (
        <p
          role={esAvisoDeEspera(problema.texto) ? "status" : "alert"}
          className={clsx(
            "mt-3 rounded-xl p-3 text-sm font-semibold",
            esAvisoDeEspera(problema.texto) ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-800",
          )}
        >
          {problema.texto}
          {problema.tipo === "sin-sesion" && (
            <Link href="/login" className="ml-1 underline underline-offset-4">
              Entrar
            </Link>
          )}
        </p>
      )}

      <ErroresPendientes cola={cola} alReintentar={alReintentar} alDescartar={alDescartar} />

      {hayDetalle && (
        <>
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            aria-expanded={abierto}
            className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-campo"
          >
            {abierto ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
            {abierto ? "Ocultar detalle" : "Ver detalle"}
          </button>
          {abierto && (
            <div className="mt-2 border-t border-slate-200 pt-3">
              <Pendientes cola={cola} historial={historial} alReintentar={alReintentar} alDescartar={alDescartar} />
            </div>
          )}
        </>
      )}
    </section>
  );
}

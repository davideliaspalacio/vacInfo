"use client";

import Link from "next/link";
import clsx from "clsx";
import { CloudOff, RefreshCw, Wifi } from "lucide-react";
import { fechaHora } from "@/lib/offline/resumen";
import { esAvisoDeEspera } from "@/lib/offline/cliente";
import type { Problema } from "./hooks";

export function BarraEstado({
  enLinea,
  pendientes,
  errores,
  sincronizando,
  problema,
  ultimoSync,
  alSincronizar,
}: {
  enLinea: boolean;
  pendientes: number;
  errores: number;
  sincronizando: boolean;
  problema: Problema;
  ultimoSync: string | null;
  alSincronizar: () => void;
}) {
  return (
    <section aria-label="Estado de la conexión" className="mb-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
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
    </section>
  );
}

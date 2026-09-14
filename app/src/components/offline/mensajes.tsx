"use client";

import Link from "next/link";
import clsx from "clsx";
import { CheckCheck, Mail, Users } from "lucide-react";
import { useEnLinea, useMensajes } from "./hooks";

const fechaHora = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" });

export function InsigniaMensajes({ usuarioId }: { usuarioId: string }) {
  const { noLeidos } = useMensajes(usuarioId);
  if (!noLeidos) return null;
  return (
    <Link
      href="/campo/mensajes"
      title="Mensajes sin leer"
      aria-label={`${noLeidos} ${noLeidos === 1 ? "mensaje sin leer" : "mensajes sin leer"}`}
      className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-red-600 px-3 text-xs font-bold text-white"
    >
      <Mail className="h-4 w-4" aria-hidden />
      {noLeidos}
    </Link>
  );
}

export function ContadorMensajes({ usuarioId }: { usuarioId: string }) {
  const { noLeidos } = useMensajes(usuarioId);
  if (!noLeidos) return null;
  return <span className="ml-2 rounded-full bg-red-600 px-2.5 py-0.5 text-sm font-bold text-white">{noLeidos} sin leer</span>;
}

export function ListaMensajes({ usuarioId }: { usuarioId: string }) {
  const enLinea = useEnLinea();
  const { mensajes, descargada, noLeido, noLeidos, marcar } = useMensajes(usuarioId);

  if (!descargada) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-center text-slate-500">
        {enLinea ? "Buscando tus mensajes…" : "Conéctate a internet una vez para descargar tus mensajes."}
      </p>
    );
  }

  if (mensajes.length === 0) {
    return <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-center text-slate-500">Todavía no tienes mensajes.</p>;
  }

  return (
    <div className="space-y-3">
      {noLeidos > 1 && (
        <button type="button" onClick={() => marcar(mensajes.filter(noLeido))} className="min-h-11 text-sm font-bold text-campo underline underline-offset-4">
          Marcar todos como leídos
        </button>
      )}
      <ul className="space-y-3">
        {mensajes.map((m) => {
          const nuevo = noLeido(m);
          return (
            <li key={m.id} className={clsx("rounded-2xl border p-4", nuevo ? "border-campo bg-blue-50" : "border-slate-200 bg-white")}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <strong className="text-slate-900">{m.remitente}</strong>
                {nuevo && <span className="rounded-full bg-campo px-2 py-0.5 text-xs font-bold text-white">Nuevo</span>}
                <span className="ml-auto text-xs text-slate-500">{fechaHora.format(new Date(m.creado_en))}</span>
              </div>
              <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-slate-500">
                {m.destinatario_id ? (
                  "Para ti"
                ) : (
                  <>
                    <Users className="h-3.5 w-3.5" aria-hidden />
                    Para todo el equipo
                  </>
                )}
              </p>
              <p className={clsx("mt-2 whitespace-pre-line text-lg leading-relaxed", nuevo ? "font-semibold text-slate-900" : "text-slate-700")}>{m.texto}</p>
              {nuevo && (
                <button
                  type="button"
                  onClick={() => marcar([m])}
                  className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 font-bold text-slate-700"
                >
                  <CheckCheck className="h-5 w-5" aria-hidden />
                  Marcar como leído
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

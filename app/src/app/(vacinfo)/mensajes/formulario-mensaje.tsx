"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { PenLine, Send } from "lucide-react";
import { enviarMensaje, type EstadoMensaje } from "./actions";

export function FormularioMensaje({ miembros }: { miembros: { id: string; nombre: string; rol: string }[] }) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, enviando] = useActionState<EstadoMensaje, FormData>(enviarMensaje, {});
  const formulario = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.ok) formulario.current?.reset();
  }, [estado]);

  return (
    <div className="print:hidden">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-expanded={abierto}
        className="boton-accion inline-flex items-center gap-2 rounded-xl bg-lima px-4 py-2 font-bold text-bosque"
      >
        <PenLine className="h-4 w-4" aria-hidden />
        Escribir mensaje
      </button>

      {abierto && (
        <form ref={formulario} action={accion} className="mt-5 space-y-4 border-t border-[#cbd5c4] pt-5">
          <label className="block font-bold text-bosque">
            Enviar a
            <select name="destinatario" defaultValue="" className="campo-control mt-2">
              <option value="">Todos los trabajadores</option>
              {miembros.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre} · {m.rol}
                </option>
              ))}
            </select>
          </label>
          <label className="block font-bold text-bosque">
            Mensaje
            <textarea name="texto" rows={4} required maxLength={2000} className="campo-control mt-2 font-normal" />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button
              disabled={enviando}
              className="boton-accion inline-flex items-center gap-2 rounded-xl bg-bosque px-5 py-3 font-bold text-leche disabled:opacity-60"
            >
              <Send className="h-4 w-4" aria-hidden />
              {enviando ? "Enviando…" : "Enviar mensaje"}
            </button>
            <p aria-live="polite" className={estado.error ? "text-sm font-bold text-alerta" : "text-sm font-bold text-pasto-oscuro"}>
              {estado.error ?? (estado.ok ? "Mensaje enviado." : "")}
            </p>
          </div>
        </form>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import clsx from "clsx";
import { LoaderCircle, Save } from "lucide-react";

const BASE = "flex w-full items-center justify-center gap-2 rounded-2xl px-5 text-lg font-bold text-white shadow-lg transition active:scale-[0.99] disabled:opacity-60";

/**
 * Clases del botón Guardar. Con datos escritos y sin guardar (`sucio`) se pone naranja fuerte y pulsa
 * cada 1,2 s para que al trabajador no se le olvide guardar. Si el celular pide menos movimiento
 * (`prefers-reduced-motion`) se queda el color fuerte sin animación.
 */
export function clasesGuardar(sucio: boolean, extra?: string) {
  return clsx(
    BASE,
    sucio
      ? "animate-recordar-guardar bg-guardar shadow-guardar/30 hover:bg-guardar-oscuro motion-reduce:animate-none"
      : "bg-campo shadow-campo/25 hover:bg-campo-oscuro",
    extra,
  );
}

/** Avisa cuando el trabajador escribió algo en el formulario del botón y todavía no se ha enviado. */
function useFormularioTocado(boton: React.RefObject<HTMLButtonElement | null>) {
  const [tocado, setTocado] = useState(false);

  useEffect(() => {
    const form = boton.current?.form;
    if (!form) return;
    const marcar = () => setTocado(true);
    const limpiar = () => setTocado(false);
    form.addEventListener("input", marcar);
    form.addEventListener("change", marcar);
    form.addEventListener("reset", limpiar);
    return () => {
      form.removeEventListener("input", marcar);
      form.removeEventListener("change", marcar);
      form.removeEventListener("reset", limpiar);
    };
  }, [boton]);

  return tocado;
}

/** Botón de los formularios que se envían al servidor (comentario). Parpadea mientras haya algo escrito sin enviar. */
export function BotonGuardar({ children = "Guardar registro" }: { children?: React.ReactNode }) {
  const boton = useRef<HTMLButtonElement>(null);
  const { pending } = useFormStatus();
  const tocado = useFormularioTocado(boton);

  return (
    <button ref={boton} type="submit" disabled={pending} className={clasesGuardar(tocado && !pending, "min-h-14")}>
      {pending ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden /> : <Save className="h-5 w-5" aria-hidden />}
      {pending ? "Guardando…" : children}
    </button>
  );
}

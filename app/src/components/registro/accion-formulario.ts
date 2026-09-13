"use client";

import { startTransition, useActionState, type FormEvent } from "react";

/**
 * Como useActionState, pero enviando desde onSubmit: React no limpia el formulario
 * cuando la acción devuelve errores y la persona no pierde lo que escribió.
 */
export function useAccionFormulario<E extends object>(accion: (estado: E, datos: FormData) => Promise<E>, inicial: E) {
  const [estado, despachar, pendiente] = useActionState<E, FormData>(
    accion as (estado: Awaited<E>, datos: FormData) => Promise<E>,
    inicial as Awaited<E>,
  );

  function alEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    startTransition(() => despachar(datos));
  }

  return [estado, alEnviar, pendiente] as const;
}

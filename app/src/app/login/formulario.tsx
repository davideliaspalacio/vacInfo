"use client";

import { useActionState } from "react";
import { iniciarSesion } from "./actions";

export function FormularioLogin({ siguiente }: { siguiente?: string }) {
  const [estado, accion, enviando] = useActionState(iniciarSesion, {});

  return (
    <form action={accion} className="mt-5 space-y-4">
      {siguiente && <input type="hidden" name="siguiente" value={siguiente} />}
      <label className="block font-bold">
        Correo o usuario
        <input
          name="identificador"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          className="campo-control mt-2"
          defaultValue="gustavo@vacinfo.local"
        />
      </label>
      <label className="block font-bold">
        Contraseña o PIN
        <input name="password" type="password" autoComplete="current-password" required className="campo-control mt-2" />
      </label>
      {estado.error && (
        <p role="alert" className="text-sm font-bold text-alerta">
          {estado.error}
        </p>
      )}
      <button
        disabled={enviando}
        className="boton-accion w-full rounded-xl bg-bosque px-5 py-3 font-bold text-leche disabled:opacity-60"
      >
        {enviando ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}

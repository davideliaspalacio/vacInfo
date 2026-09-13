"use client";

import { useActionState, useState } from "react";
import clsx from "clsx";
import { BotonPrimario } from "@/components/ui";
import { Campo, MensajeError, type EstadoFormulario } from "@/components/fincas/campo";
import { aceptarInvitacion, unirseConCuentaNueva } from "@/app/unirse/actions";
import { normalizarUsuario, type ModoCuenta } from "./cuentas";
import { useAccionFormulario } from "./accion-formulario";

const INICIAL: EstadoFormulario = {};

export function FormularioUnirse({ codigo }: { codigo: string }) {
  const [estado, alEnviar, pendiente] = useAccionFormulario(unirseConCuentaNueva, INICIAL);
  const [modo, setModo] = useState<ModoCuenta>("usuario");
  const [usuario, setUsuario] = useState("");
  const e = estado.errores ?? {};
  const esUsuario = modo === "usuario";

  return (
    <form onSubmit={alEnviar} className="mt-5 space-y-4" noValidate>
      <input type="hidden" name="codigo" value={codigo} />
      <input type="hidden" name="modo" value={modo} />
      <MensajeError>{estado.mensaje}</MensajeError>

      <Campo etiqueta="Nombre completo" error={e.nombre}>
        <input name="nombre" autoComplete="name" required className="campo-control" placeholder="Jhon Jaramillo" />
      </Campo>

      <div role="group" aria-label="Cómo quieres ingresar" className="grid grid-cols-2 gap-1 rounded-xl bg-black/5 p-1 text-sm font-bold">
        {(["usuario", "correo"] as const).map((opcion) => (
          <button
            key={opcion}
            type="button"
            aria-pressed={modo === opcion}
            onClick={() => setModo(opcion)}
            className={clsx("rounded-lg px-3 py-2", modo === opcion ? "bg-white text-bosque shadow-sm" : "text-tinta-suave")}
          >
            {opcion === "usuario" ? "Usuario y PIN" : "Tengo correo"}
          </button>
        ))}
      </div>

      {esUsuario ? (
        <Campo
          etiqueta="Usuario"
          error={e.usuario}
          ayuda={
            usuario.trim() ? (
              <>
                Ingresarás como <strong className="font-mono text-bosque">{normalizarUsuario(usuario)}</strong>
              </>
            ) : (
              "Sin espacios ni tildes. Ejemplo: jhon.jaramillo"
            )
          }
        >
          <input
            name="usuario"
            value={usuario}
            onChange={(ev) => setUsuario(ev.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            className="campo-control"
          />
        </Campo>
      ) : (
        <Campo etiqueta="Correo" error={e.correo}>
          <input name="correo" type="email" autoComplete="email" required className="campo-control" />
        </Campo>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta={esUsuario ? "PIN" : "Contraseña"} error={e.clave} ayuda={esUsuario ? "Mínimo 6 números" : "Mínimo 6 caracteres"}>
          <input
            name="clave"
            type="password"
            inputMode={esUsuario ? "numeric" : undefined}
            autoComplete="new-password"
            required
            className="campo-control"
          />
        </Campo>
        <Campo etiqueta={esUsuario ? "Repite el PIN" : "Repite la contraseña"} error={e.confirmar}>
          <input
            name="confirmar"
            type="password"
            inputMode={esUsuario ? "numeric" : undefined}
            autoComplete="new-password"
            required
            className="campo-control"
          />
        </Campo>
      </div>

      <BotonPrimario disabled={pendiente} className="w-full">
        {pendiente ? "Creando tu cuenta…" : "Crear cuenta y unirme"}
      </BotonPrimario>
    </form>
  );
}

export function BotonUnirme({ codigo }: { codigo: string }) {
  const [estado, accion, pendiente] = useActionState(aceptarInvitacion.bind(null, codigo), {});

  return (
    <form action={accion} className="mt-5 space-y-3">
      <MensajeError>{estado.error}</MensajeError>
      <BotonPrimario disabled={pendiente} className="w-full">
        {pendiente ? "Uniéndote…" : "Unirme"}
      </BotonPrimario>
    </form>
  );
}

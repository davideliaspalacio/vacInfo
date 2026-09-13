"use client";

import { useState, useTransition } from "react";
import { Ban, QrCode } from "lucide-react";
import { BotonPrimario, Etiqueta, Vacio } from "@/components/ui";
import { Campo, MensajeError } from "@/components/fincas/campo";
import { useAccionFormulario } from "@/components/registro/accion-formulario";
import { crearInvitacion, desactivarInvitacion, type EstadoInvitacion } from "@/app/(vacinfo)/equipo/actions";
import { TarjetaCodigo } from "./tarjeta-codigo";
import { DESCRIPCION_ROL, ETIQUETA_ROL, type Rol } from "./roles";

export type InvitacionLista = {
  id: string;
  codigo: string;
  rol: Rol;
  finca: string;
  usos: number;
  usosMax: number;
  vence: string;
  estado: "vigente" | "vencida" | "agotada";
  enlace: string;
  svg: string | null;
};

const ROLES_INVITABLES: Rol[] = ["trabajador", "mayordomo", "administrador", "veterinario", "consultor"];
const INICIAL: EstadoInvitacion = {};

export function FormularioInvitacion({ fincas }: { fincas: { id: string; nombre: string }[] }) {
  const [estado, alEnviar, pendiente] = useAccionFormulario(crearInvitacion, INICIAL);
  const [rol, setRol] = useState<Rol>("trabajador");
  const e = estado.errores ?? {};

  return (
    <div className="space-y-5">
      <form onSubmit={alEnviar} className="space-y-4" noValidate>
        <MensajeError>{estado.error}</MensajeError>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Rol" error={e.rol} ayuda={DESCRIPCION_ROL[rol]}>
            <select name="rol" value={rol} onChange={(ev) => setRol(ev.target.value as Rol)} className="campo-control">
              {ROLES_INVITABLES.map((r) => (
                <option key={r} value={r}>
                  {ETIQUETA_ROL[r]}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Finca" error={e.finca_id} ayuda="Si eliges una, solo verá esa finca">
            <select name="finca_id" defaultValue="" className="campo-control">
              <option value="">Todas las fincas</option>
              {fincas.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nombre}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Personas que pueden usarlo" error={e.usos_max}>
            <input name="usos_max" type="number" min={1} max={100} defaultValue={10} className="campo-control" />
          </Campo>
          <Campo etiqueta="Vence en (días)" error={e.dias}>
            <input name="dias" type="number" min={1} max={90} defaultValue={14} className="campo-control" />
          </Campo>
        </div>
        <BotonPrimario disabled={pendiente}>
          <QrCode className="h-5 w-5" aria-hidden />
          {pendiente ? "Generando…" : "Generar código"}
        </BotonPrimario>
      </form>

      {estado.creada && (
        <div aria-live="polite">
          <p className="mb-2 font-bold text-pasto-oscuro">Código listo. Muéstralo, imprímelo o comparte el enlace:</p>
          <TarjetaCodigo {...estado.creada} />
        </div>
      )}
    </div>
  );
}

export function ListaInvitaciones({ invitaciones }: { invitaciones: InvitacionLista[] }) {
  if (!invitaciones.length) return <Vacio>No hay invitaciones activas.</Vacio>;
  return (
    <ul className="divide-y divide-tinta/10">
      {invitaciones.map((inv) => (
        <ItemInvitacion key={inv.id} invitacion={inv} />
      ))}
    </ul>
  );
}

function ItemInvitacion({ invitacion: inv }: { invitacion: InvitacionLista }) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string>();

  function desactivar() {
    if (!window.confirm(`¿Desactivar el código ${inv.codigo}? Nadie más podrá usarlo.`)) return;
    iniciar(async () => {
      const r = await desactivarInvitacion(inv.id);
      setError(r.error);
    });
  }

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="font-mono text-xl font-bold tracking-widest text-bosque">{inv.codigo}</span>
        <span className="text-sm">
          <strong>{ETIQUETA_ROL[inv.rol]}</strong> · {inv.finca}
        </span>
        <span className="text-sm text-tinta-suave">
          {inv.usos} de {inv.usosMax} usos · vence {inv.vence}
        </span>
        {inv.estado === "vencida" && <Etiqueta tono="rojo">Vencida</Etiqueta>}
        {inv.estado === "agotada" && <Etiqueta tono="amarillo">Sin cupos</Etiqueta>}
        <button
          type="button"
          onClick={desactivar}
          disabled={pendiente}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-alerta hover:bg-[#fbe9e5] disabled:opacity-60"
        >
          <Ban className="h-4 w-4" aria-hidden />
          {pendiente ? "Desactivando…" : "Desactivar"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-xs font-bold text-alerta">
          {error}
        </p>
      )}
      {inv.svg && (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm font-bold text-pasto-oscuro">Ver QR y enlace</summary>
          <div className="mt-3">
            <TarjetaCodigo codigo={inv.codigo} enlace={inv.enlace} svg={inv.svg} detalle={`${ETIQUETA_ROL[inv.rol]} · ${inv.finca}`} />
          </div>
        </details>
      )}
    </li>
  );
}

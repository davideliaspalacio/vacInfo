"use client";

import { useOptimistic, useState, useTransition } from "react";
import { UserMinus } from "lucide-react";
import { Etiqueta } from "@/components/ui";
import { cambiarRol, limitarFincas, quitarMiembro, type ResultadoEquipo } from "@/app/(vacinfo)/equipo/actions";
import { ETIQUETA_ROL, ROLES, type Rol } from "./roles";

export type MiembroEquipo = { usuarioId: string; nombre: string; usuario: string | null; rol: Rol; fincas: string[] | null };
type Finca = { id: string; nombre: string };

export function TablaMiembros({
  miembros,
  fincas,
  yo,
  rolActor,
  puedeGestionar,
}: {
  miembros: MiembroEquipo[];
  fincas: Finca[];
  yo: string;
  rolActor: Rol;
  puedeGestionar: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-tinta/10 text-xs uppercase tracking-wider text-tinta-suave">
            <th className="py-2 pr-3 font-bold">Nombre</th>
            <th className="py-2 pr-3 font-bold">Rol</th>
            <th className="py-2 pr-3 font-bold">Fincas</th>
            {puedeGestionar && (
              <th className="py-2 font-bold">
                <span className="sr-only">Acciones</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {miembros.map((m) => (
            <FilaMiembro key={m.usuarioId} miembro={m} fincas={fincas} esYo={m.usuarioId === yo} rolActor={rolActor} puedeGestionar={puedeGestionar} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FilaMiembro({
  miembro,
  fincas,
  esYo,
  rolActor,
  puedeGestionar,
}: {
  miembro: MiembroEquipo;
  fincas: Finca[];
  esYo: boolean;
  rolActor: Rol;
  puedeGestionar: boolean;
}) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string>();
  const [rolVisto, setRolVisto] = useOptimistic(miembro.rol);
  const [todas, setTodas] = useState(miembro.fincas === null);
  const [elegidas, setElegidas] = useState<string[]>(miembro.fincas ?? []);

  const actorPropietario = rolActor === "propietario";
  const editable = puedeGestionar && (miembro.rol !== "propietario" || actorPropietario);
  const nombres = new Map(fincas.map((f) => [f.id, f.nombre]));

  function ejecutar(accion: () => Promise<ResultadoEquipo>, antes?: () => void) {
    setError(undefined);
    iniciar(async () => {
      antes?.();
      const r = await accion();
      if (r.error) setError(r.error);
    });
  }

  function alternarFinca(id: string, marcada: boolean) {
    setElegidas((actual) => (marcada ? [...actual, id] : actual.filter((f) => f !== id)));
  }

  function quitar() {
    const pregunta = esYo
      ? "¿Seguro que quieres salir de la empresa? Perderás el acceso a sus fincas."
      : `¿Quitar a ${miembro.nombre} del equipo? Ya no podrá ingresar a la empresa.`;
    if (window.confirm(pregunta)) ejecutar(() => quitarMiembro(miembro.usuarioId));
  }

  return (
    <tr className="border-b border-tinta/5 align-top last:border-0" aria-busy={pendiente}>
      <td className="py-3 pr-3">
        <span className="font-bold text-bosque">{miembro.nombre}</span> {esYo && <Etiqueta tono="verde">tú</Etiqueta>}
        {miembro.usuario && <span className="block font-mono text-xs text-tinta-suave">usuario: {miembro.usuario}</span>}
        {error && (
          <span role="alert" className="mt-1 block text-xs font-bold text-alerta">
            {error}
          </span>
        )}
      </td>
      <td className="py-3 pr-3">
        {editable ? (
          <select
            aria-label={`Rol de ${miembro.nombre}`}
            value={rolVisto}
            disabled={pendiente}
            onChange={(e) => {
              const nuevo = e.target.value as Rol;
              ejecutar(
                () => cambiarRol(miembro.usuarioId, nuevo),
                () => setRolVisto(nuevo),
              );
            }}
            className="campo-control max-w-[180px] py-1.5"
          >
            {ROLES.filter((r) => actorPropietario || r !== "propietario").map((r) => (
              <option key={r} value={r}>
                {ETIQUETA_ROL[r]}
              </option>
            ))}
          </select>
        ) : (
          <span className="font-bold">{ETIQUETA_ROL[miembro.rol]}</span>
        )}
      </td>
      <td className="py-3 pr-3">
        <span>{miembro.fincas === null ? "Todas" : miembro.fincas.map((id) => nombres.get(id) ?? "Finca sin acceso").join(", ")}</span>
        {editable && miembro.rol !== "propietario" && fincas.length > 0 && (
          <details className="mt-1">
            <summary className="cursor-pointer text-xs font-bold text-pasto-oscuro">Limitar fincas</summary>
            <fieldset className="mt-2 space-y-1.5 rounded-xl border border-tinta/10 bg-white/70 p-3" disabled={pendiente}>
              <legend className="sr-only">Fincas a las que tiene acceso</legend>
              <label className="flex items-center gap-2 font-bold">
                <input type="checkbox" checked={todas} onChange={(e) => setTodas(e.target.checked)} />
                Todas las fincas
              </label>
              {!todas &&
                fincas.map((f) => (
                  <label key={f.id} className="flex items-center gap-2 pl-4">
                    <input type="checkbox" checked={elegidas.includes(f.id)} onChange={(e) => alternarFinca(f.id, e.target.checked)} />
                    {f.nombre}
                  </label>
                ))}
              <button
                type="button"
                onClick={() => ejecutar(() => limitarFincas(miembro.usuarioId, todas ? null : elegidas))}
                className="mt-1 rounded-lg bg-bosque px-3 py-1.5 text-xs font-bold text-leche disabled:opacity-60"
              >
                Guardar fincas
              </button>
            </fieldset>
          </details>
        )}
      </td>
      {puedeGestionar && (
        <td className="py-3 text-right">
          {editable && (
            <button
              type="button"
              onClick={quitar}
              disabled={pendiente}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-alerta hover:bg-[#fbe9e5] disabled:opacity-60"
            >
              <UserMinus className="h-4 w-4" aria-hidden />
              {esYo ? "Salir" : "Quitar"}
            </button>
          )}
        </td>
      )}
    </tr>
  );
}

import { FormularioAccion, type EstadoAccion } from "@/components/fincas/formulario-accion";
import { Campo } from "@/components/fincas/campo";
import { fecha as fechaCorta } from "@/lib/formato";
import { ESTADOS_POTRERO, nombrePotrero, type EstadoPotrero } from "./rotacion";

type Accion = (estado: EstadoAccion, datos: FormData) => Promise<EstadoAccion>;

export function etiquetaDestino(p: EstadoPotrero, objetivo: number) {
  const e = ESTADOS_POTRERO[p.estado]?.texto ?? p.estado;
  const detalle =
    p.estado === "bloqueado"
      ? `hasta ${fechaCorta(p.retiro_hasta)}`
      : p.estado === "descansando" || p.estado === "listo"
        ? `${p.dias_descanso}/${objetivo} días`
        : p.estado === "ocupado"
          ? p.grupo
          : "";
  return `${nombrePotrero(p)} — ${e}${detalle ? ` (${detalle})` : ""}`;
}

export function FormularioMoverGrupo({
  accion,
  potreros,
  grupos,
  objetivo,
  corte,
}: {
  accion: Accion;
  potreros: EstadoPotrero[];
  grupos: string[];
  objetivo: number;
  corte: string;
}) {
  return (
    <FormularioAccion accion={accion} boton="Mover grupo">
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Grupo">
          <input name="grupo" list="grupos-potrero" required autoComplete="off" className="campo-control" placeholder="Vacas en ordeño" />
          <datalist id="grupos-potrero">
            {grupos.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </Campo>
        <Campo etiqueta="Animales">
          <input name="animales" type="number" min="0" inputMode="numeric" className="campo-control" />
        </Campo>
        <Campo etiqueta="Potrero destino" className="sm:col-span-2" ayuda="Evita los bloqueados y los que no han cumplido el descanso.">
          <select name="potrero_id" required defaultValue="" className="campo-control">
            <option value="" disabled>
              Elige el potrero
            </option>
            {potreros.map((p) => (
              <option key={p.potrero_id} value={p.potrero_id}>
                {etiquetaDestino(p, objetivo)}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Fecha">
          <input type="date" name="fecha" required defaultValue={corte} className="campo-control" />
        </Campo>
        <Campo etiqueta="Observaciones">
          <input name="observaciones" className="campo-control" />
        </Campo>
      </div>
    </FormularioAccion>
  );
}

export function FormularioSacarGrupo({ accion, grupos, corte }: { accion: Accion; grupos: { grupo: string; potrero: string }[]; corte: string }) {
  if (!grupos.length) return <p className="text-sm text-tinta-suave">No hay grupos en potreros.</p>;
  return (
    <FormularioAccion accion={accion} boton="Sacar grupo" botonClassName="bg-cafe">
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Grupo">
          <select name="grupo" required defaultValue="" className="campo-control">
            <option value="" disabled>
              Elige el grupo
            </option>
            {grupos.map((g) => (
              <option key={g.grupo} value={g.grupo}>
                {g.grupo} · {g.potrero}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Fecha de salida">
          <input type="date" name="fecha" required defaultValue={corte} className="campo-control" />
        </Campo>
      </div>
    </FormularioAccion>
  );
}

export function FormularioPotrero({
  accion,
  potrero,
}: {
  accion: Accion;
  potrero?: { numero: number; nombre: string | null; area_cuadras: number | null };
}) {
  return (
    <FormularioAccion accion={accion} boton={potrero ? "Guardar" : "Agregar"} className="flex flex-wrap items-end gap-2" botonClassName="py-2">
      <Campo etiqueta="Número" className="w-20">
        <input name="numero" type="number" min="1" required defaultValue={potrero?.numero} className="campo-control py-2" />
      </Campo>
      <Campo etiqueta="Nombre" className="w-44">
        <input name="nombre" defaultValue={potrero?.nombre ?? ""} className="campo-control py-2" />
      </Campo>
      <Campo etiqueta="Área (cuadras)" className="w-28">
        <input name="area_cuadras" type="number" min="0" step="0.01" inputMode="decimal" defaultValue={potrero?.area_cuadras ?? ""} className="campo-control py-2" />
      </Campo>
    </FormularioAccion>
  );
}

export function FormularioCrearPotreros({ accion, sugerido }: { accion: Accion; sugerido: number }) {
  return (
    <FormularioAccion accion={accion} boton="Crear potreros" className="flex flex-wrap items-end gap-2" botonClassName="py-2">
      <Campo etiqueta="Crear potreros del 1 al" className="w-44">
        <input name="total" type="number" min="1" max="300" required defaultValue={sugerido} className="campo-control py-2" />
      </Campo>
    </FormularioAccion>
  );
}

export function FormularioDescanso({ accion, objetivo }: { accion: Accion; objetivo: number }) {
  return (
    <FormularioAccion accion={accion} boton="Guardar" className="flex flex-wrap items-end gap-2" botonClassName="py-2">
      <Campo etiqueta="Días de descanso objetivo" className="w-48">
        <input name="dias_descanso_objetivo" type="number" min="1" required defaultValue={objetivo} className="campo-control py-2" />
      </Campo>
    </FormularioAccion>
  );
}

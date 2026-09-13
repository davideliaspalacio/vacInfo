import { FormularioAccion, type EstadoAccion } from "@/components/fincas/formulario-accion";
import { Campo } from "@/components/fincas/campo";

type Accion = (estado: EstadoAccion, datos: FormData) => Promise<EstadoAccion>;
type Opcion = { animal_id: string; nombre: string; chapeta: string | null; codigo: string };

function SelectorAnimal({ animales, defecto }: { animales: Opcion[]; defecto?: string }) {
  return (
    <Campo etiqueta="Animal">
      <select name="animal_id" required defaultValue={defecto ?? ""} className="campo-control">
        <option value="" disabled>
          Elige el animal
        </option>
        {animales.map((a) => (
          <option key={a.animal_id} value={a.animal_id}>
            {a.nombre} · {a.chapeta ?? a.codigo}
          </option>
        ))}
      </select>
    </Campo>
  );
}

export function FormularioPesaje({ accion, animales, corte, animal }: { accion: Accion; animales: Opcion[]; corte: string; animal?: string }) {
  return (
    <FormularioAccion accion={accion} boton="Guardar pesaje">
      <SelectorAnimal animales={animales} defecto={animal} />
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Fecha">
          <input type="date" name="fecha" required defaultValue={corte} className="campo-control" />
        </Campo>
        <Campo etiqueta="Peso (kg)">
          <input name="peso_kg" type="number" step="0.1" min="1" inputMode="decimal" required className="campo-control" />
        </Campo>
        <Campo etiqueta="Altura (cm)">
          <input name="altura_cm" type="number" step="0.1" min="0" inputMode="decimal" className="campo-control" />
        </Campo>
        <Campo etiqueta="Condición corporal (1–5)">
          <input name="condicion_corporal" type="number" step="0.25" min="1" max="5" inputMode="decimal" className="campo-control" />
        </Campo>
      </div>
      <Campo etiqueta="Observaciones">
        <input name="observaciones" className="campo-control" />
      </Campo>
    </FormularioAccion>
  );
}

export function FormularioDestete({ accion, animales, corte, animal }: { accion: Accion; animales: Opcion[]; corte: string; animal?: string }) {
  if (!animales.length) return <p className="text-sm text-tinta-suave">No hay crías pendientes de destete.</p>;
  return (
    <FormularioAccion accion={accion} boton="Registrar destete">
      <SelectorAnimal animales={animales} defecto={animales.some((a) => a.animal_id === animal) ? animal : undefined} />
      <Campo etiqueta="Fecha del destete">
        <input type="date" name="fecha" required defaultValue={corte} className="campo-control" />
      </Campo>
    </FormularioAccion>
  );
}

export function FormularioReglasLevante({
  accion,
  finca,
}: {
  accion: Accion;
  finca: { dias_destete: number; edad_servicio_meses: number; peso_servicio_kg: number };
}) {
  return (
    <FormularioAccion accion={accion} boton="Guardar reglas" className="flex flex-wrap items-end gap-3">
      <Campo etiqueta="Días para destete" className="w-36">
        <input name="dias_destete" type="number" min="1" required defaultValue={finca.dias_destete} className="campo-control py-2" />
      </Campo>
      <Campo etiqueta="Edad servicio (meses)" className="w-40">
        <input name="edad_servicio_meses" type="number" min="1" required defaultValue={finca.edad_servicio_meses} className="campo-control py-2" />
      </Campo>
      <Campo etiqueta="Peso servicio (kg)" className="w-36">
        <input name="peso_servicio_kg" type="number" min="1" step="1" required defaultValue={finca.peso_servicio_kg} className="campo-control py-2" />
      </Campo>
    </FormularioAccion>
  );
}

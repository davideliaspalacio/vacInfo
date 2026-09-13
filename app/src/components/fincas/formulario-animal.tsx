"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { Database } from "@/lib/database.types";
import { BotonPrimario } from "@/components/ui";
import { Campo, MensajeError, type EstadoFormulario } from "@/components/fincas/campo";
import { CATEGORIAS, ESPECIES, METODOS_ADQUISICION, SEXOS } from "@/components/fincas/etiquetas";
import type { FincaConCodigos } from "@/components/fincas/consultas";

type Animal = Database["public"]["Tables"]["animales"]["Row"];
export type Hembra = { id: string; nombre: string; chapeta: string | null; finca_id: string };

export function FormularioAnimal({
  accion,
  fincas,
  hembras,
  animal,
  fincaInicial,
  cancelar,
}: {
  accion: (estado: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;
  fincas: FincaConCodigos[];
  hembras: Hembra[];
  animal?: Animal;
  fincaInicial?: string;
  cancelar: string;
}) {
  const [estado, enviar, pendiente] = useActionState(accion, {});
  const e = estado.errores ?? {};

  const [fincaId, setFincaId] = useState(animal?.finca_id ?? fincaInicial ?? fincas[0]?.id ?? "");
  const [chapeta, setChapeta] = useState(animal?.chapeta ?? "");
  const [codigo, setCodigo] = useState(animal?.codigo ?? "");
  const [codigoManual, setCodigoManual] = useState(Boolean(animal));
  const [madreId, setMadreId] = useState(animal?.madre_id ?? "");

  const prefijo = fincas.find((f) => f.id === fincaId)?.prefijo ?? "";
  const sugerido = chapeta.trim() ? `${prefijo}-${chapeta.trim()}` : "";
  const codigoMostrado = codigoManual ? codigo : sugerido;
  const madres = hembras.filter((h) => h.finca_id === fincaId && h.id !== animal?.id);
  const v = (x: string | number | null | undefined) => (x == null ? "" : String(x));

  return (
    <form action={enviar} className="space-y-8">
      <MensajeError>{estado.mensaje}</MensajeError>

      <fieldset>
        <legend className="font-display mb-4 text-xl font-bold text-bosque">Identificación</legend>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Campo etiqueta="Pertenece a finca *" error={e.finca_id}>
            <select
              name="finca_id"
              value={fincaId}
              onChange={(ev) => {
                setFincaId(ev.target.value);
                setMadreId("");
              }}
              className="campo-control"
              required
            >
              {fincas.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nombre}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Chapeta" error={e.chapeta}>
            <input name="chapeta" value={chapeta} onChange={(ev) => setChapeta(ev.target.value)} className="campo-control font-mono" placeholder="1394" />
          </Campo>
          <Campo
            etiqueta="Código *"
            error={e.codigo}
            ayuda={
              codigoManual && sugerido && codigo !== sugerido ? (
                <button type="button" className="font-bold text-pasto-oscuro underline" onClick={() => setCodigoManual(false)}>
                  Usar {sugerido}
                </button>
              ) : (
                "Se imprime en el QR de la chapeta"
              )
            }
          >
            <input
              name="codigo"
              required
              value={codigoMostrado}
              onChange={(ev) => {
                setCodigoManual(true);
                setCodigo(ev.target.value);
              }}
              placeholder={prefijo ? `${prefijo}-…` : ""}
              className="campo-control font-mono"
            />
          </Campo>
          <Campo etiqueta="Nombre *" error={e.nombre}>
            <input name="nombre" required defaultValue={v(animal?.nombre)} className="campo-control" />
          </Campo>
          <Campo etiqueta="Especie" error={e.especie}>
            <select name="especie" defaultValue={animal?.especie ?? "bovino"} className="campo-control">
              {Object.entries(ESPECIES).map(([valor, texto]) => (
                <option key={valor} value={valor}>
                  {texto}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Categoría" error={e.categoria}>
            <select name="categoria" defaultValue={animal?.categoria ?? "vaca"} className="campo-control">
              {Object.entries(CATEGORIAS).map(([valor, texto]) => (
                <option key={valor} value={valor}>
                  {texto}
                </option>
              ))}
            </select>
          </Campo>
        </div>
      </fieldset>

      <fieldset>
        <legend className="font-display mb-4 text-xl font-bold text-bosque">Datos generales</legend>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Campo etiqueta="Sexo" error={e.sexo}>
            <select name="sexo" defaultValue={animal?.sexo ?? "hembra"} className="campo-control">
              {Object.entries(SEXOS).map(([valor, texto]) => (
                <option key={valor} value={valor}>
                  {texto}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Raza" error={e.raza}>
            <input name="raza" defaultValue={v(animal?.raza)} className="campo-control" placeholder="Holstein, Jersey…" />
          </Campo>
          <Campo etiqueta="Color" error={e.color}>
            <input name="color" defaultValue={v(animal?.color)} className="campo-control" />
          </Campo>
          <Campo etiqueta="Fecha de nacimiento" error={e.fecha_nacimiento}>
            <input type="date" name="fecha_nacimiento" defaultValue={v(animal?.fecha_nacimiento)} className="campo-control" />
          </Campo>
          <Campo etiqueta="Peso (kg)" error={e.peso_kg}>
            <input name="peso_kg" inputMode="decimal" defaultValue={v(animal?.peso_kg)} className="campo-control" />
          </Campo>
          <Campo etiqueta="Método de adquisición" error={e.metodo_adquisicion}>
            <input name="metodo_adquisicion" list="metodos-adquisicion" defaultValue={v(animal?.metodo_adquisicion)} className="campo-control" />
            <datalist id="metodos-adquisicion">
              {METODOS_ADQUISICION.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </Campo>
        </div>
      </fieldset>

      <fieldset>
        <legend className="font-display mb-4 text-xl font-bold text-bosque">Parientes</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo etiqueta="Padre (toro)" error={e.padre_nombre}>
            <input name="padre_nombre" defaultValue={v(animal?.padre_nombre)} className="campo-control" placeholder="Nombre o registro del toro" />
          </Campo>
          <Campo etiqueta="Madre en la finca" error={e.madre_id}>
            <select name="madre_id" value={madreId} onChange={(ev) => setMadreId(ev.target.value)} className="campo-control">
              <option value="">— No está en la finca —</option>
              {madres.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.nombre}
                  {h.chapeta ? ` · ${h.chapeta}` : ""}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Nombre de la madre" error={e.madre_nombre} ayuda={madreId ? "Opcional: se toma de la madre elegida" : undefined}>
            <input name="madre_nombre" defaultValue={v(animal?.madre_nombre)} className="campo-control" />
          </Campo>
        </div>
      </fieldset>

      <Campo etiqueta="Notas" error={e.notas}>
        <textarea name="notas" rows={3} defaultValue={v(animal?.notas)} className="campo-control" />
      </Campo>

      <div className="flex flex-wrap gap-3">
        <BotonPrimario disabled={pendiente}>{pendiente ? "Guardando…" : "Guardar ficha"}</BotonPrimario>
        <Link href={cancelar} className="inline-flex items-center rounded-xl border border-bosque/20 px-5 py-3 font-bold text-bosque hover:bg-lima-suave">
          Cancelar
        </Link>
      </div>
    </form>
  );
}

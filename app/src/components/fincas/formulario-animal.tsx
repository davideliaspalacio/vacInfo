"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { Database } from "@/lib/database.types";
import { BotonPrimario } from "@/components/ui";
import { Campo, MensajeError, type EstadoFormulario } from "@/components/fincas/campo";
import { CATEGORIAS, GRUPOS_CATEGORIA, METODOS_ADQUISICION, SEXOS } from "@/components/fincas/etiquetas";
import type { FincaConCodigos, Toro } from "@/components/fincas/consultas";

type Animal = Database["public"]["Tables"]["animales"]["Row"];
export type Hembra = { id: string; nombre: string; chapeta: string | null; finca_id: string };

const PADRE_OTRO = "__otro__";

export function FormularioAnimal({
  accion,
  fincas,
  hembras,
  toros,
  animal,
  fincaInicial,
  cancelar,
}: {
  accion: (estado: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;
  fincas: FincaConCodigos[];
  hembras: Hembra[];
  toros: Toro[];
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

  const torosFinca = toros.filter((t) => t.finca_id === fincaId);
  const padreInicial = animal?.padre_nombre ?? "";
  const [padre, setPadre] = useState(!padreInicial || torosFinca.some((t) => t.nombre === padreInicial) ? padreInicial : PADRE_OTRO);

  const prefijo = fincas.find((f) => f.id === fincaId)?.prefijo ?? "";
  const sugerido = chapeta.trim() ? `${prefijo}-${chapeta.trim()}` : "";
  const codigoMostrado = codigoManual ? codigo : sugerido;
  const madres = hembras.filter((h) => h.finca_id === fincaId && h.id !== animal?.id);
  const metodoGuardado = animal?.metodo_adquisicion;
  const metodos = metodoGuardado && !METODOS_ADQUISICION.includes(metodoGuardado) ? [...METODOS_ADQUISICION, metodoGuardado] : METODOS_ADQUISICION;
  const v = (x: string | number | null | undefined) => (x == null ? "" : String(x));

  const grupoToros = (origen: Toro["origen"], titulo: string) => {
    const lista = torosFinca.filter((t) => t.origen === origen);
    return lista.length ? (
      <optgroup label={titulo}>
        {lista.map((t) => (
          <option key={`${origen}-${t.nombre}`} value={t.nombre}>
            {t.nombre}
            {t.chapeta ? ` · ${t.chapeta}` : ""}
          </option>
        ))}
      </optgroup>
    ) : null;
  };

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
                if (padre !== PADRE_OTRO) setPadre("");
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
          <Campo etiqueta="Categoría *" error={e.categoria}>
            <select name="categoria" defaultValue={animal?.categoria ?? "vaca"} className="campo-control" required>
              {GRUPOS_CATEGORIA.map((g) => (
                <optgroup key={g.titulo} label={g.titulo}>
                  {g.categorias.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORIAS[c]}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Sexo" error={e.sexo}>
            <select name="sexo" defaultValue={animal?.sexo ?? "hembra"} className="campo-control">
              {Object.entries(SEXOS).map(([valor, texto]) => (
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
            <select name="metodo_adquisicion" defaultValue={v(metodoGuardado)} className="campo-control">
              <option value="">— Sin especificar —</option>
              {metodos.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Campo>
        </div>
      </fieldset>

      <fieldset>
        <legend className="font-display mb-4 text-xl font-bold text-bosque">Parientes</legend>
        <div className="grid gap-4 sm:grid-cols-3">
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
          <Campo etiqueta="Padre (toro)" error={e.padre_nombre}>
            <select name="padre_nombre" value={padre} onChange={(ev) => setPadre(ev.target.value)} className="campo-control">
              <option value="">— Sin registrar —</option>
              {grupoToros("finca", "Toros de la finca")}
              {grupoToros("servicios", "Toros usados en servicios")}
              <option value={PADRE_OTRO}>Otro (escribir nombre)</option>
            </select>
          </Campo>
          {padre === PADRE_OTRO && (
            <Campo etiqueta="Nombre o registro del toro *" error={e.padre_otro}>
              <input
                name="padre_otro"
                required
                autoFocus={!animal}
                defaultValue={padreInicial && !torosFinca.some((t) => t.nombre === padreInicial) ? padreInicial : ""}
                className="campo-control"
              />
            </Campo>
          )}
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

"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { Database } from "@/lib/database.types";
import {
  categoriaFormulario,
  especieDeCategoria,
  madresPosibles,
  padresPosibles,
  sexoDeCategoria,
  torosDeServiciosPosibles,
  type Candidato,
  type ToroServicio,
} from "@/lib/parientes";
import { BotonPrimario } from "@/components/ui";
import { Campo, MensajeError, type EstadoFormulario } from "@/components/fincas/campo";
import { CATEGORIAS, ESTADOS_ANIMAL, GRUPOS_CATEGORIA, METODOS_ADQUISICION, SEXOS } from "@/components/fincas/etiquetas";
import type { FincaConCodigos } from "@/components/fincas/consultas";

type Animal = Database["public"]["Tables"]["animales"]["Row"];

const PADRE_OTRO = "__otro__";

const textoCategoria = (c: string) => (CATEGORIAS as Record<string, string>)[c] ?? c;
const textoEstado = (e: string) => (ESTADOS_ANIMAL as Record<string, string>)[e] ?? e;

function Opcion({ c }: { c: Candidato }) {
  return (
    <option value={c.id}>
      {c.nombre}
      {c.chapeta ? ` · ${c.chapeta}` : ""} · {textoCategoria(c.categoria)}
      {c.estado !== "activo" ? ` (${textoEstado(c.estado).toLowerCase()})` : ""}
    </option>
  );
}

export function FormularioAnimal({
  accion,
  fincas,
  candidatos,
  torosServicios,
  animal,
  fincaInicial,
  cancelar,
}: {
  accion: (estado: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;
  fincas: FincaConCodigos[];
  /** Animales de las fincas de la sesión (madre/padre se filtran por finca, especie y sexo). */
  candidatos: Candidato[];
  torosServicios: ToroServicio[];
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
  const [categoria, setCategoria] = useState<string>(categoriaFormulario(animal?.categoria));
  const [sexoElegido, setSexoElegido] = useState<string>(animal?.sexo ?? "hembra");

  const listas = (finca: string, cat: string) => {
    const ctx = { fincaId: finca, categoria: cat, excluirId: animal?.id };
    const padres = padresPosibles(candidatos, ctx);
    const servicios = torosDeServiciosPosibles(torosServicios, padres, ctx);
    return { madres: madresPosibles(candidatos, ctx), padres, servicios, nombresPadre: new Set([...padres, ...servicios].map((p) => p.nombre)) };
  };
  const { madres, padres, servicios, nombresPadre } = listas(fincaId, categoria);

  const [madreId, setMadreId] = useState(animal?.madre_id && madres.some((m) => m.id === animal.madre_id) ? animal.madre_id : "");
  const padreInicial = animal?.padre_nombre ?? "";
  const [padre, setPadre] = useState(!padreInicial || nombresPadre.has(padreInicial) ? padreInicial : PADRE_OTRO);

  const sexoFijo = sexoDeCategoria(categoria);
  const especie = especieDeCategoria(categoria);
  const bovino = especie === "bovino";

  /** Al cambiar finca o categoría se limpian madre y padre que ya no son compatibles. */
  const reajustar = (finca: string, cat: string) => {
    const nuevas = listas(finca, cat);
    if (madreId && !nuevas.madres.some((m) => m.id === madreId)) setMadreId("");
    if (padre && padre !== PADRE_OTRO && !nuevas.nombresPadre.has(padre)) setPadre("");
  };

  const prefijo = fincas.find((f) => f.id === fincaId)?.prefijo ?? "";
  const sugerido = chapeta.trim() ? `${prefijo}-${chapeta.trim()}` : "";
  const codigoMostrado = codigoManual ? codigo : sugerido;
  const metodoGuardado = animal?.metodo_adquisicion;
  const metodos = metodoGuardado && !METODOS_ADQUISICION.includes(metodoGuardado) ? [...METODOS_ADQUISICION, metodoGuardado] : METODOS_ADQUISICION;
  const v = (x: string | number | null | undefined) => (x == null ? "" : String(x));

  const madresAdultas = bovino ? madres.filter((m) => ["vaca", "novilla"].includes(m.categoria)) : madres;
  const madresJovenes = bovino ? madres.filter((m) => !["vaca", "novilla"].includes(m.categoria)) : [];

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
                reajustar(ev.target.value, categoria);
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
            <select
              name="categoria"
              value={categoria}
              onChange={(ev) => {
                setCategoria(ev.target.value);
                reajustar(fincaId, ev.target.value);
              }}
              className="campo-control"
              required
            >
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
          <Campo etiqueta="Sexo" error={e.sexo} ayuda={sexoFijo ? "Lo define la categoría" : undefined}>
            {sexoFijo && <input type="hidden" name="sexo" value={sexoFijo} />}
            <select
              name={sexoFijo ? undefined : "sexo"}
              value={sexoFijo ?? sexoElegido}
              onChange={(ev) => setSexoElegido(ev.target.value)}
              disabled={!!sexoFijo}
              className="campo-control disabled:opacity-70"
            >
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
            <input name="raza" defaultValue={v(animal?.raza)} className="campo-control" placeholder={bovino ? "Holstein, Jersey…" : undefined} />
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
          <Campo
            etiqueta="Madre en la finca"
            error={e.madre_id}
            ayuda={madres.length === 0 ? `No hay hembras de la misma especie (${textoCategoria(categoria).toLowerCase()}) en la finca.` : "Hembras de la misma especie"}
          >
            <select name="madre_id" value={madreId} onChange={(ev) => setMadreId(ev.target.value)} className="campo-control">
              <option value="">— No está en la finca —</option>
              {bovino ? (
                <>
                  {madresAdultas.length > 0 && (
                    <optgroup label="Vacas y novillas">
                      {madresAdultas.map((c) => (
                        <Opcion key={c.id} c={c} />
                      ))}
                    </optgroup>
                  )}
                  {madresJovenes.length > 0 && (
                    <optgroup label="Otras hembras">
                      {madresJovenes.map((c) => (
                        <Opcion key={c.id} c={c} />
                      ))}
                    </optgroup>
                  )}
                </>
              ) : (
                madres.map((c) => <Opcion key={c.id} c={c} />)
              )}
            </select>
          </Campo>
          <Campo etiqueta={bovino ? "Padre (toro)" : "Padre"} error={e.padre_nombre} ayuda="Machos de la misma especie">
            <select name="padre_nombre" value={padre} onChange={(ev) => setPadre(ev.target.value)} className="campo-control">
              <option value="">— Sin registrar —</option>
              {padres.length > 0 && (
                <optgroup label={bovino ? "Toros y novillos de la finca" : "Machos de la finca"}>
                  {padres.map((p) => (
                    <option key={p.id} value={p.nombre}>
                      {p.nombre}
                      {p.chapeta ? ` · ${p.chapeta}` : ""} · {textoCategoria(p.categoria)}
                      {p.estado !== "activo" ? ` (${textoEstado(p.estado).toLowerCase()})` : ""}
                    </option>
                  ))}
                </optgroup>
              )}
              {servicios.length > 0 && (
                <optgroup label="Toros usados en servicios">
                  {servicios.map((t) => (
                    <option key={`servicio-${t.nombre}`} value={t.nombre}>
                      {t.nombre}
                    </option>
                  ))}
                </optgroup>
              )}
              <option value={PADRE_OTRO}>Otro (escribir nombre)</option>
            </select>
          </Campo>
          {padre === PADRE_OTRO && (
            <Campo etiqueta={bovino ? "Nombre o registro del toro *" : "Nombre o registro del padre *"} error={e.padre_otro}>
              <input
                name="padre_otro"
                required
                autoFocus={!animal}
                defaultValue={padreInicial && !nombresPadre.has(padreInicial) ? padreInicial : ""}
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

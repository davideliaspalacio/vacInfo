"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import clsx from "clsx";
import { ChevronDown, CircleAlert, Save } from "lucide-react";
import { Campo, CampoFecha, Casilla, JORNADAS, Opciones, SI_NO, control } from "@/components/campo/ui";
import { esLevante } from "@/components/levante/etiquetas";
import { CUARTOS, TIPOS_SALUD, validarDatos } from "@/lib/offline/esquemas";
import { ETIQUETA_ACCION } from "@/lib/offline/resumen";
import type { Accion, AnimalCatalogo, Catalogo } from "@/lib/offline/tipos";

export type Guardar = (accion: Accion, datos: Record<string, unknown>) => Promise<void>;

function leerFormulario(form: HTMLFormElement) {
  const fd = new FormData(form);
  const datos: Record<string, unknown> = {};
  for (const clave of new Set(fd.keys())) {
    const valores = fd.getAll(clave).filter((v): v is string => typeof v === "string");
    datos[clave] = valores.length > 1 ? valores : valores[0];
  }
  return datos;
}

export const jornadaActual = () => (new Date().getHours() < 12 ? "am" : "pm");

export function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={clsx(
        "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-bold",
        activo ? "border-campo bg-campo text-white" : "border-slate-300 bg-white text-slate-700",
      )}
    >
      {children}
    </button>
  );
}

export function FormaRapida({
  accion,
  fijos,
  alGuardar,
  titulo,
  descripcion,
  boton,
  revisar,
  children,
}: {
  accion: Accion;
  fijos: Record<string, string>;
  alGuardar: Guardar;
  titulo?: string;
  descripcion?: string;
  boton?: string;
  /** Validación adicional con los datos ya limpios; devuelve el mensaje de error o null. */
  revisar?: (datos: Record<string, unknown>) => string | null;
  children: ReactNode;
}) {
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const leido = validarDatos(accion, { ...leerFormulario(form), ...fijos });
    if (!leido.ok) return setError(leido.mensaje);
    const problema = revisar?.(leido.datos);
    if (problema) return setError(problema);

    setGuardando(true);
    try {
      await alGuardar(accion, leido.datos);
      setError(null);
      form.reset();
    } catch {
      setError("No se pudo guardar en el teléfono. Revisa que haya espacio disponible.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <h2 className="font-display text-xl font-bold text-slate-900">{titulo ?? ETIQUETA_ACCION[accion]}</h2>
      {descripcion && <p className="-mt-2 text-sm text-slate-500">{descripcion}</p>}
      {children}
      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 font-semibold text-red-800">
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={guardando}
        className="flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl bg-campo text-lg font-bold text-white shadow-lg shadow-campo/25 disabled:opacity-60"
      >
        <Save className="h-5 w-5" aria-hidden />
        {guardando ? "Guardando…" : (boton ?? "Guardar")}
      </button>
      <p className="-mt-2 text-center text-xs text-slate-500">Queda guardado en el teléfono y se envía cuando haya señal.</p>
    </form>
  );
}

export function Texto({
  etiqueta,
  name,
  placeholder,
  lista,
  requerido,
  tipo = "text",
}: {
  etiqueta: string;
  name: string;
  placeholder?: string;
  lista?: string;
  requerido?: boolean;
  tipo?: "text" | "tel" | "time";
}) {
  return (
    <Campo etiqueta={etiqueta}>
      <input type={tipo} name={name} placeholder={placeholder} list={lista} required={requerido} autoComplete="off" className={control} />
    </Campo>
  );
}

export function Observaciones({ name = "observaciones", etiqueta = "Observaciones", requerido }: { name?: string; etiqueta?: string; requerido?: boolean }) {
  return (
    <Campo etiqueta={etiqueta}>
      <textarea name={name} rows={2} required={requerido} className={`${control} resize-none`} />
    </Campo>
  );
}

export function Numero({
  etiqueta,
  name,
  requerido,
  grande,
  paso = "0.1",
  min = "0",
}: {
  etiqueta: string;
  name: string;
  requerido?: boolean;
  grande?: boolean;
  paso?: string;
  min?: string;
}) {
  return (
    <Campo etiqueta={etiqueta}>
      <input
        name={name}
        type="number"
        inputMode={paso === "1" ? "numeric" : "decimal"}
        step={paso}
        min={min}
        required={requerido}
        placeholder="0"
        className={clsx(control, grande && "text-2xl font-bold")}
      />
    </Campo>
  );
}

export function Selector({
  etiqueta,
  name,
  opciones,
  requerido,
  vacio = "Ninguno",
}: {
  etiqueta: string;
  name: string;
  opciones: { valor: string; etiqueta: string }[];
  requerido?: boolean;
  vacio?: string;
}) {
  return (
    <Campo etiqueta={etiqueta}>
      <select name={name} required={requerido} defaultValue="" className={control}>
        <option value="" disabled={requerido}>
          {requerido ? "Elige una opción" : vacio}
        </option>
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.etiqueta}
          </option>
        ))}
      </select>
    </Campo>
  );
}

// ─────────────────────────── Animal ───────────────────────────
export const ACCIONES_ANIMAL = ["ordeno", "servicio", "palpacion", "parto", "secado", "destete", "salud", "baja"] as const;
export type AccionAnimal = (typeof ACCIONES_ANIMAL)[number];

const SOLO_HEMBRAS: AccionAnimal[] = ["ordeno", "servicio", "palpacion", "parto", "secado"];

export const ETIQUETA_ACCION_ANIMAL: Record<AccionAnimal, string> = {
  ordeno: "Ordeño",
  servicio: "Servicio",
  palpacion: "Palpación",
  parto: "Parto / cría",
  secado: "Secado",
  destete: "Destete",
  salud: "Salud",
  baja: "Muerte / venta / retiro",
};

export function accionesDe(animal: AnimalCatalogo): AccionAnimal[] {
  return ACCIONES_ANIMAL.filter((a) => {
    if (SOLO_HEMBRAS.includes(a)) return animal.sexo === "hembra";
    if (a === "destete") return esLevante(animal.categoria) && !animal.fecha_destete;
    return true;
  });
}

const ETIQUETA_SALUD: Record<(typeof TIPOS_SALUD)[number], string> = {
  vacuna: "Vacuna",
  enfermedad: "Enfermedad",
  tratamiento: "Tratamiento",
  mastitis: "Mastitis",
  cojera: "Cojera",
  fiebre: "Fiebre",
  entamborada: "Entamborada",
  fiebre_leche: "Fiebre de leche",
  cirugia: "Cirugía",
  desparasitacion: "Desparasitación",
};

const NOMBRE_CUARTO: Record<(typeof CUARTOS)[number], string> = {
  TDD: "TDD · trasero derecho",
  TDI: "TDI · trasero izquierdo",
  TTD: "TTD · delantero derecho",
  TTI: "TTI · delantero izquierdo",
};

function FormularioSalud({ animalId, insumos, alGuardar }: { animalId: string; insumos: Catalogo["insumos"]; alGuardar: Guardar }) {
  const [tipo, setTipo] = useState<(typeof TIPOS_SALUD)[number]>("vacuna");
  const medicamentos = insumos.filter((i) => i.categoria === "medicamento");

  return (
    <FormaRapida
      accion="salud"
      fijos={{ animal_id: animalId, tipo }}
      alGuardar={alGuardar}
      revisar={(d) => ((tipo === "vacuna" || tipo === "tratamiento") && !d.producto ? "Escribe el producto aplicado." : null)}
    >
      <div className="flex flex-wrap gap-2">
        {TIPOS_SALUD.map((t) => (
          <Chip key={t} activo={t === tipo} onClick={() => setTipo(t)}>
            {ETIQUETA_SALUD[t]}
          </Chip>
        ))}
      </div>
      <CampoFecha />
      {tipo === "mastitis" && (
        <fieldset>
          <legend className="mb-2 font-bold text-slate-800">Cuartos afectados</legend>
          <div className="grid grid-cols-1 gap-2">
            {CUARTOS.map((c) => (
              <Casilla key={c} name="cuartos" value={c} etiqueta={NOMBRE_CUARTO[c]} />
            ))}
          </div>
        </fieldset>
      )}
      {tipo !== "vacuna" && <Texto etiqueta="Diagnóstico" name="diagnostico" />}
      <Texto etiqueta={tipo === "vacuna" ? "Vacuna" : "Producto aplicado"} name="producto" lista="vacdata-medicamentos" />
      <datalist id="vacdata-medicamentos">
        {medicamentos.map((m) => (
          <option key={m.nombre} value={m.nombre} />
        ))}
      </datalist>
      <div className="grid grid-cols-2 gap-3">
        <Texto etiqueta="Lote" name="lote" />
        <Texto etiqueta="Registro ICA" name="registro_ica" />
        <Texto etiqueta="Dosis" name="dosis" placeholder="5 ml" />
        <Texto etiqueta="Vía" name="via_administracion" lista="vacdata-vias" />
      </div>
      <datalist id="vacdata-vias">
        {["Intramuscular", "Subcutánea", "Intravenosa", "Intramamaria", "Oral", "Tópica"].map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      {tipo === "vacuna" ? (
        <CampoFecha etiqueta="Próxima dosis" name="proxima_fecha" defecto="" requerido={false} />
      ) : (
        <Numero etiqueta="Días de retiro de leche" name="dias_retiro" paso="1" />
      )}
      <div className="grid grid-cols-2 gap-3">
        <Texto etiqueta="Veterinario" name="veterinario" />
        <Texto etiqueta="T.P. veterinario" name="tarjeta_profesional" />
      </div>
      <Texto etiqueta="Operario" name="operario" />
      <Observaciones />
    </FormaRapida>
  );
}

/** Nombre del toro: lista de toros conocidos que se despliega, o un nombre nuevo escrito a mano. */
function CampoToro({ toros }: { toros: string[] }) {
  const entrada = useRef<HTMLInputElement>(null);
  const [abierta, setAbierta] = useState(false);
  const [elegido, setElegido] = useState("");

  return (
    <div>
      <Campo etiqueta="Nombre del toro">
        <input
          ref={entrada}
          name="toro_nombre"
          list="vacdata-toros"
          autoComplete="off"
          onChange={(e) => setElegido(e.target.value)}
          placeholder={toros.length ? "Elige de la lista o escribe uno nuevo" : undefined}
          className={control}
        />
      </Campo>
      <datalist id="vacdata-toros">
        {toros.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      {toros.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setAbierta(!abierta)}
            aria-expanded={abierta}
            className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-campo"
          >
            <ChevronDown className={clsx("h-4 w-4 transition", abierta && "rotate-180")} aria-hidden />
            {abierta ? "Ocultar toros conocidos" : `Ver toros conocidos (${toros.length})`}
          </button>
          {abierta && (
            <div className="mt-1 flex flex-wrap gap-2">
              {toros.map((t) => (
                <Chip
                  key={t}
                  activo={t === elegido}
                  onClick={() => {
                    if (entrada.current) entrada.current.value = t;
                    setElegido(t);
                    setAbierta(false);
                  }}
                >
                  {t}
                </Chip>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function FormularioAnimalRapido({
  accion,
  animal,
  catalogo,
  alGuardar,
}: {
  accion: AccionAnimal;
  animal: AnimalCatalogo;
  catalogo: Catalogo;
  alGuardar: Guardar;
}) {
  const [jornada] = useState(jornadaActual);
  const fijos = { animal_id: animal.id };

  switch (accion) {
    case "ordeno":
      return (
        <FormaRapida accion="ordeno" fijos={fijos} alGuardar={alGuardar}>
          <CampoFecha />
          <Opciones etiqueta="Jornada" name="jornada" opciones={JORNADAS} defecto={jornada} requerido />
          <Numero etiqueta="Litros" name="litros" requerido grande />
        </FormaRapida>
      );
    case "servicio":
      return (
        <FormaRapida accion="servicio" fijos={fijos} alGuardar={alGuardar} descripcion="La palpación queda programada 33 días después.">
          <CampoFecha />
          <Opciones
            etiqueta="Tipo de servicio"
            name="tipo"
            opciones={[
              { valor: "inseminacion", etiqueta: "Inseminación" },
              { valor: "monta", etiqueta: "Monta de toro" },
            ]}
            defecto="inseminacion"
            requerido
          />
          <Opciones etiqueta="Jornada" name="jornada" opciones={JORNADAS} />
          <CampoToro toros={catalogo.toros} />
          <Texto etiqueta="Raza del toro" name="toro_raza" placeholder="Holstein, Jersey…" />
          <Texto etiqueta="Inseminador" name="inseminador" />
          <Observaciones />
        </FormaRapida>
      );
    case "palpacion":
      return (
        <FormaRapida accion="palpacion" fijos={fijos} alGuardar={alGuardar}>
          <CampoFecha />
          <Opciones
            etiqueta="Resultado"
            name="resultado"
            opciones={[
              { valor: "prenada", etiqueta: "Preñada" },
              { valor: "vacia", etiqueta: "Vacía" },
            ]}
            requerido
          />
          <Numero etiqueta="Días de preñez (si quedó preñada)" name="dias_prenez" paso="1" />
          <Texto etiqueta="Veterinario" name="veterinario" />
          <Observaciones />
        </FormaRapida>
      );
    case "parto":
      return (
        <FormaRapida accion="parto" fijos={fijos} alGuardar={alGuardar} titulo="Parto / cría">
          <CampoFecha />
          <Opciones
            etiqueta="Sexo de la cría"
            name="cria_sexo"
            opciones={[
              { valor: "hembra", etiqueta: "Hembra" },
              { valor: "macho", etiqueta: "Macho" },
            ]}
          />
          <Texto etiqueta="Raza de la cría" name="cria_raza" />
          <Opciones
            etiqueta="¿Parió de día o de noche?"
            name="en_la_noche"
            opciones={[
              { valor: "no", etiqueta: "De día" },
              { valor: "si", etiqueta: "De noche" },
            ]}
          />
          <Opciones etiqueta="¿Nació viva?" name="nacido_vivo" opciones={SI_NO} defecto="si" />
          <Casilla name="aborto" etiqueta="Fue un aborto" />
          <Opciones etiqueta="¿Tomó calostro?" name="toma_calostro" opciones={SI_NO} />
          <Texto etiqueta="Persona que la vio tomar calostro" name="persona_calostro" />
          <Opciones etiqueta="¿Expulsó la placenta?" name="placenta_expulsada" opciones={SI_NO} />
          <Opciones etiqueta="¿Se hizo lavado?" name="lavado" opciones={SI_NO} />
          <Observaciones />
          <fieldset className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50/50 p-4">
            <Casilla name="registrar_cria" etiqueta="Registrar la cría" defecto />
            <p className="text-sm text-slate-600">Crea la ficha de la ternera o ternero al enviar. No se crea si fue aborto o nació muerta. Elige el sexo arriba.</p>
            <Campo etiqueta="Nombre de la cría">
              <input name="cria_nombre" defaultValue={`Cría de ${animal.nombre}`} className={control} />
            </Campo>
            <Campo etiqueta="Chapeta de la cría (opcional)">
              <input name="cria_chapeta" inputMode="numeric" autoComplete="off" className={control} />
            </Campo>
          </fieldset>
        </FormaRapida>
      );
    case "secado":
      return (
        <FormaRapida accion="secado" fijos={fijos} alGuardar={alGuardar} descripcion="La vaca deja de ordeñarse hasta el próximo parto.">
          <CampoFecha />
          <Texto etiqueta="Motivo" name="motivo" placeholder="7 meses de preñez" lista="vacdata-motivos-secado" />
          <datalist id="vacdata-motivos-secado">
            <option value="7 meses de preñez" />
            <option value="Baja producción" />
            <option value="Enfermedad" />
          </datalist>
        </FormaRapida>
      );
    case "destete":
      return (
        <FormaRapida accion="destete" fijos={fijos} alGuardar={alGuardar} descripcion="La cría deja de tomar leche y pasa a levante." boton="Registrar destete">
          <CampoFecha etiqueta="Fecha del destete" />
        </FormaRapida>
      );
    case "salud":
      return <FormularioSalud animalId={animal.id} insumos={catalogo.insumos} alGuardar={alGuardar} />;
    case "baja":
      return (
        <FormaRapida accion="baja" fijos={fijos} alGuardar={alGuardar} descripcion="El animal quedará fuera del inventario activo." boton="Registrar salida">
          <CampoFecha />
          <Opciones
            etiqueta="Tipo"
            name="tipo"
            columnas={3}
            opciones={[
              { valor: "muerte", etiqueta: "Muerte" },
              { valor: "venta", etiqueta: "Venta" },
              { valor: "retiro", etiqueta: "Retiro" },
            ]}
            requerido
          />
          <Texto etiqueta="Causa o motivo" name="causa" placeholder="Enfermedad, baja producción…" />
          <Texto etiqueta="Quién lo lleva" name="responsable_traslado" />
          <Numero etiqueta="Valor de venta (opcional)" name="valor" paso="1" />
        </FormaRapida>
      );
  }
}

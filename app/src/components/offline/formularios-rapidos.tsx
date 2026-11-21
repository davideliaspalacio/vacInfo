"use client";

import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import clsx from "clsx";
import { ChevronDown, CircleAlert, CircleCheck, LoaderCircle, Save } from "lucide-react";
import { Campo, CampoFecha, Casilla, JORNADAS, Opciones, SI_NO, control } from "@/components/campo/ui";
import { clasesGuardar } from "@/components/campo/boton-guardar";
import { hoyISO } from "@/lib/formato";
import { RegistroRechazadoError } from "@/lib/offline/cliente";
import { CUARTOS, TIPOS_SALUD, validarDatos } from "@/lib/offline/esquemas";
import { jornadaLibre, resumenDiaOrdeno, textoJornadasCompletas, textoLitros, textoYaOrdenada, yaOrdenada } from "@/lib/offline/ordenos";
import { ETIQUETA_ACCION, formatoNumero } from "@/lib/offline/resumen";
import { MAX_DOSIS_DIA, dosisDelDia, revisarDosisServicio, textoDosisDia, textoExcesoDosis } from "@/lib/offline/servicios";
import type { Accion, AnimalCatalogo, Catalogo, Jornada } from "@/lib/offline/tipos";

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

/**
 * ¿La finca tiene activo el «relleno de registros de ordeño faltantes»?
 * Con la función activa, el ordeño se registra siempre sobre el día actual y no se muestra el
 * selector de fecha (los días que falten los completa la base con el dato que se acaba de guardar).
 *
 * El dato viaja en el catálogo que el teléfono ya descargó, así que la respuesta funciona sin señal.
 * Se lee opcional a propósito: los catálogos descargados antes de que el campo existiera no lo
 * traen, y sin él se mantiene el comportamiento de siempre (se puede elegir la fecha).
 */
export const rellenoOrdenosActivo = (catalogo: Catalogo) => (catalogo as Catalogo & { relleno_ordenos?: boolean }).relleno_ordenos === true;

/** Aviso que reemplaza al selector de fecha cuando la finca rellena los ordeños faltantes. */
export function AvisoRellenoOrdenos() {
  return (
    <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
      Esta finca completa los ordeños faltantes: el registro va sobre <strong>hoy</strong> y los días que quedaron sin registrar se llenan solos con
      estos litros. Por eso no se puede elegir otra fecha.
    </p>
  );
}

export function Chip({
  activo,
  onClick,
  bloqueado,
  motivo,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  /** Deshabilitado: `motivo` explica por qué (se lee en el título y con lectores de pantalla). */
  bloqueado?: boolean;
  motivo?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      disabled={bloqueado}
      title={bloqueado ? motivo : undefined}
      aria-label={bloqueado && motivo && typeof children === "string" ? `${children} · ${motivo}` : undefined}
      className={clsx(
        "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-bold",
        bloqueado
          ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
          : activo
            ? "border-campo bg-campo text-white"
            : "border-slate-300 bg-white text-slate-700",
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
  bloqueado,
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
  /** Motivo por el que no se puede guardar (p. ej. ordeño ya registrado): deshabilita el botón y lo explica. */
  bloqueado?: string | null;
  children: ReactNode;
}) {
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  // Solo parpadea cuando hay datos escritos sin guardar.
  const [sucio, setSucio] = useState(false);
  const idAviso = useId();

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (bloqueado) return setError(bloqueado);
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
      setSucio(false);
    } catch (e) {
      setError(e instanceof RegistroRechazadoError ? e.message : "No se pudo guardar en el teléfono. Revisa que haya espacio disponible.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={enviar} onInput={() => setSucio(true)} onChange={() => setSucio(true)} className="space-y-4">
      <h2 className="font-display text-xl font-bold text-slate-900">{titulo ?? ETIQUETA_ACCION[accion]}</h2>
      {descripcion && <p className="-mt-2 text-sm text-slate-500">{descripcion}</p>}
      {children}
      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 font-semibold text-red-800">
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          {error}
        </p>
      )}
      {bloqueado && (
        <p id={idAviso} className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 font-semibold text-amber-900">
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          {bloqueado}
        </p>
      )}
      <button
        type="submit"
        disabled={guardando || Boolean(bloqueado)}
        aria-describedby={bloqueado ? idAviso : undefined}
        className={clasesGuardar(sucio && !guardando && !bloqueado, "min-h-16")}
      >
        {guardando ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden /> : <Save className="h-5 w-5" aria-hidden />}
        {guardando ? "Guardando…" : (boton ?? "Guardar")}
      </button>
      <p className="-mt-2 text-center text-xs text-slate-500">
        {sucio && !bloqueado ? "Tienes datos sin guardar: toca Guardar para que no se pierdan." : "Queda guardado en el teléfono y se envía cuando haya señal."}
      </p>
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
// Sin «destete»: el destete lo genera solo el sistema con `fincas.dias_destete`, no se registra.
// La acción `destete` sigue viva en la cola y en el servidor (src/lib/offline/tipos.ts) para los
// teléfonos con la app vieja en caché que todavía tengan un destete encolado sin señal.
export const ACCIONES_ANIMAL = ["ordeno", "servicio", "palpacion", "parto", "secado", "salud", "baja"] as const;
export type AccionAnimal = (typeof ACCIONES_ANIMAL)[number];

const SOLO_HEMBRAS: AccionAnimal[] = ["ordeno", "servicio", "palpacion", "parto", "secado"];

export const ETIQUETA_ACCION_ANIMAL: Record<AccionAnimal, string> = {
  ordeno: "Ordeño",
  servicio: "Servicio",
  palpacion: "Palpación",
  parto: "Parto / cría",
  secado: "Secado",
  salud: "Salud",
  baja: "Muerte / venta / retiro",
};

export function accionesDe(animal: AnimalCatalogo): AccionAnimal[] {
  return ACCIONES_ANIMAL.filter((a) => {
    if (SOLO_HEMBRAS.includes(a)) return animal.sexo === "hembra";
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
function CampoToro({ toros, name = "toro_nombre", etiqueta = "Nombre del toro" }: { toros: string[]; name?: string; etiqueta?: string }) {
  const entrada = useRef<HTMLInputElement>(null);
  const [abierta, setAbierta] = useState(false);
  const [elegido, setElegido] = useState("");
  // Un datalist por campo: dos <datalist> con el mismo id en la página no es válido.
  const lista = `vacdata-toros-${name}`;

  return (
    <div>
      <Campo etiqueta={etiqueta}>
        <input
          ref={entrada}
          name={name}
          list={lista}
          autoComplete="off"
          onChange={(e) => setElegido(e.target.value)}
          placeholder={toros.length ? "Elige de la lista o escribe uno nuevo" : undefined}
          className={control}
        />
      </Campo>
      <datalist id={lista}>
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

/**
 * Casilla que la pantalla necesita leer mientras se llena (la de `campo/ui` es sin estado).
 * Misma apariencia que `Casilla` para que el trabajador no vea dos estilos de casilla.
 */
function CasillaControlada({
  name,
  etiqueta,
  marcada,
  alCambiar,
}: {
  name: string;
  etiqueta: string;
  marcada: boolean;
  alCambiar: (valor: boolean) => void;
}) {
  return (
    <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 font-bold text-slate-700 has-checked:border-campo has-checked:bg-blue-50 has-checked:text-campo-oscuro">
      <input type="checkbox" name={name} checked={marcada} onChange={(e) => alCambiar(e.target.checked)} className="h-6 w-6 accent-campo" />
      {etiqueta}
    </label>
  );
}

/**
 * Servicio con una o dos pajillas.
 *
 * El cliente: «cuando se realiza un servicio real se pueden introducir dos pajillas de diferentes
 * toros a la vaca (esperando que una logre fecundar) en el mismo horario […] solo se permiten dos
 * dosis de pajillas por día, sin importar la hora ni la cantidad: el máximo son 2 por día».
 *
 * El toro 2 es opcional: mientras no se abra, el formulario se envía igual que siempre. El tope de
 * 2 dosis se cuenta con las dosis que el teléfono ya conoce de ese día (catálogo + cola + historial),
 * así que avisa igual sin señal; `encolar` lo revisa otra vez al guardar y la función
 * `registrar_servicio` de la base es el respaldo final.
 */
function FormularioServicio({
  animal,
  toros,
  indice,
  alGuardar,
}: {
  animal: AnimalCatalogo;
  toros: string[];
  indice: Set<string>;
  alGuardar: Guardar;
}) {
  const hoy = hoyISO();
  const [fecha, setFecha] = useState(hoy);
  const [segundo, setSegundo] = useState(false);
  const yaTiene = dosisDelDia(indice, animal.id, fecha);
  const nuevas = segundo ? 2 : 1;

  return (
    <FormaRapida
      accion="servicio"
      fijos={{ animal_id: animal.id, fecha }}
      alGuardar={alGuardar}
      descripcion="La palpación queda programada 33 días después."
      revisar={(d) => revisarDosisServicio("servicio", d, indice, hoy)}
      bloqueado={yaTiene + nuevas > MAX_DOSIS_DIA ? textoExcesoDosis(yaTiene, nuevas, fecha, hoy) : null}
    >
      <Campo etiqueta="Fecha">
        <input type="date" value={fecha} max={hoy} onChange={(e) => e.target.value && setFecha(e.target.value)} className={control} />
      </Campo>
      {yaTiene > 0 && yaTiene + nuevas <= MAX_DOSIS_DIA && (
        <p role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
          {textoDosisDia(yaTiene, fecha, hoy)} Esta sería la última: el máximo son {MAX_DOSIS_DIA} por día.
        </p>
      )}
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
      <CampoToro toros={toros} />
      <Texto etiqueta="Raza del toro" name="toro_raza" placeholder="Holstein, Jersey…" />
      <fieldset className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50/50 p-4">
        <CasillaControlada name="segunda_pajilla" etiqueta="Se puso una segunda pajilla de otro toro" marcada={segundo} alCambiar={setSegundo} />
        <p className="text-sm text-slate-600">
          Solo si a la vaca se le pusieron dos pajillas de toros distintos. El máximo son {MAX_DOSIS_DIA} dosis por día, sin importar la hora.
        </p>
        {segundo && (
          <>
            <CampoToro toros={toros} name="toro2_nombre" etiqueta="Nombre del toro 2" />
            <Texto etiqueta="Raza del toro 2" name="toro2_raza" placeholder="Holstein, Jersey…" />
          </>
        )}
      </fieldset>
      <Texto etiqueta="Inseminador" name="inseminador" />
      <Observaciones />
    </FormaRapida>
  );
}

/**
 * Lo que ya quedó registrado del día: los litros de cada jornada y el total.
 *
 * El cliente lo pidió así: «incluso después de realizar los respectivos ordeños del día (AM y PM)
 * se pueda acceder a la sección de ordeño; esta no debe permitir hacer más registros de ordeño
 * (si ya fueron realizados) pero sí debe permitir observar la cantidad registrada en cada horario
 * y el total del día».
 *
 * Todo sale del índice que armó el teléfono (catálogo descargado + cola + historial), así que se ve
 * igual sin señal. Si el catálogo es de una versión anterior y no trae la cantidad, la jornada se
 * muestra como registrada y se dice que falta el dato en vez de mostrar un cero falso.
 */
function OrdenoDelDia({ dia, fecha, hoy }: { dia: ReturnType<typeof resumenDiaOrdeno>; fecha: string; hoy: string }) {
  return (
    <section aria-label="Ordeño registrado" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
      <h3 className="mb-2 font-bold text-emerald-900">Ordeño registrado {fecha === hoy ? "hoy" : `el ${fecha}`}</h3>
      <dl className="space-y-1.5">
        {dia.jornadas.map((j) => (
          <div key={j.jornada} className="flex items-baseline justify-between gap-3">
            <dt className="font-semibold text-emerald-900">{j.jornada === "am" ? "Mañana (AM)" : "Tarde (PM)"}</dt>
            <dd className={clsx("text-lg font-bold", j.registrada ? "text-emerald-900" : "text-slate-500")}>
              {j.registrada ? (
                <span className="inline-flex items-center gap-1.5">
                  <CircleCheck className="h-4 w-4" aria-hidden />
                  {textoLitros(j.litros)}
                </span>
              ) : (
                "sin registrar"
              )}
            </dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-3 border-t border-emerald-200 pt-1.5">
          <dt className="font-bold text-emerald-900">Total del día</dt>
          <dd className="text-xl font-bold text-emerald-900">{dia.total == null ? "sin el dato de litros" : `${formatoNumero(dia.total)} L`}</dd>
        </div>
      </dl>
      {dia.incompletos && dia.total != null && (
        <p className="mt-2 text-sm font-semibold text-emerald-900">El total es de las jornadas con dato; de alguna no se descargó la cantidad.</p>
      )}
    </section>
  );
}

/**
 * Ordeño de una vaca. Se puede abrir siempre: muestra lo que ya quedó registrado del día (litros de
 * cada jornada y total) y solo deja registrar la jornada que esté libre. Con las dos jornadas hechas
 * no hay formulario que enviar, solo lo registrado. Funciona sin señal.
 *
 * La revisión de repetidos no se debilita: la jornada ya registrada sale marcada y sin poder
 * elegirse, el botón Guardar queda deshabilitado con el motivo, `encolar` lo revisa otra vez contra
 * la cola y el historial, y el servidor tiene el índice único (animal_id, fecha, jornada).
 *
 * Con el relleno de ordeños faltantes activo en la finca no hay selector de fecha: se registra
 * siempre el día de hoy.
 */
function FormularioOrdeno({
  animal,
  indice,
  alGuardar,
  relleno,
}: {
  animal: AnimalCatalogo;
  indice: Set<string>;
  alGuardar: Guardar;
  relleno: boolean;
}) {
  const hoy = hoyISO();
  const [fecha, setFecha] = useState(hoy);
  const [jornada, setJornada] = useState<Jornada>(() => jornadaLibre(indice, animal.id, hoy, jornadaActual()) ?? jornadaActual());
  const registrada = (j: Jornada) => yaOrdenada(indice, animal.id, fecha, j);
  const dia = resumenDiaOrdeno(indice, animal.id, fecha);

  function cambiarFecha(nueva: string) {
    if (!nueva) return;
    setFecha(nueva);
    setJornada(jornadaLibre(indice, animal.id, nueva, jornada) ?? jornada);
  }

  const selectorFecha = relleno ? (
    <AvisoRellenoOrdenos />
  ) : (
    <Campo etiqueta="Fecha">
      <input type="date" value={fecha} max={hoy} onChange={(e) => cambiarFecha(e.target.value)} className={control} />
    </Campo>
  );

  // Las dos jornadas hechas: solo se ve lo registrado. Sin formulario no hay nada que enviar.
  if (dia.completo) {
    return (
      <div className="space-y-4">
        <h2 className="font-display text-xl font-bold text-slate-900">{ETIQUETA_ACCION.ordeno}</h2>
        {selectorFecha}
        <OrdenoDelDia dia={dia} fecha={fecha} hoy={hoy} />
        <p role="status" className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 font-semibold text-amber-900">
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          {textoJornadasCompletas(fecha, hoy)} No se puede registrar otro ordeño de esta vaca{relleno ? "" : " en esa fecha"}.
        </p>
      </div>
    );
  }

  return (
    <FormaRapida
      accion="ordeno"
      fijos={{ animal_id: animal.id, fecha, jornada }}
      alGuardar={alGuardar}
      bloqueado={registrada(jornada) ? textoYaOrdenada(fecha, jornada, hoy) : null}
    >
      {selectorFecha}
      {dia.cuantas > 0 && <OrdenoDelDia dia={dia} fecha={fecha} hoy={hoy} />}
      <fieldset>
        <legend className="mb-2 font-bold text-slate-800">Jornada</legend>
        <div className="flex flex-wrap gap-2">
          {JORNADAS.map((j) => {
            const valor = j.valor as Jornada;
            const ya = registrada(valor);
            return (
              <Chip
                key={valor}
                activo={jornada === valor}
                bloqueado={ya}
                motivo={ya ? textoYaOrdenada(fecha, valor, hoy) : undefined}
                onClick={() => setJornada(valor)}
              >
                {ya ? `${j.etiqueta} · ya registrada` : j.etiqueta}
              </Chip>
            );
          })}
        </div>
      </fieldset>
      <Numero etiqueta="Litros" name="litros" requerido grande />
    </FormaRapida>
  );
}

/**
 * Parto / cría.
 *
 * El cliente: «no tiene sentido que si selecciono la casilla de "fue aborto" me permita seleccionar
 * "sí" en "¿nació viva?". Si selecciono "fue aborto", automáticamente debe cerrarse la opción de
 * "sí" en "¿nació viva?" y también la pregunta de "¿tomó calostro?"».
 *
 * Con «Fue un aborto» marcado: «¿Nació viva?» queda en **No** sin poder cambiarse (el valor viaja en
 * `fijos`, porque un control deshabilitado no se envía) y las preguntas de calostro desaparecen, así
 * que tampoco se envían. Al desmarcar vuelve todo. El esquema deja coherente lo que llegue por otro
 * camino (una cola vieja): con `aborto` manda `nacido_vivo: false` y sin calostro.
 */
function FormularioParto({ animal, alGuardar }: { animal: AnimalCatalogo; alGuardar: Guardar }) {
  const [aborto, setAborto] = useState(false);

  return (
    <FormaRapida
      accion="parto"
      fijos={{ animal_id: animal.id, ...(aborto ? { aborto: "si", nacido_vivo: "no" } : {}) }}
      alGuardar={alGuardar}
      titulo="Parto / cría"
    >
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
      {aborto ? (
        <fieldset>
          <legend className="mb-2 font-bold text-slate-800">¿Nació viva?</legend>
          <p className="flex min-h-14 items-center gap-2 rounded-2xl border border-slate-300 bg-slate-100 px-4 font-bold text-slate-600">
            No · fue un aborto
          </p>
          <p className="mt-1.5 text-sm text-slate-500">Al marcar «Fue un aborto» esta respuesta queda en No y no se puede cambiar.</p>
        </fieldset>
      ) : (
        <Opciones etiqueta="¿Nació viva?" name="nacido_vivo" opciones={SI_NO} defecto="si" />
      )}
      {/* Controlada: al marcarla cambia lo que se muestra y lo que se envía. */}
      <CasillaControlada name="aborto" etiqueta="Fue un aborto" marcada={aborto} alCambiar={setAborto} />
      {!aborto && (
        <>
          <Opciones etiqueta="¿Tomó calostro?" name="toma_calostro" opciones={SI_NO} />
          <Texto etiqueta="Persona que la vio tomar calostro" name="persona_calostro" />
        </>
      )}
      <Opciones etiqueta="¿Expulsó la placenta?" name="placenta_expulsada" opciones={SI_NO} />
      <Opciones etiqueta="¿Se hizo lavado?" name="lavado" opciones={SI_NO} />
      <Observaciones />
      {!aborto && (
        <fieldset className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50/50 p-4">
          <Casilla name="registrar_cria" etiqueta="Registrar la cría" defecto />
          <p className="text-sm text-slate-600">Crea la ficha de la ternera o ternero al enviar. No se crea si nació muerta. Elige el sexo arriba.</p>
          <Campo etiqueta="Nombre de la cría">
            <input name="cria_nombre" defaultValue={`Cría de ${animal.nombre}`} className={control} />
          </Campo>
          <Campo etiqueta="Chapeta de la cría (opcional)">
            <input name="cria_chapeta" inputMode="numeric" autoComplete="off" className={control} />
          </Campo>
        </fieldset>
      )}
    </FormaRapida>
  );
}

export function FormularioAnimalRapido({
  accion,
  animal,
  catalogo,
  indice,
  alGuardar,
}: {
  accion: AccionAnimal;
  animal: AnimalCatalogo;
  catalogo: Catalogo;
  /** Ordeños que el teléfono ya conoce (catálogo + cola), para no repetir jornada. */
  indice: Set<string>;
  alGuardar: Guardar;
}) {
  const fijos = { animal_id: animal.id };

  switch (accion) {
    case "ordeno":
      return <FormularioOrdeno animal={animal} indice={indice} alGuardar={alGuardar} relleno={rellenoOrdenosActivo(catalogo)} />;
    case "servicio":
      return <FormularioServicio animal={animal} toros={catalogo.toros} indice={indice} alGuardar={alGuardar} />;
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
      return <FormularioParto animal={animal} alGuardar={alGuardar} />;
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

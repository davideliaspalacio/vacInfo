import { z } from "zod";
import { ACCIONES, type Accion } from "./tipos";

// Aceptan tanto valores de formulario ("12,5", "si", "on") como JSON ya limpio, para validar igual en el teléfono y en el servidor.
const limpiar = (v: unknown) => (typeof v === "string" ? (v.trim() === "" ? undefined : v.trim()) : (v ?? undefined));
const aNumero = (v: unknown) => {
  const x = limpiar(v);
  return typeof x === "string" ? Number(x.replace(",", ".")) : x;
};
const aBooleano = (v: unknown) => {
  const x = limpiar(v);
  if (x === true || x === "si" || x === "on" || x === "true") return true;
  if (x === false || x === "no" || x === "false") return false;
  return undefined;
};

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const uuid = z.string().regex(UUID);
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const texto = z.preprocess(limpiar, z.string().max(2000).optional());
const entero = z.preprocess(aNumero, z.number().int().min(0).max(100000).optional());
const booleano = z.preprocess(aBooleano, z.boolean().optional());
const kilos = z.preprocess(aNumero, z.number().min(0).max(100000).optional());
const jornada = z.enum(["am", "pm"]);
const litrosVaca = z.preprocess(aNumero, z.number().min(0).max(99));

export const TIPOS_SALUD = [
  "vacuna",
  "enfermedad",
  "tratamiento",
  "mastitis",
  "cojera",
  "fiebre",
  "entamborada",
  "fiebre_leche",
  "cirugia",
  "desparasitacion",
] as const;
export const CUARTOS = ["TDD", "TDI", "TTD", "TTI"] as const;

const delAnimal = { animal_id: uuid, fecha };
const deFinca = { finca_id: uuid, fecha };

export const ESQUEMAS = {
  ordeno: z.object({ ...delAnimal, jornada, litros: litrosVaca }),
  ordeno_lista: z.object({
    fecha,
    jornada,
    items: z.array(z.object({ animal_id: uuid, litros: litrosVaca })).min(1).max(500),
  }),
  servicio: z.object({
    ...delAnimal,
    tipo: z.enum(["inseminacion", "monta"]),
    toro_nombre: texto,
    toro_raza: texto,
    inseminador: texto,
    jornada: z.preprocess(limpiar, jornada.optional()),
    observaciones: texto,
  }),
  palpacion: z.object({
    ...delAnimal,
    resultado: z.enum(["prenada", "vacia"]),
    dias_prenez: entero,
    veterinario: texto,
    observaciones: texto,
  }),
  parto: z.object({
    ...delAnimal,
    cria_sexo: z.preprocess(limpiar, z.enum(["hembra", "macho"]).optional()),
    cria_raza: texto,
    nacido_vivo: booleano,
    aborto: booleano,
    toma_calostro: booleano,
    observaciones: texto,
  }),
  secado: z.object({ ...delAnimal, motivo: texto }),
  salud: z
    .object({
      ...delAnimal,
      tipo: z.enum(TIPOS_SALUD),
      diagnostico: texto,
      producto: texto,
      dosis: texto,
      dias_retiro: entero,
      cuartos: z.preprocess((v) => (v == null || v === "" ? [] : Array.isArray(v) ? v : [v]), z.array(z.enum(CUARTOS)).max(4)),
      observaciones: texto,
    })
    .refine((d) => d.tipo !== "mastitis" || d.cuartos.length > 0, { path: ["cuartos"] }),
  pesaje: z.object({ ...delAnimal, peso_kg: z.preprocess(aNumero, z.number().gt(0).max(2000)) }),
  carro_tanque: z.object({
    ...deFinca,
    litros: z.preprocess(aNumero, z.number().gt(0).max(1000000)),
    placa: texto,
    conductor: texto,
  }),
  consumo_diario: z
    .object({
      ...deFinca,
      kg_concentrado_vacas: kilos,
      kg_sal_vacas: kilos,
      kg_concentrado_terneras: kilos,
      kg_sal_terneras: kilos,
    })
    .refine((d) => [d.kg_concentrado_vacas, d.kg_sal_vacas, d.kg_concentrado_terneras, d.kg_sal_terneras].some((v) => v !== undefined), {
      path: ["kg_concentrado_vacas"],
    }),
} satisfies Record<Accion, z.ZodType>;

export type DatosDe<A extends Accion> = z.output<(typeof ESQUEMAS)[A]>;

export function esAccion(valor: unknown): valor is Accion {
  return typeof valor === "string" && (ACCIONES as readonly string[]).includes(valor);
}

const ETIQUETAS: Record<string, string> = {
  animal_id: "animal",
  finca_id: "finca",
  toro_nombre: "nombre del toro",
  toro_raza: "raza del toro",
  dias_prenez: "días de preñez",
  cria_sexo: "sexo de la cría",
  dias_retiro: "días de retiro",
  cuartos: "cuartos afectados",
  peso_kg: "peso",
  kg_concentrado_vacas: "consumo del día",
  items: "litros por vaca",
};

export function mensajeValidacion(error: z.ZodError) {
  const ruta = error.issues[0]?.path ?? [];
  const campo = String([...ruta].reverse().find((p) => typeof p === "string") ?? "formulario");
  return `Revisa el campo «${ETIQUETAS[campo] ?? campo.replaceAll("_", " ")}»: falta o no es válido.`;
}

/** Valida los datos de una acción; devuelve los datos limpios o el mensaje para el trabajador. */
export function validarDatos(accion: Accion, datos: unknown): { ok: true; datos: Record<string, unknown> } | { ok: false; mensaje: string } {
  const r = (ESQUEMAS[accion] as z.ZodType<Record<string, unknown>>).safeParse(datos);
  return r.success ? { ok: true, datos: r.data } : { ok: false, mensaje: mensajeValidacion(r.error) };
}

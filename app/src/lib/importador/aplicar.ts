import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../database.types";
import type { Advertencia, AnimalPlan, PlanImportacion } from "./tipos";
import { claveAnimal, sinTildes } from "./normalizar";

type Cliente = SupabaseClient<Database>;
type Tablas = Database["public"]["Tables"];

export const TABLAS_EVENTOS = ["partos", "servicios", "palpaciones", "secados", "ordenos", "eventos_sanitarios"] as const;
export type TablaEvento = (typeof TABLAS_EVENTOS)[number];

export const ETIQUETA_TABLA: Record<TablaEvento | "animales", string> = {
  animales: "Vacas",
  partos: "Partos",
  servicios: "Servicios",
  palpaciones: "Palpaciones",
  secados: "Secados",
  ordenos: "Ordeños",
  eventos_sanitarios: "Eventos sanitarios",
};

export interface AnimalVista {
  chapeta: string;
  nombre: string;
  codigo: string;
  primeraHoja: string;
  ultimaHoja: string;
  enUltimaHoja: boolean;
}

export interface VistaPrevia {
  fincaId: string;
  fincaNombre: string;
  hojas: PlanImportacion["hojas"];
  desde: string | null;
  hasta: string | null;
  animalesNuevos: AnimalVista[];
  animalesExistentes: AnimalVista[];
  eventos: Record<TablaEvento, { nuevos: number; existentes: number }>;
  advertencias: Advertencia[];
}

export interface ResultadoImportacion {
  importacionId: string | null;
  fincaId: string;
  hasta: string | null;
  conteos: Record<TablaEvento | "animales", { creados: number; omitidos: number }>;
  advertencias: Advertencia[];
}

const LOTE = 500;
const LOTE_IDS = 100;

const trozos = <T>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

type Respuesta<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** Recorre todas las páginas de una consulta (PostgREST devuelve máx. 1000 filas). */
async function todas<T>(consulta: (desde: number, hasta: number) => Respuesta<T>) {
  const filas: T[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await consulta(desde, desde + 999);
    if (error) throw new Error(error.message);
    filas.push(...(data ?? []));
    if (!data || data.length < 1000) return filas;
  }
}

export function prefijoCodigo(nombreFinca: string) {
  const limpio = sinTildes(nombreFinca)
    .replace(/^\s*(finca|hacienda|hda\.?|granja|fundo)\s+/i, "")
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase();
  return (limpio || "ANI").slice(0, 3);
}

interface Emparejamiento {
  fincaNombre: string;
  existentes: { plan: AnimalPlan; id: string; codigo: string }[];
  nuevos: { plan: AnimalPlan; codigo: string }[];
}

async function emparejar(supabase: Cliente, fincaId: string, plan: PlanImportacion): Promise<Emparejamiento> {
  const { data: finca, error } = await supabase.from("fincas").select("id, nombre").eq("id", fincaId).single();
  if (error || !finca) throw new Error("No se encontró la finca o no tienes acceso a ella.");

  const animales = await todas<{ id: string; codigo: string; chapeta: string | null; nombre: string }>((a, b) =>
    supabase.from("animales").select("id, codigo, chapeta, nombre").eq("finca_id", fincaId).order("codigo").range(a, b),
  );
  const porClave = new Map(animales.filter((a) => a.chapeta).map((a) => [claveAnimal(a.chapeta, a.nombre), a]));
  const codigos = new Set(animales.map((a) => a.codigo.toUpperCase()));
  const prefijo = prefijoCodigo(finca.nombre);

  const existentes: Emparejamiento["existentes"] = [];
  const nuevos: Emparejamiento["nuevos"] = [];
  for (const p of plan.animales) {
    const actual = porClave.get(p.clave);
    if (actual) {
      existentes.push({ plan: p, id: actual.id, codigo: actual.codigo });
      continue;
    }
    const base = `${prefijo}-${p.chapeta}`;
    let codigo = base;
    for (let n = 2; codigos.has(codigo.toUpperCase()); n++) codigo = `${base}-${n}`;
    codigos.add(codigo.toUpperCase());
    nuevos.push({ plan: p, codigo });
  }
  return { fincaNombre: finca.nombre, existentes, nuevos };
}

type FilasEventos = {
  partos: Tablas["partos"]["Insert"][];
  servicios: Tablas["servicios"]["Insert"][];
  palpaciones: Tablas["palpaciones"]["Insert"][];
  secados: Tablas["secados"]["Insert"][];
  ordenos: Tablas["ordenos"]["Insert"][];
  eventos_sanitarios: Tablas["eventos_sanitarios"]["Insert"][];
};

function filasDe(p: AnimalPlan, animal_id: string, f: FilasEventos) {
  for (const x of p.partos)
    f.partos.push({ animal_id, fecha: x.fecha, cria_sexo: x.criaSexo, aborto: x.aborto, lavado: x.lavado || null, observaciones: x.observaciones });
  for (const x of p.servicios)
    f.servicios.push({ animal_id, fecha: x.fecha, tipo: "inseminacion", toro_nombre: x.toro, toro_raza: x.raza, inseminador: x.inseminador });
  for (const x of p.palpaciones)
    f.palpaciones.push({ animal_id, fecha: x.fecha, resultado: "prenada", dias_prenez: x.diasPrenez, veterinario: x.veterinario });
  for (const fecha of p.secados) f.secados.push({ animal_id, fecha });
  for (const x of p.ordenos) f.ordenos.push({ animal_id, fecha: x.fecha, jornada: x.jornada, litros: x.litros });
  for (const x of p.sanidad)
    f.eventos_sanitarios.push({
      animal_id,
      fecha: x.fecha,
      tipo: x.tipo,
      cuartos: x.cuartos.length ? x.cuartos : null,
      observaciones: "Importado de la planilla quincenal",
    });
}

const vacias = (): FilasEventos => ({ partos: [], servicios: [], palpaciones: [], secados: [], ordenos: [], eventos_sanitarios: [] });

const claveEvento: { [T in TablaEvento]: (f: FilasEventos[T][number]) => string } = {
  partos: (f) => `${f.animal_id}|${f.fecha}`,
  servicios: (f) => `${f.animal_id}|${f.fecha}`,
  palpaciones: (f) => `${f.animal_id}|${f.fecha}`,
  secados: (f) => `${f.animal_id}|${f.fecha}`,
  ordenos: (f) => `${f.animal_id}|${f.fecha}|${f.jornada}`,
  eventos_sanitarios: (f) => `${f.animal_id}|${f.fecha}|${f.tipo}`,
};

/** Claves (animal, fecha[, jornada|tipo]) ya registradas para los animales dados. */
async function clavesExistentes(supabase: Cliente, ids: string[], fechasOrdeno: string[]) {
  const claves = Object.fromEntries(TABLAS_EVENTOS.map((t) => [t, new Set<string>()])) as Record<TablaEvento, Set<string>>;
  for (const lote of trozos(ids, LOTE_IDS)) {
    for (const tabla of ["partos", "servicios", "palpaciones", "secados"] as const) {
      const filas = await todas<{ animal_id: string; fecha: string }>((a, b) =>
        supabase.from(tabla).select("animal_id, fecha").in("animal_id", lote).order("id").range(a, b),
      );
      for (const f of filas) claves[tabla].add(`${f.animal_id}|${f.fecha}`);
    }
    if (fechasOrdeno.length) {
      const ordenos = await todas<{ animal_id: string; fecha: string; jornada: string }>((a, b) =>
        supabase.from("ordenos").select("animal_id, fecha, jornada").in("animal_id", lote).in("fecha", fechasOrdeno).order("id").range(a, b),
      );
      for (const f of ordenos) claves.ordenos.add(`${f.animal_id}|${f.fecha}|${f.jornada}`);
    }
    const sanidad = await todas<{ animal_id: string; fecha: string; tipo: string }>((a, b) =>
      supabase.from("eventos_sanitarios").select("animal_id, fecha, tipo").in("animal_id", lote).order("id").range(a, b),
    );
    for (const f of sanidad) claves.eventos_sanitarios.add(`${f.animal_id}|${f.fecha}|${f.tipo}`);
  }
  return claves;
}

const vistaAnimal = (p: AnimalPlan, codigo: string): AnimalVista => ({
  chapeta: p.chapeta,
  nombre: p.nombre,
  codigo,
  primeraHoja: p.primeraHoja,
  ultimaHoja: p.ultimaHoja,
  enUltimaHoja: p.enUltimaHoja,
});

/** Calcula qué se crearía sin escribir nada. */
export async function previsualizar(supabase: Cliente, fincaId: string, plan: PlanImportacion): Promise<VistaPrevia> {
  const { fincaNombre, existentes, nuevos } = await emparejar(supabase, fincaId, plan);

  const deExistentes = vacias();
  for (const e of existentes) filasDe(e.plan, e.id, deExistentes);
  const deNuevos = vacias();
  for (const n of nuevos) filasDe(n.plan, n.codigo, deNuevos);

  const claves = await clavesExistentes(
    supabase,
    existentes.map((e) => e.id),
    plan.hojas.map((h) => h.fechaCorte),
  );

  const eventos = Object.fromEntries(
    TABLAS_EVENTOS.map((t) => {
      const clave = claveEvento[t] as (f: unknown) => string;
      const yaEstan = (deExistentes[t] as unknown[]).filter((f) => claves[t].has(clave(f))).length;
      return [t, { nuevos: deNuevos[t].length + deExistentes[t].length - yaEstan, existentes: yaEstan }];
    }),
  ) as VistaPrevia["eventos"];

  return {
    fincaId,
    fincaNombre,
    hojas: plan.hojas,
    desde: plan.desde,
    hasta: plan.hasta,
    animalesNuevos: nuevos.map((n) => vistaAnimal(n.plan, n.codigo)),
    animalesExistentes: existentes.map((e) => vistaAnimal(e.plan, e.codigo)),
    eventos,
    advertencias: plan.advertencias,
  };
}

async function enLotes<T>(filas: T[], insertar: (lote: T[]) => Respuesta<{ id: string }>) {
  let creados = 0;
  for (const lote of trozos(filas, LOTE)) {
    const { data, error } = await insertar(lote);
    if (error) throw new Error(error.message);
    creados += data?.length ?? 0;
  }
  return { creados, omitidos: filas.length - creados };
}

/**
 * Aplica el plan en la finca: crea las vacas que faltan y carga los eventos sin duplicar
 * (upsert que ignora los repetidos), y deja constancia en `importaciones`.
 */
export async function aplicarPlan(
  supabase: Cliente,
  fincaId: string,
  plan: PlanImportacion,
  archivo: string,
): Promise<ResultadoImportacion> {
  const { existentes, nuevos } = await emparejar(supabase, fincaId, plan);

  const ids = new Map(existentes.map((e) => [e.plan.clave, e.id]));
  for (const lote of trozos(nuevos, LOTE)) {
    const { data, error } = await supabase
      .from("animales")
      .insert(
        lote.map(({ plan: p, codigo }) => ({
          finca_id: fincaId,
          codigo,
          chapeta: p.chapeta,
          nombre: p.nombre,
          especie: "bovino" as const,
          sexo: "hembra" as const,
          categoria: p.partos.length ? ("vaca" as const) : ("novilla" as const),
          estado: p.enUltimaHoja ? ("activo" as const) : ("retirado" as const),
          notas: p.enUltimaHoja ? null : "No aparece en la última planilla importada",
        })),
      )
      .select("id, codigo");
    if (error) throw new Error(`No se pudieron crear las vacas: ${error.message}`);
    const porCodigo = new Map((data ?? []).map((a) => [a.codigo, a.id]));
    for (const n of lote) {
      const id = porCodigo.get(n.codigo);
      if (id) ids.set(n.plan.clave, id);
    }
  }

  const filas = vacias();
  for (const p of plan.animales) {
    const id = ids.get(p.clave);
    if (id) filasDe(p, id, filas);
  }

  const conPorFecha = "animal_id,fecha";
  const opciones = (onConflict: string) => ({ onConflict, ignoreDuplicates: true });
  const conteos = { animales: { creados: nuevos.length, omitidos: existentes.length } } as ResultadoImportacion["conteos"];

  conteos.partos = await enLotes(filas.partos, (l) => supabase.from("partos").upsert(l, opciones(conPorFecha)).select("id"));
  conteos.servicios = await enLotes(filas.servicios, (l) => supabase.from("servicios").upsert(l, opciones(conPorFecha)).select("id"));
  conteos.palpaciones = await enLotes(filas.palpaciones, (l) => supabase.from("palpaciones").upsert(l, opciones(conPorFecha)).select("id"));
  conteos.secados = await enLotes(filas.secados, (l) => supabase.from("secados").upsert(l, opciones(conPorFecha)).select("id"));
  conteos.ordenos = await enLotes(filas.ordenos, (l) =>
    supabase.from("ordenos").upsert(l, opciones("animal_id,fecha,jornada")).select("id"),
  );

  // eventos_sanitarios no tiene índice único: se filtran los que ya existen.
  const sanitarios = filas.eventos_sanitarios;
  let nuevosSanitarios = sanitarios;
  if (sanitarios.length) {
    const claves = await clavesExistentes(supabase, [...new Set(sanitarios.map((s) => s.animal_id))], []);
    nuevosSanitarios = sanitarios.filter((s) => !claves.eventos_sanitarios.has(claveEvento.eventos_sanitarios(s)));
  }
  const insertados = await enLotes(nuevosSanitarios, (l) => supabase.from("eventos_sanitarios").insert(l).select("id"));
  conteos.eventos_sanitarios = { creados: insertados.creados, omitidos: sanitarios.length - insertados.creados };

  const { data: registro, error } = await supabase
    .from("importaciones")
    .insert({
      finca_id: fincaId,
      archivo,
      hojas: plan.hojas.length,
      resumen: {
        desde: plan.desde,
        hasta: plan.hasta,
        conteos,
        advertencias: plan.advertencias.slice(0, 300),
      } as unknown as Json,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Los datos se cargaron, pero no se pudo guardar la bitácora: ${error.message}`);

  return { importacionId: registro?.id ?? null, fincaId, hasta: plan.hasta, conteos, advertencias: plan.advertencias };
}

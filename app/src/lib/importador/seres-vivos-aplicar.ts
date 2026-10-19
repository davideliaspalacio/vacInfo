/**
 * Integra la planilla de seres vivos en una finca: empareja por chapeta con lo que ya está
 * registrado, arma los códigos, enlaza las madres y crea las fichas con su pesaje inicial.
 *
 * Todo pasa por el cliente del usuario, así que las políticas RLS de `animales`, `pesajes` e
 * `importaciones` siguen mandando; la acción del servidor además exige rol propietario o administrador.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../database.types";
// Código pedido por el cliente: 4 letras de la finca, nombre y chapeta (`TONE-JOSEFINA-2079`).
// Ruta relativa para que vitest lo resuelva sin alias.
import { codigoAnimal } from "../../components/fincas/etiquetas";
import { normalizarChapeta, normalizarNombre } from "./normalizar";
import type { FilaSerVivo, PlanSeresVivos } from "./seres-vivos";

type Cliente = SupabaseClient<Database>;
type Tablas = Database["public"]["Tables"];

const LOTE = 200;

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

/** Cómo quedó la madre de una fila. */
type Madre = { tipo: "ficha"; id: string; nombre: string } | { tipo: "planilla"; clave: string; nombre: string } | { tipo: "texto" };

export interface FilaVista {
  fila: number;
  codigo: string;
  chapeta: string | null;
  nombre: string;
  especie: string;
  sexo: string;
  categoria: string;
  raza: string | null;
  fechaNacimiento: string | null;
  pesoKg: number | null;
  /** Texto de la madre tal como quedará, o null si la fila no trae madre. */
  madre: string | null;
  madreEnlazada: boolean;
}

export interface VistaPreviaSeresVivos {
  fincaId: string;
  fincaNombre: string;
  /** Nombre escrito en «PERTENECEN A FINCA:», si venía. */
  fincaEnArchivo: string | null;
  hoja: string;
  fecha: string;
  nuevos: FilaVista[];
  existentes: FilaVista[];
  omitidas: number;
  pesajes: number;
  madresEnlazadas: number;
  advertencias: string[];
}

export interface ResultadoSeresVivos {
  importacionId: string | null;
  fincaId: string;
  animales: { creados: number; omitidos: number };
  pesajes: { creados: number; omitidos: number };
  madresEnlazadas: number;
  advertencias: string[];
}

type AnimalFinca = { id: string; codigo: string; chapeta: string | null; nombre: string; sexo: string; especie: string };

interface Emparejamiento {
  fincaNombre: string;
  nuevos: { f: FilaSerVivo; codigo: string; madre: Madre }[];
  existentes: { f: FilaSerVivo; id: string; codigo: string }[];
  advertencias: string[];
}

const ETIQUETA_ESPECIE: Record<string, string> = { bovino: "Bovino", equino: "Equino", canino: "Canino", ave: "Ave", otro: "Otro" };

async function emparejar(supabase: Cliente, fincaId: string, plan: PlanSeresVivos): Promise<Emparejamiento> {
  const { data: finca, error } = await supabase.from("fincas").select("id, nombre").eq("id", fincaId).single();
  if (error || !finca) throw new Error("No se encontró la finca o no tienes acceso a ella.");

  const animales = await todas<AnimalFinca>((a, b) =>
    supabase.from("animales").select("id, codigo, chapeta, nombre, sexo, especie").eq("finca_id", fincaId).order("codigo").range(a, b),
  );

  const porChapeta = new Map<string, AnimalFinca>();
  const porNombre = new Map<string, AnimalFinca>();
  for (const a of animales) {
    const ch = normalizarChapeta(a.chapeta);
    if (ch && !porChapeta.has(ch)) porChapeta.set(ch, a);
    const n = normalizarNombre(a.nombre);
    if (n && !porNombre.has(n)) porNombre.set(n, a);
  }

  const usados = new Set(animales.map((a) => a.codigo.toUpperCase()));

  const advertencias: string[] = [];
  if (plan.fincaEnArchivo && normalizarNombre(plan.fincaEnArchivo) !== normalizarNombre(finca.nombre))
    advertencias.push(
      `La planilla dice «PERTENECEN A FINCA: ${plan.fincaEnArchivo}» y estás importando en ${finca.nombre}. Revisa que sea la finca correcta.`,
    );

  // Filas de la planilla por chapeta, para enlazar madres que llegan en el mismo archivo.
  const enPlanilla = new Map<string, FilaSerVivo>();
  for (const f of plan.filas) {
    const ch = normalizarChapeta(f.chapeta);
    if (ch && !enPlanilla.has(ch)) enPlanilla.set(ch, f);
  }

  const nuevos: Emparejamiento["nuevos"] = [];
  const existentes: Emparejamiento["existentes"] = [];

  for (const f of plan.filas) {
    const ch = normalizarChapeta(f.chapeta);
    const ya = ch ? porChapeta.get(ch) : porNombre.get(normalizarNombre(f.nombre));
    if (ya) {
      existentes.push({ f, id: ya.id, codigo: ya.codigo });
      advertencias.push(
        ch
          ? `Fila ${f.fila} (${f.nombre}): la chapeta ${f.chapeta} ya está registrada en la finca como ${ya.codigo} · ${ya.nombre}; no se creó de nuevo.`
          : `Fila ${f.fila}: ya hay un animal llamado ${f.nombre} en la finca (${ya.codigo}) y la fila no trae chapeta; no se creó de nuevo.`,
      );
      continue;
    }

    // Cuando la fila no traía nombre, la lectura usa la chapeta como nombre: no se repite en el código.
    const base = codigoAnimal(finca.nombre, f.nombre === f.chapeta ? "" : f.nombre, f.chapeta);
    let codigo = base;
    for (let n = 2; usados.has(codigo.toUpperCase()); n++) codigo = `${base}-${n}`;
    usados.add(codigo.toUpperCase());

    nuevos.push({ f, codigo, madre: resolverMadre(f, porChapeta, enPlanilla, advertencias) });
  }

  return { fincaNombre: finca.nombre, nuevos, existentes, advertencias };
}

function resolverMadre(f: FilaSerVivo, porChapeta: Map<string, AnimalFinca>, enPlanilla: Map<string, FilaSerVivo>, advertencias: string[]): Madre {
  const ch = normalizarChapeta(f.madreChapeta);
  if (!ch) return { tipo: "texto" };
  const quien = `Fila ${f.fila} (${f.nombre})`;

  const ficha = porChapeta.get(ch);
  if (ficha) {
    if (ficha.sexo !== "hembra" || ficha.especie !== f.especie) {
      advertencias.push(
        `${quien}: la chapeta ${f.madreChapeta} corresponde a ${ficha.codigo} · ${ficha.nombre}, que no sirve como madre (${ETIQUETA_ESPECIE[ficha.especie] ?? ficha.especie}, ${ficha.sexo}); se guardaron el nombre y la chapeta sin enlazar.`,
      );
      return { tipo: "texto" };
    }
    return { tipo: "ficha", id: ficha.id, nombre: ficha.nombre };
  }

  const fila = enPlanilla.get(ch);
  if (fila && fila.clave !== f.clave) {
    if (fila.sexo !== "hembra" || fila.especie !== f.especie) {
      advertencias.push(
        `${quien}: la madre con chapeta ${f.madreChapeta} está en la fila ${fila.fila} de la planilla, pero no sirve como madre (${ETIQUETA_ESPECIE[fila.especie] ?? fila.especie}, ${fila.sexo}); se guardaron el nombre y la chapeta sin enlazar.`,
      );
      return { tipo: "texto" };
    }
    return { tipo: "planilla", clave: fila.clave, nombre: fila.nombre };
  }

  advertencias.push(
    `${quien}: no se encontró ningún animal con la chapeta ${f.madreChapeta} para enlazar la madre; se guardaron el nombre y la chapeta tal como venían.`,
  );
  return { tipo: "texto" };
}

const textoMadre = (f: FilaSerVivo, madre: Madre) => {
  if (madre.tipo !== "texto") return `${madre.nombre}${f.madreChapeta ? ` (${f.madreChapeta})` : ""}`;
  if (f.madreNombre || f.madreChapeta) return [f.madreNombre, f.madreChapeta ? `(${f.madreChapeta})` : null].filter(Boolean).join(" ");
  return null;
};

const vista = (f: FilaSerVivo, codigo: string, madre: Madre, enlazada: boolean): FilaVista => ({
  fila: f.fila,
  codigo,
  chapeta: f.chapeta,
  nombre: f.nombre,
  especie: f.especie,
  sexo: f.sexo,
  categoria: f.categoria,
  raza: f.raza,
  fechaNacimiento: f.fechaNacimiento,
  pesoKg: f.pesoKg,
  madre: textoMadre(f, madre),
  madreEnlazada: enlazada,
});

/** Calcula qué se crearía, sin escribir nada. */
export async function previsualizarSeresVivos(supabase: Cliente, fincaId: string, plan: PlanSeresVivos): Promise<VistaPreviaSeresVivos> {
  const { fincaNombre, nuevos, existentes, advertencias } = await emparejar(supabase, fincaId, plan);
  return {
    fincaId,
    fincaNombre,
    fincaEnArchivo: plan.fincaEnArchivo,
    hoja: plan.hoja,
    fecha: plan.fecha,
    nuevos: nuevos.map((n) => vista(n.f, n.codigo, n.madre, n.madre.tipo !== "texto")),
    existentes: existentes.map((e) => vista(e.f, e.codigo, { tipo: "texto" }, false)),
    omitidas: plan.omitidas,
    pesajes: nuevos.filter((n) => n.f.pesoKg != null).length,
    madresEnlazadas: nuevos.filter((n) => n.madre.tipo !== "texto").length,
    advertencias: [...plan.advertencias, ...advertencias],
  };
}

/**
 * Crea las fichas que faltan con su pesaje inicial y deja constancia en `importaciones`.
 * Los animales que ya están en la finca (misma chapeta) no se vuelven a crear, así que subir dos
 * veces la misma planilla no duplica nada.
 */
export async function aplicarSeresVivos(supabase: Cliente, fincaId: string, plan: PlanSeresVivos, archivo: string): Promise<ResultadoSeresVivos> {
  const { nuevos, existentes, advertencias } = await emparejar(supabase, fincaId, plan);
  const todasAdvertencias = [...plan.advertencias, ...advertencias];

  const fila = ({ f, codigo, madre }: Emparejamiento["nuevos"][number]): Tablas["animales"]["Insert"] => ({
    finca_id: fincaId,
    codigo,
    chapeta: f.chapeta,
    nombre: f.nombre,
    especie: f.especie,
    categoria: f.categoria,
    sexo: f.sexo,
    raza: f.raza,
    color: f.color,
    fecha_nacimiento: f.fechaNacimiento,
    peso_kg: f.pesoKg,
    padre_nombre: f.padreNombre,
    padre_chapeta: f.padreChapeta,
    madre_id: madre.tipo === "ficha" ? madre.id : null,
    madre_nombre: madre.tipo === "texto" ? f.madreNombre : madre.nombre,
    madre_chapeta: f.madreChapeta,
  });

  const idPorClave = new Map<string, string>();
  for (const e of existentes) idPorClave.set(e.f.clave, e.id);

  let creados = 0;
  for (const lote of trozos(nuevos, LOTE)) {
    const { data, error } = await supabase.from("animales").insert(lote.map(fila)).select("id, codigo");
    if (error) throw new Error(`No se pudieron crear las fichas: ${error.message}`);
    const porCodigo = new Map((data ?? []).map((a) => [a.codigo, a.id]));
    for (const n of lote) {
      const id = porCodigo.get(n.codigo);
      if (id) idPorClave.set(n.f.clave, id);
    }
    creados += data?.length ?? 0;
  }

  // Madres que venían en la misma planilla: ya existen sus fichas, se enlazan ahora.
  let madresEnlazadas = nuevos.filter((n) => n.madre.tipo === "ficha").length;
  for (const n of nuevos) {
    if (n.madre.tipo !== "planilla") continue;
    const hijo = idPorClave.get(n.f.clave);
    const madreId = idPorClave.get(n.madre.clave);
    if (!hijo || !madreId || hijo === madreId) continue;
    const { error } = await supabase.from("animales").update({ madre_id: madreId, madre_nombre: n.madre.nombre }).eq("id", hijo);
    if (error) todasAdvertencias.push(`No se pudo enlazar la madre de ${n.f.nombre}: ${error.message}`);
    else madresEnlazadas++;
  }

  // Pesaje inicial con la fecha de la importación: alimenta la curva de crecimiento de Levante.
  const pesajes: Tablas["pesajes"]["Insert"][] = [];
  for (const n of nuevos) {
    const id = idPorClave.get(n.f.clave);
    if (id && n.f.pesoKg != null)
      pesajes.push({ animal_id: id, fecha: plan.fecha, peso_kg: n.f.pesoKg, observaciones: "Peso de la planilla de implementación" });
  }
  let pesajesCreados = 0;
  for (const lote of trozos(pesajes, LOTE)) {
    const { data, error } = await supabase.from("pesajes").upsert(lote, { onConflict: "animal_id,fecha", ignoreDuplicates: true }).select("id");
    if (error) throw new Error(`Las fichas se crearon, pero no se pudieron guardar los pesos: ${error.message}`);
    pesajesCreados += data?.length ?? 0;
  }

  const conteos = {
    animales: { creados, omitidos: existentes.length + plan.omitidas },
    pesajes: { creados: pesajesCreados, omitidos: pesajes.length - pesajesCreados },
  };

  const { data: registro, error } = await supabase
    .from("importaciones")
    .insert({
      finca_id: fincaId,
      archivo,
      hojas: 1,
      resumen: {
        tipo: "seres_vivos",
        hoja: plan.hoja,
        fecha: plan.fecha,
        finca_en_archivo: plan.fincaEnArchivo,
        madres_enlazadas: madresEnlazadas,
        conteos,
        advertencias: todasAdvertencias.slice(0, 300),
      } as unknown as Json,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Los animales se crearon, pero no se pudo guardar la bitácora: ${error.message}`);

  return {
    importacionId: registro?.id ?? null,
    fincaId,
    animales: conteos.animales,
    pesajes: conteos.pesajes,
    madresEnlazadas,
    advertencias: todasAdvertencias,
  };
}

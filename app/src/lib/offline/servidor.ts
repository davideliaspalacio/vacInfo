import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/lib/database.types";
import { fecha as fechaCorta } from "../formato";
import { ESQUEMAS, UUID, esAccion, mensajeValidacion, partoConCria, type DatosDe } from "./esquemas";
import { ETIQUETA_ACCION } from "./resumen";
import type { Accion, RegistroEnviado, ResultadoRegistro } from "./tipos";

type Cliente = SupabaseClient<Database>;
type ErrorBD = { message: string; code?: string };
type Validado = { [A in Accion]: { accion: A; datos: DatosDe<A> } }[Accion];
/** `aviso` explica por qué no se crearon filas nuevas cuando el evento ya estaba registrado. */
type Aplicado = { error: ErrorBD | null; nuevos: number; total: number; aviso?: string };

export const MAX_REGISTROS = 100;

const esquemaLote = z.object({
  registros: z.array(z.object({ cliente_id: z.string(), accion: z.string(), datos: z.unknown() })).max(MAX_REGISTROS),
});

export function leerLote(cuerpo: unknown): RegistroEnviado[] | null {
  const r = esquemaLote.safeParse(cuerpo);
  return r.success ? r.data.registros : null;
}

function mensajeBD(error: ErrorBD) {
  if (error.code === "AVISO") return error.message;
  if (error.code === "42501" || /row-level security/i.test(error.message)) return "No tienes permiso para registrar en esta finca.";
  if (error.code === "23503") return "El animal o la finca ya no existe.";
  if (error.code === "23514" || error.code === "22P02") return "Algún valor no es válido. Revisa los números y las opciones.";
  // Mensajes escritos en las funciones de la base (raise exception).
  if (error.code === "P0001") return error.message;
  return `No se pudo guardar: ${error.message}`;
}

const aviso = (message: string): Aplicado => ({ error: { message, code: "AVISO" }, nuevos: 0, total: 1 });
const yaExistia = (texto: string): Aplicado => ({ error: null, nuevos: 0, total: 1, aviso: texto });
const fallo = (error: ErrorBD): Aplicado => ({ error, nuevos: 0, total: 1 });

async function insertados(consulta: PromiseLike<{ data: unknown[] | null; error: ErrorBD | null }>, total: number): Promise<Aplicado> {
  const { data, error } = await consulta;
  return { error, nuevos: data?.length ?? 0, total };
}

async function uno(consulta: PromiseLike<{ error: ErrorBD | null }>): Promise<Aplicado> {
  const { error } = await consulta;
  return { error, nuevos: error ? 0 : 1, total: 1 };
}

async function aplicarParto(s: Cliente, datos: DatosDe<"parto">, id: string): Promise<Aplicado> {
  const { registrar_cria, cria_nombre, cria_chapeta, ...parto } = datos;
  void registrar_cria;

  // Un parto por vaca y día: si ya está (este mismo registro u otro), no se repite ni se crea otra cría.
  const previo = await s.from("partos").select("id").eq("animal_id", parto.animal_id).eq("fecha", parto.fecha).maybeSingle();
  if (previo.error) return fallo(previo.error);
  if (previo.data) return yaExistia("Ya había un parto de esa vaca en esa fecha; se conservó el anterior.");

  let cria: Record<string, string | null> | undefined;
  if (partoConCria(datos)) {
    const { data: madre, error } = await s.from("animales").select("finca_id, codigo, nombre, raza").eq("id", parto.animal_id).maybeSingle();
    if (error) return fallo(error);
    if (!madre) return aviso("No se encontró la madre.");

    // Código de la cría: prefijo de la finca (tomado de la madre) + chapeta, o T + parte del identificador del registro.
    const prefijo = madre.codigo.split("-")[0] || "CRIA";
    const base = `${prefijo}-${cria_chapeta ?? `T${id.slice(0, 6).toUpperCase()}`}`;
    const { data: parecidos } = await s.from("animales").select("codigo").eq("finca_id", madre.finca_id).like("codigo", `${base}%`);
    const usados = new Set((parecidos ?? []).map((a) => a.codigo));
    let codigo = base;
    for (let n = 2; usados.has(codigo); n++) codigo = `${base}-${n}`;

    cria = {
      codigo,
      nombre: cria_nombre ?? `Cría de ${madre.nombre}`,
      chapeta: cria_chapeta ?? null,
      sexo: parto.cria_sexo ?? null,
      raza: parto.cria_raza ?? madre.raza,
    };
  }

  const { error } = await s.rpc("registrar_parto", { p_parto: parto, p_cria: cria });
  if (error?.code === "23505" && cria) return aviso("Ya existe un animal con el código de la cría. Cambia la chapeta y vuelve a intentarlo.");
  if (error && /ya hay un parto/i.test(error.message)) return yaExistia("Ya había un parto de esa vaca en esa fecha; se conservó el anterior.");
  return error ? fallo(error) : { error: null, nuevos: 1, total: 1 };
}

async function aplicarAplicacion(s: Cliente, { potrero_ids, ...d }: DatosDe<"aplicacion">, id: string): Promise<Aplicado> {
  if (!potrero_ids.length) return uno(s.from("aplicaciones_campo").insert({ ...d, id }));
  // Se conserva el texto «potreros» (7, 8, 9) para los informes que lo leen.
  const { data: elegidos, error } = await s.from("potreros").select("id, numero").eq("finca_id", d.finca_id).in("id", potrero_ids).order("numero");
  if (error) return fallo(error);
  const ids = (elegidos ?? []).map((p) => p.id);
  const numeros = (elegidos ?? []).map((p) => String(p.numero));
  const escritos = (d.potreros ?? "").split(/[^0-9]+/).filter(Boolean);
  const potreros = [...new Set([...numeros, ...escritos])].sort((a, b) => Number(a) - Number(b)).join(", ");
  return uno(s.from("aplicaciones_campo").insert({ ...d, id, potreros: potreros || d.potreros, potrero_ids: ids.length ? ids : null }));
}

/** Misma lógica que components/potreros/rotacion.ts, pero idempotente: la nueva rotación usa el cliente_id como id. */
async function aplicarRotacion(s: Cliente, d: DatosDe<"rotacion">, id: string): Promise<Aplicado> {
  if (d.potrero_id) {
    const propia = await s.from("rotaciones_potrero").select("id").eq("id", id).maybeSingle();
    if (propia.error) return fallo(propia.error);
    if (propia.data) return yaExistia("La rotación ya estaba registrada.");

    const destino = await s.from("potreros").select("id").eq("id", d.potrero_id).eq("finca_id", d.finca_id).maybeSingle();
    if (destino.error) return fallo(destino.error);
    if (!destino.data) return aviso("Ese potrero no es de esta finca.");
  }

  const abiertas = await s
    .from("rotaciones_potrero")
    .select("id, potrero_id, fecha_entrada")
    .eq("finca_id", d.finca_id)
    .eq("grupo", d.grupo)
    .is("fecha_salida", null);
  if (abiertas.error) return fallo(abiertas.error);
  const actuales = abiertas.data ?? [];

  if (!d.potrero_id && !actuales.length) return yaExistia(`«${d.grupo}» no estaba en ningún potrero; no hubo nada que cerrar.`);
  if (d.potrero_id && actuales.some((r) => r.potrero_id === d.potrero_id)) return yaExistia(`«${d.grupo}» ya estaba en ese potrero.`);
  const posterior = actuales.find((r) => r.fecha_entrada > d.fecha);
  if (posterior) return aviso(`La fecha no puede ser antes de la última entrada del grupo (${fechaCorta(posterior.fecha_entrada)}).`);

  if (actuales.length) {
    const cierre = await s
      .from("rotaciones_potrero")
      .update({ fecha_salida: d.fecha })
      .in(
        "id",
        actuales.map((r) => r.id),
      )
      .select("id");
    if (cierre.error) return fallo(cierre.error);
    if ((cierre.data?.length ?? 0) < actuales.length) return aviso("No tienes permiso para cerrar la rotación anterior del grupo.");
  }
  if (!d.potrero_id) return { error: null, nuevos: 1, total: 1 };

  return uno(
    s.from("rotaciones_potrero").insert({
      id,
      finca_id: d.finca_id,
      potrero_id: d.potrero_id,
      grupo: d.grupo,
      animales: d.animales ?? null,
      fecha_entrada: d.fecha,
      observaciones: d.observaciones ?? null,
    }),
  );
}

/**
 * Guarda el evento. Las tablas sin clave natural usan cliente_id como id (un reenvío choca con la llave primaria);
 * las que tienen clave natural usan "insertar o ignorar", que no requiere permiso de corrección.
 */
async function aplicar(s: Cliente, v: Validado, id: string): Promise<Aplicado> {
  switch (v.accion) {
    case "ordeno":
      return insertados(s.from("ordenos").upsert(v.datos, { onConflict: "animal_id,fecha,jornada", ignoreDuplicates: true }).select("id"), 1);
    case "ordeno_lista": {
      const { fecha, jornada, items } = v.datos;
      const filas = [...new Map(items.map((i) => [i.animal_id, { animal_id: i.animal_id, fecha, jornada, litros: i.litros }])).values()];
      return insertados(s.from("ordenos").upsert(filas, { onConflict: "animal_id,fecha,jornada", ignoreDuplicates: true }).select("id"), filas.length);
    }
    case "servicio":
      return uno(s.from("servicios").insert({ ...v.datos, id }));
    case "palpacion":
      return uno(s.from("palpaciones").insert({ ...v.datos, id }));
    case "parto":
      return aplicarParto(s, v.datos, id);
    case "secado":
      return uno(s.from("secados").insert({ ...v.datos, id }));
    case "salud": {
      const { cuartos, ...resto } = v.datos;
      return uno(
        s.from("eventos_sanitarios").insert({
          ...resto,
          id,
          cuartos: cuartos.length ? cuartos : undefined,
          estado: resto.tipo === "tratamiento" ? "en_tratamiento" : "activo",
        }),
      );
    }
    case "destete": {
      const { data: animal, error } = await s.from("animales").select("fecha_destete").eq("id", v.datos.animal_id).maybeSingle();
      if (error) return fallo(error);
      if (!animal) return aviso("El animal ya no existe o no tienes acceso a él.");
      if (animal.fecha_destete) return yaExistia(`Ya tenía destete registrado el ${fechaCorta(animal.fecha_destete)}; se conservó.`);
      return uno(s.rpc("registrar_destete", { p_animal: v.datos.animal_id, p_fecha: v.datos.fecha }));
    }
    case "baja": {
      const [animal, previa] = await Promise.all([
        s.from("animales").select("estado").eq("id", v.datos.animal_id).maybeSingle(),
        s.from("bajas").select("tipo, fecha").eq("animal_id", v.datos.animal_id).limit(1).maybeSingle(),
      ]);
      if (animal.error ?? previa.error) return fallo((animal.error ?? previa.error)!);
      if (!animal.data) return aviso("El animal ya no existe o no tienes acceso a él.");
      if (previa.data) return yaExistia(`El animal ya tenía una salida (${previa.data.tipo}) el ${fechaCorta(previa.data.fecha)}; no se registró otra.`);
      if (animal.data.estado !== "activo") return yaExistia(`El animal ya figuraba como ${animal.data.estado}; no se registró otra salida.`);
      return uno(s.from("bajas").insert({ ...v.datos, id }));
    }
    case "pesaje":
      return insertados(s.from("pesajes").upsert(v.datos, { onConflict: "animal_id,fecha", ignoreDuplicates: true }).select("id"), 1);
    case "carro_tanque":
      return uno(s.from("recolecciones_leche").insert({ ...v.datos, id }));
    case "consumo_diario":
      return insertados(s.from("consumos_diarios").upsert(v.datos, { onConflict: "finca_id,fecha", ignoreDuplicates: true }).select("id"), 1);
    case "mantenimiento":
      return uno(s.from("mantenimientos").insert({ ...v.datos, id }));
    case "aplicacion":
      return aplicarAplicacion(s, v.datos, id);
    case "control_calidad":
      return uno(s.from("controles_calidad").insert({ ...v.datos, id }));
    case "movimiento_insumo": {
      const { data: insumo } = await s.from("insumos").select("id").eq("nombre", v.datos.producto).limit(1).maybeSingle();
      return uno(s.from("movimientos_insumos").insert({ ...v.datos, id, insumo_id: insumo?.id }));
    }
    case "visita":
      return uno(s.from("visitas").insert({ ...v.datos, id }));
    case "rotacion":
      return aplicarRotacion(s, v.datos, id);
  }
}

function avisoExistentes(accion: Accion, nuevos: number, total: number) {
  if (nuevos >= total) return undefined;
  switch (accion) {
    case "ordeno_lista":
      return `${total - nuevos} de ${total} vacas ya tenían litros en esa jornada; se conservó el dato anterior.`;
    case "ordeno":
      return "Ya había litros para esa vaca en esa jornada; se conservó el dato anterior.";
    case "pesaje":
      return "Ya había un pesaje de ese animal en esa fecha; se conservó el anterior.";
    case "consumo_diario":
      return "Ya había un consumo registrado ese día; se conservó el anterior.";
    default:
      return undefined;
  }
}

/**
 * Procesa un registro de la cola una sola vez:
 * 1. valida; 2. reclama cliente_id en `sincronizaciones`; 3. guarda el evento; si falla, libera el reclamo.
 * Si el reclamo ya existía se vuelve a intentar el guardado (es idempotente): así un reclamo que no se pudo liberar no pierde datos.
 */
export async function procesarRegistro(supabase: Cliente, registro: RegistroEnviado): Promise<ResultadoRegistro> {
  const { cliente_id } = registro;
  const error = (mensaje: string): ResultadoRegistro => ({ cliente_id, estado: "error", mensaje });

  if (!UUID.test(cliente_id)) return error("Identificador del registro inválido.");
  if (!esAccion(registro.accion)) return error("Tipo de registro desconocido.");

  const leido = (ESQUEMAS[registro.accion] as z.ZodType).safeParse(registro.datos);
  if (!leido.success) return error(mensajeValidacion(leido.error));
  const validado = { accion: registro.accion, datos: leido.data } as Validado;

  const reclamo = await supabase.from("sincronizaciones").insert({ cliente_id, accion: registro.accion });
  const repetido = reclamo.error?.code === "23505";
  if (reclamo.error && !repetido) return error(mensajeBD(reclamo.error));

  const { error: fallido, nuevos, total, aviso: avisoAplicado } = await aplicar(supabase, validado, cliente_id);
  if (fallido?.code === "23505") {
    // Llave primaria = este mismo registro ya guardado. Otra llave única (p. ej. un servicio por vaca y día) = el evento ya existía.
    if (repetido || /_pkey/.test(fallido.message)) return { cliente_id, estado: "duplicado" };
    return { cliente_id, estado: "ok", mensaje: `Ya había un registro de ${ETIQUETA_ACCION[registro.accion].toLowerCase()} con esos datos; se conservó el anterior.` };
  }
  if (fallido) {
    if (!repetido) await supabase.from("sincronizaciones").delete().eq("cliente_id", cliente_id);
    return error(mensajeBD(fallido));
  }

  if (repetido && nuevos === 0) return { cliente_id, estado: "duplicado" };
  const mensaje = nuevos < total ? (avisoAplicado ?? avisoExistentes(registro.accion, nuevos, total)) : undefined;
  return mensaje ? { cliente_id, estado: "ok", mensaje } : { cliente_id, estado: "ok" };
}

/** Procesa en orden (un parto antes que el secado de la misma vaca, por ejemplo). */
export async function procesarRegistros(supabase: Cliente, registros: RegistroEnviado[]) {
  const resultados: ResultadoRegistro[] = [];
  for (const registro of registros) resultados.push(await procesarRegistro(supabase, registro));
  return resultados;
}

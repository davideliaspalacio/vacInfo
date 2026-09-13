import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/lib/database.types";
import { ESQUEMAS, UUID, esAccion, mensajeValidacion, type DatosDe } from "./esquemas";
import { ETIQUETA_ACCION } from "./resumen";
import type { Accion, RegistroEnviado, ResultadoRegistro } from "./tipos";

type Cliente = SupabaseClient<Database>;
type ErrorBD = { message: string; code?: string };
type Validado = { [A in Accion]: { accion: A; datos: DatosDe<A> } }[Accion];
type Aplicado = { error: ErrorBD | null; nuevos: number; total: number };

export const MAX_REGISTROS = 100;

const esquemaLote = z.object({
  registros: z.array(z.object({ cliente_id: z.string(), accion: z.string(), datos: z.unknown() })).max(MAX_REGISTROS),
});

export function leerLote(cuerpo: unknown): RegistroEnviado[] | null {
  const r = esquemaLote.safeParse(cuerpo);
  return r.success ? r.data.registros : null;
}

function mensajeBD(error: ErrorBD) {
  if (error.code === "42501" || /row-level security/i.test(error.message)) return "No tienes permiso para registrar en esta finca.";
  if (error.code === "23503") return "El animal o la finca ya no existe.";
  if (error.code === "23514" || error.code === "22P02") return "Algún valor no es válido. Revisa los números y las opciones.";
  return `No se pudo guardar: ${error.message}`;
}

async function insertados(consulta: PromiseLike<{ data: unknown[] | null; error: ErrorBD | null }>, total: number): Promise<Aplicado> {
  const { data, error } = await consulta;
  return { error, nuevos: data?.length ?? 0, total };
}

async function uno(consulta: PromiseLike<{ error: ErrorBD | null }>): Promise<Aplicado> {
  const { error } = await consulta;
  return { error, nuevos: error ? 0 : 1, total: 1 };
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
      return uno(s.from("partos").insert({ ...v.datos, id }));
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
    case "pesaje":
      return insertados(s.from("pesajes").upsert(v.datos, { onConflict: "animal_id,fecha", ignoreDuplicates: true }).select("id"), 1);
    case "carro_tanque":
      return uno(s.from("recolecciones_leche").insert({ ...v.datos, id }));
    case "consumo_diario":
      return insertados(s.from("consumos_diarios").upsert(v.datos, { onConflict: "finca_id,fecha", ignoreDuplicates: true }).select("id"), 1);
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

  const { error: fallo, nuevos, total } = await aplicar(supabase, validado, cliente_id);
  if (fallo?.code === "23505") {
    // Llave primaria = este mismo registro ya guardado. Otra llave única (p. ej. un servicio por vaca y día) = el evento ya existía.
    if (repetido || /_pkey/.test(fallo.message)) return { cliente_id, estado: "duplicado" };
    return { cliente_id, estado: "ok", mensaje: `Ya había un registro de ${ETIQUETA_ACCION[registro.accion].toLowerCase()} con esos datos; se conservó el anterior.` };
  }
  if (fallo) {
    if (!repetido) await supabase.from("sincronizaciones").delete().eq("cliente_id", cliente_id);
    return error(mensajeBD(fallo));
  }

  if (repetido && nuevos === 0) return { cliente_id, estado: "duplicado" };
  const mensaje = avisoExistentes(registro.accion, nuevos, total);
  return mensaje ? { cliente_id, estado: "ok", mensaje } : { cliente_id, estado: "ok" };
}

/** Procesa en orden (un parto antes que el secado de la misma vaca, por ejemplo). */
export async function procesarRegistros(supabase: Cliente, registros: RegistroEnviado[]) {
  const resultados: ResultadoRegistro[] = [];
  for (const registro of registros) resultados.push(await procesarRegistro(supabase, registro));
  return resultados;
}

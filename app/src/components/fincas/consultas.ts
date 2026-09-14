import { cache } from "react";
import { obtenerSesion, type Sesion } from "@/lib/sesion";
import { hoyISO } from "@/lib/formato";
import { prefijoFinca } from "@/components/fincas/etiquetas";
import { todasLasFilas } from "@/components/informes/consultas";

export type Toro = { finca_id: string; nombre: string; chapeta: string | null; origen: "finca" | "servicios" };

/** Toros de cada finca: animales de categoría toro y nombres ya usados en servicios (sin repetir). */
export async function torosDeFincas({ supabase }: Sesion): Promise<Toro[]> {
  const [{ data: animales }, servicios] = await Promise.all([
    supabase.from("animales").select("finca_id, nombre, chapeta").eq("categoria", "toro").order("nombre"),
    todasLasFilas((a, b) =>
      supabase.from("servicios").select("id, toro_nombre, animales!inner(finca_id)").not("toro_nombre", "is", null).order("id").range(a, b),
    ),
  ]);

  const toros: Toro[] = (animales ?? []).map((t) => ({ ...t, origen: "finca" }));
  const vistos = new Set(toros.map((t) => `${t.finca_id}|${t.nombre.trim().toLowerCase()}`));
  const usados = new Map<string, Toro>();
  for (const s of servicios) {
    const nombre = s.toro_nombre?.trim();
    if (!nombre) continue;
    const clave = `${s.animales.finca_id}|${nombre.toLowerCase()}`;
    if (!vistos.has(clave) && !usados.has(clave)) usados.set(clave, { finca_id: s.animales.finca_id, nombre, chapeta: null, origen: "servicios" });
  }
  return [...toros, ...[...usados.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))];
}

/** Alertas de la finca al corte, una sola llamada por petición aunque las pidan la insignia y la sección. */
export const alertasDeFinca = cache(async (fincaId: string, corte: string) => {
  const { supabase } = await obtenerSesion();
  const { data } = await supabase.rpc("alertas_finca", { p_finca: fincaId, p_corte: corte });
  return data ?? [];
});

/**
 * Fecha de corte y resumen de la finca con el menor número de llamadas a `resumen_finca`:
 * el resumen de hoy sirve para decidir el corte y se reutiliza si el corte es hoy.
 */
export async function resumenAlCorte(supabase: Sesion["supabase"], fincaId: string, pedido?: string | null) {
  const inicial = pedido ?? hoyISO();
  const { data: primero } = await supabase.rpc("resumen_finca", { p_finca: fincaId, p_corte: inicial }).single();
  const corte = !pedido && primero?.fecha_leche && primero.fecha_leche < inicial ? primero.fecha_leche : inicial;
  if (corte === inicial) return { corte, resumen: primero };
  const { data: resumen } = await supabase.rpc("resumen_finca", { p_finca: fincaId, p_corte: corte }).single();
  return { corte, resumen };
}

export type FincaConCodigos = { id: string; nombre: string; prefijo: string; siguienteBien: string };

/** Fincas de la sesión con el prefijo de sus códigos y el siguiente código de bien sugerido. */
export async function fincasConCodigos({ supabase, fincas }: Sesion): Promise<FincaConCodigos[]> {
  const [{ data: animales }, { data: bienes }] = await Promise.all([
    supabase.from("animales").select("finca_id, codigo"),
    supabase.from("bienes").select("finca_id, codigo"),
  ]);

  return fincas.map((f) => {
    const codigosAnimales = (animales ?? []).filter((a) => a.finca_id === f.id).map((a) => a.codigo);
    const codigosBienes = (bienes ?? []).filter((b) => b.finca_id === f.id).map((b) => b.codigo);
    const prefijo = prefijoFinca(f.nombre, [...codigosAnimales, ...codigosBienes]);
    const mayor = Math.max(0, ...codigosBienes.map((c) => Number(/-B(\d+)$/i.exec(c)?.[1] ?? 0)));
    return { id: f.id, nombre: f.nombre, prefijo, siguienteBien: `${prefijo}-B${mayor + 1}` };
  });
}

export function edad(nacimiento: string | null, hasta = new Date()) {
  if (!nacimiento) return null;
  const n = new Date(`${nacimiento}T12:00:00`);
  const meses = (hasta.getFullYear() - n.getFullYear()) * 12 + hasta.getMonth() - n.getMonth() - (hasta.getDate() < n.getDate() ? 1 : 0);
  if (meses < 0) return null;
  if (meses < 12) return `${meses} ${meses === 1 ? "mes" : "meses"}`;
  const anios = Math.floor(meses / 12);
  const resto = meses % 12;
  return `${anios} ${anios === 1 ? "año" : "años"}${resto ? ` y ${resto} ${resto === 1 ? "mes" : "meses"}` : ""}`;
}

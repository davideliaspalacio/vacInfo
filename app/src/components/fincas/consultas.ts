import { cache } from "react";
import { obtenerSesion, type Sesion } from "@/lib/sesion";
import { hoyISO } from "@/lib/formato";
import { prefijoFinca } from "@/components/fincas/etiquetas";
import type { Candidato, ToroServicio } from "@/lib/parientes";
import { todasLasFilas } from "@/components/informes/consultas";

/**
 * Candidatos a madre o padre en el formulario de ser vivo: todos los animales de las fincas de la sesión
 * (activos o dados de baja) con especie, sexo y categoría. El formulario filtra con `lib/parientes.ts`.
 */
export async function candidatosParientes({ supabase }: Sesion): Promise<Candidato[]> {
  return todasLasFilas((a, b) =>
    supabase.from("animales").select("id, nombre, chapeta, finca_id, categoria, especie, sexo, estado").order("id").range(a, b),
  );
}

/** Nombres de toros usados en servicios de cada finca (sin repetir, por nombre). Solo aplican a bovinos. */
export async function torosDeServicios({ supabase }: Sesion): Promise<ToroServicio[]> {
  const servicios = await todasLasFilas((a, b) =>
    supabase.from("servicios").select("id, toro_nombre, animales!inner(finca_id)").not("toro_nombre", "is", null).order("id").range(a, b),
  );
  const usados = new Map<string, ToroServicio>();
  for (const s of servicios) {
    const nombre = s.toro_nombre?.trim();
    if (!nombre) continue;
    const clave = `${s.animales.finca_id}|${nombre.toLowerCase()}`;
    if (!usados.has(clave)) usados.set(clave, { finca_id: s.animales.finca_id, nombre });
  }
  return [...usados.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
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

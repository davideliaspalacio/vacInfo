import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { hoyISO } from "@/lib/formato";

type Cliente = SupabaseClient<Database>;

/**
 * Fecha de corte por defecto de una finca: hoy, o la última fecha con ordeños registrados si es anterior.
 * Así los informes y alertas se leen "al día de la última planilla" cuando la finca no ha registrado hoy.
 */
export async function corteDeFinca(supabase: Cliente, fincaId: string, pedido?: string | null) {
  if (pedido) return pedido;
  const hoy = hoyISO();
  const { data } = await supabase.rpc("resumen_finca", { p_finca: fincaId, p_corte: hoy }).single();
  return data?.fecha_leche && data.fecha_leche < hoy ? data.fecha_leche : hoy;
}

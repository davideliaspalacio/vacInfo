import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { fecha as fechaCorta } from "@/lib/formato";

type Cliente = SupabaseClient<Database>;
export type ResultadoRotacion = { error: { message: string; code?: string } | null };

export type EstadoPotrero = Database["public"]["Functions"]["estado_potreros"]["Returns"][number];

export const ESTADOS_POTRERO: Record<string, { texto: string; tono: "azul" | "rojo" | "verde" | "amarillo" | "gris" }> = {
  ocupado: { texto: "Ocupado", tono: "azul" },
  bloqueado: { texto: "Bloqueado", tono: "rojo" },
  listo: { texto: "Listo", tono: "verde" },
  descansando: { texto: "Descansando", tono: "amarillo" },
  sin_datos: { texto: "Sin datos", tono: "gris" },
};

export const nombrePotrero = (p: { numero: number; nombre: string | null }) => `Potrero ${p.numero}${p.nombre ? ` · ${p.nombre}` : ""}`;

/** Aviso cuando el potrero destino no debería pastorearse todavía; null si está bien. */
export function avisoPotrero(p: EstadoPotrero, objetivo: number) {
  if (p.estado === "bloqueado") return `${nombrePotrero(p)} está bloqueado: no pastorear hasta ${fechaCorta(p.retiro_hasta)} (${p.aplicacion_producto ?? "aplicación"}).`;
  if (p.estado === "descansando") return `${nombrePotrero(p)} lleva ${p.dias_descanso} de ${objetivo} días de descanso.`;
  if (p.estado === "ocupado") return `${nombrePotrero(p)} está ocupado por ${p.grupo}.`;
  return null;
}

const aviso = (message: string): ResultadoRotacion => ({ error: { message, code: "AVISO" } });

async function abiertas(supabase: Cliente, fincaId: string, grupo: string) {
  return supabase
    .from("rotaciones_potrero")
    .select("id, potrero_id, fecha_entrada")
    .eq("finca_id", fincaId)
    .eq("grupo", grupo)
    .is("fecha_salida", null);
}

/** Cierra la rotación abierta del grupo (fecha_salida) sin moverlo a otro potrero. */
export async function sacarGrupo(supabase: Cliente, d: { finca_id: string; grupo: string; fecha: string }): Promise<ResultadoRotacion> {
  const { data, error } = await abiertas(supabase, d.finca_id, d.grupo);
  if (error) return { error };
  if (!data?.length) return aviso(`«${d.grupo}» no está en ningún potrero.`);
  if (data.some((r) => r.fecha_entrada > d.fecha)) return aviso(`La salida no puede ser antes de la entrada (${fechaCorta(data[0].fecha_entrada)}).`);

  return supabase
    .from("rotaciones_potrero")
    .update({ fecha_salida: d.fecha })
    .in(
      "id",
      data.map((r) => r.id),
    );
}

/** Saca el grupo de donde esté y lo entra al potrero destino el mismo día. */
export async function moverGrupo(
  supabase: Cliente,
  d: { finca_id: string; grupo: string; potrero_id: string; fecha: string; animales?: number; observaciones?: string },
): Promise<ResultadoRotacion> {
  const { data, error } = await abiertas(supabase, d.finca_id, d.grupo);
  if (error) return { error };
  if (data?.some((r) => r.potrero_id === d.potrero_id)) return aviso(`«${d.grupo}» ya está en ese potrero.`);
  if (data?.some((r) => r.fecha_entrada > d.fecha)) return aviso(`La fecha no puede ser antes de la última entrada del grupo (${fechaCorta(data[0].fecha_entrada)}).`);

  if (data?.length) {
    const cierre = await supabase
      .from("rotaciones_potrero")
      .update({ fecha_salida: d.fecha })
      .in(
        "id",
        data.map((r) => r.id),
      );
    if (cierre.error) return cierre;
  }

  return supabase.from("rotaciones_potrero").insert({
    finca_id: d.finca_id,
    potrero_id: d.potrero_id,
    grupo: d.grupo,
    animales: d.animales ?? null,
    fecha_entrada: d.fecha,
    observaciones: d.observaciones ?? null,
  });
}

/** Grupos que ya se han usado en la finca, para sugerirlos. */
export async function gruposDeFinca(supabase: Cliente, fincaId: string) {
  const { data } = await supabase.from("rotaciones_potrero").select("grupo").eq("finca_id", fincaId).order("fecha_entrada", { ascending: false }).limit(300);
  return [...new Set(["Vacas en ordeño", "Vacas horras", "Novillas", "Terneras", ...(data ?? []).map((r) => r.grupo)])];
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { BandejaMensajes } from "./tipos";

type Cliente = SupabaseClient<Database>;

const MAX_MENSAJES = 50;

/** Mensajes dirigidos al usuario o a todo el equipo (sin los que él mismo envió), del más nuevo al más viejo. */
export async function leerBandeja(supabase: Cliente, usuarioId: string): Promise<BandejaMensajes> {
  const { data, error } = await supabase
    .from("mensajes")
    .select("id, texto, remitente_id, destinatario_id, leido, creado_en")
    .or(`destinatario_id.is.null,destinatario_id.eq.${usuarioId}`)
    .or(`remitente_id.is.null,remitente_id.neq.${usuarioId}`)
    .order("creado_en", { ascending: false })
    .limit(MAX_MENSAJES);
  if (error) throw error;

  const remitentes = [...new Set((data ?? []).flatMap((m) => (m.remitente_id ? [m.remitente_id] : [])))];
  const { data: perfiles } = remitentes.length
    ? await supabase.from("perfiles").select("id, nombre_completo").in("id", remitentes)
    : { data: [] as { id: string; nombre_completo: string }[] };
  const nombres = new Map((perfiles ?? []).map((p) => [p.id, p.nombre_completo]));

  return {
    usuario_id: usuarioId,
    mensajes: (data ?? []).map((m) => ({
      id: m.id,
      texto: m.texto,
      remitente: (m.remitente_id && nombres.get(m.remitente_id)) || "Administración",
      destinatario_id: m.destinatario_id,
      leido: m.leido,
      creado_en: m.creado_en,
    })),
    descargado_en: new Date().toISOString(),
  };
}

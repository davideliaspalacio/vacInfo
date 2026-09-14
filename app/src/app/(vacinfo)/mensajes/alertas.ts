import type { Database } from "@/lib/database.types";
import type { Sesion } from "@/lib/sesion";
import { hoyISO, sumarDias } from "@/lib/formato";

type AlertaBD = Database["public"]["Functions"]["alertas_finca"]["Returns"][number];

/**
 * Alertas "móviles": `alertas_finca` les pone como fecha el corte, así que cambian cada día.
 * Se descartan por tipo + animal (o insumo) y vuelven a mostrarse después de una semana si el
 * problema sigue. Las demás tienen fecha objetivo fija y se descartan para esa fecha.
 */
export const TIPOS_MOVILES = new Set(["mora_prenez", "insumo", "novilla_lista"]);
export const DIAS_OCULTA_MOVIL = 7;

/** Misma regla que documenta la migración 20260914000013_alertas_descartadas.sql. */
export function claveAlerta(a: { tipo: string; animal_id: string | null; nombre: string; fecha: string }) {
  const objetivo = a.animal_id ?? a.nombre;
  return TIPOS_MOVILES.has(a.tipo) ? `${a.tipo}:${objetivo}` : `${a.tipo}:${objetivo}:${a.fecha}`;
}

export function visibleDesde(tipo: string, hoy = hoyISO()) {
  return TIPOS_MOVILES.has(tipo) ? sumarDias(hoy, DIAS_OCULTA_MOVIL) : null;
}

export type AlertaFinca = AlertaBD & { finca_id: string; finca: string; corte: string; clave: string };
export type AlertaDescartada = AlertaFinca & { descartada_en: string; visible_desde: string | null };

type Descarte = { finca_id: string; clave: string; descartada_en: string; visible_desde: string | null };

/** Descartes vigentes del usuario (RLS limita a los suyos): una fila oculta mientras visible_desde sea null o futuro. */
export async function descartesVigentes(supabase: Sesion["supabase"], fincaIds: string[], hoy = hoyISO()) {
  if (fincaIds.length === 0) return new Map<string, Descarte>();
  const { data } = await supabase
    .from("alertas_descartadas")
    .select("finca_id, clave, descartada_en, visible_desde")
    .in("finca_id", fincaIds)
    .or(`visible_desde.is.null,visible_desde.gt.${hoy}`);
  return new Map((data ?? []).map((d) => [`${d.finca_id}|${d.clave}`, d]));
}

export function separarAlertas(alertas: AlertaFinca[], descartes: Map<string, Descarte>) {
  const visibles: AlertaFinca[] = [];
  const descartadas: AlertaDescartada[] = [];
  for (const a of alertas) {
    const d = descartes.get(`${a.finca_id}|${a.clave}`);
    if (d) descartadas.push({ ...a, descartada_en: d.descartada_en, visible_desde: d.visible_desde });
    else visibles.push(a);
  }
  return { visibles, descartadas };
}

export function conClave(alertas: AlertaBD[] | null, finca: { id: string; nombre: string }, corte: string): AlertaFinca[] {
  return (alertas ?? []).map((a) => ({ ...a, finca_id: finca.id, finca: finca.nombre, corte, clave: claveAlerta(a) }));
}

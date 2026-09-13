import type { Sesion } from "@/lib/sesion";
import { prefijoFinca } from "@/components/fincas/etiquetas";

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

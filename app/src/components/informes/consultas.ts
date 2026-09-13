import type { Sesion } from "@/lib/sesion";

export type PropsInforme = {
  supabase: Sesion["supabase"];
  rango: Rango;
  finca: Sesion["fincas"][number];
};

const PAGINA = 1000;

/** PostgREST corta en 1000 filas: pide por páginas hasta traer todo (ordeños de una quincena superan ese tope). */
export async function todasLasFilas<T>(
  consulta: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
) {
  const filas: T[] = [];
  for (let inicio = 0; ; inicio += PAGINA) {
    const { data, error } = await consulta(inicio, inicio + PAGINA - 1);
    if (error) throw new Error(error.message);
    filas.push(...(data ?? []));
    if (!data || data.length < PAGINA) return filas;
  }
}

export type Rango = { fincaId: string; desde: string; hasta: string };

export function diasEntre(desde: string, hasta: string) {
  return Math.round((Date.parse(`${hasta}T12:00:00`) - Date.parse(`${desde}T12:00:00`)) / 86_400_000) + 1;
}

import type { Sesion } from "@/lib/sesion";
import { corteDeFinca } from "@/lib/datos";
import type { ConteoAnimales } from "@/lib/finanzas";
import { todasLasFilas } from "@/components/informes/consultas";
import { contarAnimales, finDePeriodo, type AnimalConteo } from "./conteo-animales-calculo";

export { contarAnimales, finDePeriodo };

/** Conteo real de animales de la finca en `fecha` (reglas en conteo-animales-calculo.ts). */
export async function conteoAnimalesFinca(supabase: Sesion["supabase"], fincaId: string, fecha: string): Promise<ConteoAnimales> {
  const [animales, partos, secados] = await Promise.all([
    todasLasFilas((a, b) =>
      supabase
        .from("animales")
        .select("id, categoria, especie, sexo, estado, fecha_nacimiento, bajas(fecha)")
        .eq("finca_id", fincaId)
        .order("id")
        .range(a, b),
    ),
    todasLasFilas((a, b) =>
      supabase
        .from("partos")
        .select("animal_id, fecha, animales!partos_animal_id_fkey!inner(finca_id)")
        .eq("animales.finca_id", fincaId)
        .lte("fecha", fecha)
        .order("id")
        .range(a, b),
    ),
    todasLasFilas((a, b) =>
      supabase
        .from("secados")
        .select("animal_id, fecha, animales!inner(finca_id)")
        .eq("animales.finca_id", fincaId)
        .lte("fecha", fecha)
        .order("id")
        .range(a, b),
    ),
  ]);
  return contarAnimales(animales as AnimalConteo[], partos, secados, fecha);
}

/** Conteo para los parámetros de costos: al cierre del periodo o al corte de la finca, lo que sea antes. */
export async function conteoCostosPeriodo(supabase: Sesion["supabase"], fincaId: string, periodo: string) {
  const corte = await corteDeFinca(supabase, fincaId);
  const fin = finDePeriodo(periodo);
  const fecha = corte < fin ? corte : fin;
  return { fecha, animales: await conteoAnimalesFinca(supabase, fincaId, fecha) };
}

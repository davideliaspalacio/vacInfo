// Cálculo puro de la frase que cuadra los contadores de la finca (sin Supabase ni alias "@/",
// para poder probarlo con vitest).

/** Los contadores de `resumen_finca` que reparten el hato activo sin dejar a nadie fuera. */
export type ConteosHato = {
  vacas_ordeno: number | null;
  vacas_horras: number | null;
  novillas_vientre: number | null;
  crias: number | null;
  otros: number | null;
  total_animales: number | null;
};

const n = (v: number | null | undefined) => Number(v ?? 0);
const plural = (cantidad: number, uno: string, varios: string) => `${cantidad} ${cantidad === 1 ? uno : varios}`;

/**
 * Frase que explica cómo suman los contadores hasta el total de animales de la finca.
 *
 * El reclamo que la origina: «veo 4 animales y sumo 1 + 2 + 0 = 3; ¿dónde está el cuarto?». Las
 * crías y los machos no salían en ningún contador, así que la suma nunca cuadraba. Los grupos
 * `vacas_ordeno`, `vacas_horras`, `novillas_vientre`, `crias` y `otros` de `resumen_finca` son
 * una partición exacta del hato activo, así que la frase siempre cierra en `total_animales`.
 *
 * Los grupos vacíos no se escriben (nadie quiere leer «0 novillas») y la suma sigue cuadrando.
 * El resto que no encaje en ningún grupo —que con la función de la base es siempre cero— se
 * nombra igual, para que la cuenta nunca mienta.
 */
export function cuadreHato(r: ConteosHato | null | undefined): string | null {
  const total = n(r?.total_animales);
  if (!r || total <= 0) return null;

  const grupos = [
    { cantidad: n(r.vacas_ordeno), texto: (c: number) => `${c} en ordeño` },
    { cantidad: n(r.vacas_horras), texto: (c: number) => plural(c, "seca", "secas") },
    { cantidad: n(r.novillas_vientre), texto: (c: number) => plural(c, "novilla", "novillas") },
    { cantidad: n(r.crias), texto: (c: number) => plural(c, "cría", "crías") },
    { cantidad: n(r.otros), texto: (c: number) => `${c} más (novillos, toros y otras especies)` },
  ];

  const sumado = grupos.reduce((s, g) => s + g.cantidad, 0);
  const partes = grupos.filter((g) => g.cantidad > 0).map((g) => g.texto(g.cantidad));
  if (sumado !== total) partes.push(plural(Math.abs(total - sumado), "animal sin agrupar", "animales sin agrupar"));
  if (partes.length === 0) return null;

  return `${plural(total, "animal en total", "animales en total")}: ${partes.join(" + ")}`;
}

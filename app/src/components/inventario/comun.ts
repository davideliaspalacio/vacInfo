import type { Sesion } from "@/lib/sesion";

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export function uno(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export function fechaValida(v: string | undefined) {
  return v && FECHA_ISO.test(v) && !Number.isNaN(Date.parse(v)) ? v : undefined;
}

/** Sin finca elegida, se abre la que más animales activos tiene (no una finca vacía por orden alfabético). */
export async function fincaConMasAnimales(supabase: Sesion["supabase"], fincas: Sesion["fincas"]) {
  const conteos = await Promise.all(
    fincas.map((f) =>
      supabase.from("animales").select("id", { count: "exact", head: true }).eq("finca_id", f.id).eq("estado", "activo"),
    ),
  );
  let mejor = 0;
  conteos.forEach((c, i) => {
    if ((c.count ?? 0) > (conteos[mejor].count ?? 0)) mejor = i;
  });
  return fincas[mejor];
}

/** Finca pedida por querystring o, si no es válida, la de más animales. */
export async function fincaElegida(sesion: Sesion, pedida: string | undefined) {
  return sesion.fincas.find((f) => f.id === pedida) ?? (await fincaConMasAnimales(sesion.supabase, sesion.fincas));
}

export const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** 'YYYY-MM-..' → 'abr 26' */
export const mesCorto = (iso: string) => `${MESES_CORTOS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(2, 4)}`;
/** 'YYYY-MM-..' → 'abril de 2026' */
export const mesLargo = (iso: string) => `${MESES_LARGOS[Number(iso.slice(5, 7)) - 1]} de ${iso.slice(0, 4)}`;

/** Suma meses a 'YYYY-MM' y devuelve 'YYYY-MM'. */
export function sumarMeses(ym: string, n: number) {
  const total = Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1 + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

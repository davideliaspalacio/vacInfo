export type Params = Record<string, string | string[] | undefined>;

export type Pagina = { pagina: number; tamano: number; desde: number; hasta: number };

type Error = { message: string; code?: string } | null;
type Respuesta<T> = PromiseLike<{ data: T[] | null; error: Error; count: number | null }>;

const MAX_PAGINA = 100_000;
/** PostgREST devuelve como mucho 1000 filas por petición (`max_rows`). */
const TOPE_POSTGREST = 1000;

function primero(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export function conPagina(pagina: number, tamano: number): Pagina {
  const desde = (pagina - 1) * tamano;
  return { pagina, tamano, desde, hasta: desde + tamano - 1 };
}

/**
 * Lee `?<param>=` como número de página (1 si falta o no es válido). El tamaño es fijo por lista;
 * solo se acepta `?<paramTamano>=` si el valor está entre los `permitidos`.
 */
export function leerPagina(
  sp: Params,
  { param = "pagina", tamano, paramTamano, permitidos = [] }: { param?: string; tamano: number; paramTamano?: string; permitidos?: number[] },
): Pagina {
  const crudo = primero(sp[param]);
  const n = crudo && /^\d{1,6}$/.test(crudo) ? Number(crudo) : 1;
  const pedido = paramTamano ? Number(primero(sp[paramTamano])) : NaN;
  return conPagina(Math.min(Math.max(n, 1), MAX_PAGINA), permitidos.includes(pedido) ? pedido : tamano);
}

export function totalPaginas(total: number, tamano: number) {
  return Math.max(1, Math.ceil(total / tamano));
}

/** Enlace a otra página conservando el resto de parámetros (filtros, corte, pestaña, otras listas). */
export function hrefPagina(ruta: string, sp: Params, param: string, pagina: number, ancla?: string) {
  const q = new URLSearchParams();
  for (const [clave, valor] of Object.entries(sp)) {
    if (clave === param || valor == null) continue;
    for (const v of [valor].flat()) q.append(clave, v);
  }
  if (pagina > 1) q.set(param, String(pagina));
  const s = q.toString();
  return `${ruta}${s ? `?${s}` : ""}${ancla ? `#${ancla}` : ""}`;
}

/** Página de una lista que ya está en memoria (p. ej. el resultado de una función SQL). */
export function recortar<T>(filas: T[], p: Pagina) {
  const actual = conPagina(Math.min(p.pagina, totalPaginas(filas.length, p.tamano)), p.tamano);
  return { filas: filas.slice(actual.desde, actual.hasta + 1), total: filas.length, pagina: actual };
}

/**
 * Ejecuta una consulta con `.range(desde, hasta)` y `{ count: "exact" }`.
 * Si piden una página que ya no existe (PostgREST responde PGRST103), devuelve la última.
 */
export async function consultarPagina<T>(consulta: (desde: number, hasta: number) => Respuesta<T>, p: Pagina) {
  let actual = p;
  let r = await consulta(p.desde, p.hasta);
  if (r.error?.code === "PGRST103") {
    const primera = await consulta(0, p.tamano - 1);
    actual = conPagina(totalPaginas(primera.count ?? 0, p.tamano), p.tamano);
    r = actual.pagina === 1 ? primera : await consulta(actual.desde, actual.hasta);
  }
  return { filas: r.data ?? [], total: r.count ?? 0, pagina: actual, error: r.error };
}

export type Clave = { id: string; fecha: string; registrado_en: string };

const antes = (a: Clave, b: Clave) =>
  a.fecha !== b.fecha ? (a.fecha > b.fecha ? -1 : 1) : a.registrado_en !== b.registrado_en ? (a.registrado_en > b.registrado_en ? -1 : 1) : a.id < b.id ? -1 : 1;

/**
 * Pagina un historial que mezcla varias tablas ordenado por fecha y hora de registro (más reciente primero).
 * De cada tabla solo se leen las claves (id, fecha, registrado_en) de sus primeras `pagina × tamaño` filas;
 * cada consulta debe ordenar por `fecha desc, registrado_en desc, id asc` y pedir `{ count: "exact" }`.
 * Devuelve las claves de la página en orden para traer después solo esas filas completas.
 */
export async function paginarUnion<F extends string>(fuentes: Record<F, (desde: number, hasta: number) => Respuesta<Clave>>, p: Pagina) {
  const necesarias = p.pagina * p.tamano;
  const lecturas = await Promise.all(
    (Object.entries(fuentes) as [F, (desde: number, hasta: number) => Respuesta<Clave>][]).map(async ([fuente, consulta]) => {
      const claves: (Clave & { fuente: F })[] = [];
      let total = 0;
      for (let inicio = 0; inicio < necesarias; inicio += TOPE_POSTGREST) {
        const { data, error, count } = await consulta(inicio, Math.min(inicio + TOPE_POSTGREST, necesarias) - 1);
        if (error) break;
        if (inicio === 0) total = count ?? 0;
        claves.push(...(data ?? []).map((c) => ({ ...c, fuente })));
        if (!data || data.length < TOPE_POSTGREST) break;
      }
      return { claves, total };
    }),
  );

  const total = lecturas.reduce((s, l) => s + l.total, 0);
  const actual = conPagina(Math.min(p.pagina, totalPaginas(total, p.tamano)), p.tamano);
  const claves = lecturas
    .flatMap((l) => l.claves)
    .sort(antes)
    .slice(actual.desde, actual.hasta + 1);
  const ids = (fuente: F) => claves.filter((c) => c.fuente === fuente).map((c) => c.id);
  return { claves, total, pagina: actual, ids };
}

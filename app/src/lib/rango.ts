/**
 * Rango de fechas de las pantallas de consulta (`?desde=&hasta=`).
 *
 * - `hasta` reemplaza la antigua "fecha de corte": los cálculos a una fecha (estado reproductivo, levante,
 *   potreros, saldo de inventario) se hacen con `p_corte = hasta`.
 * - `desde`–`hasta` filtra los historiales y gráficas de la página.
 * - Compatibilidad: un enlace viejo con `?corte=X` equivale a `?hasta=X`.
 *
 * Sin dependencias de Next ni Supabase para poder probarse con vitest.
 */

export type Params = Record<string, string | string[] | undefined>;

/** Fecha interna para "todo el historial" (sin límite inferior). */
export const INICIO_TODO = "1900-01-01";
const VALOR_TODO = "todo";

const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
const MES = /^(\d{4})-(\d{2})$/;

function primero(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

/** 'YYYY-MM-DD' de calendario real (rechaza 2026-02-30) o null. */
export function fechaISO(v: string | string[] | undefined | null): string | null {
  const s = primero(v ?? undefined)?.trim();
  const m = s ? FECHA.exec(s) : null;
  if (!m) return null;
  const [a, me, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const f = new Date(Date.UTC(a, me - 1, d));
  return a >= 1900 && f.getUTCFullYear() === a && f.getUTCMonth() === me - 1 && f.getUTCDate() === d ? s! : null;
}

/** 'YYYY-MM' válido (acepta también una fecha completa) o null. */
export function mesISO(v: string | string[] | undefined | null): string | null {
  const s = primero(v ?? undefined)?.trim();
  if (!s) return null;
  const f = fechaISO(s);
  if (f) return f.slice(0, 7);
  const m = MES.exec(s);
  return m && Number(m[1]) >= 1900 && Number(m[2]) >= 1 && Number(m[2]) <= 12 ? s : null;
}

export function sumarDias(iso: string, dias: number) {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

/** Suma meses a 'YYYY-MM'. */
export function sumarMeses(ym: string, n: number) {
  const total = Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1 + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

export function finDeMes(ym: string) {
  const [a, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}

export function diasEntre(desde: string, hasta: string) {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000);
}

const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

export type RangoPedido = { desde: string | null; hasta: string | null; todo: boolean };

/** Lo que pide la URL, validado. Si llegan las dos fechas al revés, se intercambian. */
export function leerRangoPedido(sp: Params): RangoPedido {
  const hasta = fechaISO(sp.hasta) ?? fechaISO(sp.corte);
  const crudoDesde = primero(sp.desde)?.trim();
  const todo = crudoDesde === VALOR_TODO;
  const desde = todo ? null : fechaISO(crudoDesde);
  if (desde && hasta && desde > hasta) return { desde: hasta, hasta: desde, todo };
  return { desde, hasta, todo };
}

export type Rango = {
  desde: string;
  hasta: string;
  /** Sin límite inferior. */
  todo: boolean;
};

/**
 * Completa el rango con los valores por defecto de la sección:
 * `hasta` = la fecha de corte de la finca; `desde` = `hasta − (dias − 1)` o todo el historial.
 */
export function completarRango(pedido: RangoPedido, hastaDefecto: string, { dias = 30, todoPorDefecto = false } = {}): Rango {
  let hasta = pedido.hasta ?? hastaDefecto;
  const todo = pedido.todo || (!pedido.desde && todoPorDefecto);
  let desde = todo ? INICIO_TODO : (pedido.desde ?? sumarDias(hasta, -(Math.max(dias, 1) - 1)));
  if (desde > hasta) [desde, hasta] = [hasta, desde];
  return { desde, hasta, todo };
}

/** Atajo de conveniencia: leer y completar en un paso. */
export function leerRango(sp: Params, hastaDefecto: string, opciones?: { dias?: number; todoPorDefecto?: boolean }) {
  return completarRango(leerRangoPedido(sp), hastaDefecto, opciones);
}

/** "Del 15/04/2026 al 30/04/2026" · "Todo el historial hasta el 30/04/2026" · "El 30/04/2026". */
export function textoRango({ desde, hasta, todo }: Rango) {
  if (todo) return `Todo el historial hasta el ${dmy(hasta)}`;
  if (desde === hasta) return `El ${dmy(hasta)}`;
  return `Del ${dmy(desde)} al ${dmy(hasta)}`;
}

/** Valor de `?desde=` para un rango (el especial "todo" o la fecha). */
export const valorDesde = (r: Pick<Rango, "desde" | "todo">) => (r.todo ? VALOR_TODO : r.desde);

/** Parámetros de paginación (`pagina`, `pmov`, `prot`, `plactante`…): se reinician al cambiar el rango. */
export const esParamPagina = (clave: string) => /^(pagina|p[a-z_]+)$/.test(clave);

/** Parámetros que se descartan al aplicar un rango nuevo. */
const PROPIOS = new Set(["desde", "hasta", "corte", "meses"]);

/** Pares clave/valor que un formulario o enlace de rango debe conservar (filtros, pestaña, finca…). */
export function paramsConservados(sp: Params, omitir: string[] = []): [string, string][] {
  const fuera = new Set(omitir);
  const pares: [string, string][] = [];
  for (const [clave, valor] of Object.entries(sp)) {
    if (valor == null || PROPIOS.has(clave) || fuera.has(clave) || esParamPagina(clave)) continue;
    for (const v of [valor].flat()) pares.push([clave, v]);
  }
  return pares;
}

/** Enlace a la misma ruta con otro rango, conservando el resto de parámetros y volviendo a la página 1. */
export function hrefRango(ruta: string, sp: Params, rango: { desde: string; hasta: string }, omitir: string[] = []) {
  const q = new URLSearchParams(paramsConservados(sp, omitir));
  q.set("desde", rango.desde);
  q.set("hasta", rango.hasta);
  return `${ruta}?${q}`;
}

export type Atajo = { clave: string; texto: string; desde: string; hasta: string; activo: boolean };

/**
 * Atajos por días contados hasta `referencia` (la fecha de los últimos datos de la finca, que suele ser hoy).
 * `desde` puede ser "todo".
 */
export function atajosDias(referencia: string, actual?: Rango): Atajo[] {
  const mes = referencia.slice(0, 7);
  const anterior = sumarMeses(mes, -1);
  const lista = [
    { clave: "7d", texto: "Últimos 7 días", desde: sumarDias(referencia, -6), hasta: referencia },
    { clave: "15d", texto: "Últimos 15 días", desde: sumarDias(referencia, -14), hasta: referencia },
    { clave: "30d", texto: "Últimos 30 días", desde: sumarDias(referencia, -29), hasta: referencia },
    { clave: "mes", texto: "Este mes", desde: `${mes}-01`, hasta: referencia },
    { clave: "mes-anterior", texto: "Mes anterior", desde: `${anterior}-01`, hasta: finDeMes(anterior) },
    { clave: "anio", texto: "Este año", desde: `${referencia.slice(0, 4)}-01-01`, hasta: referencia },
    { clave: "todo", texto: "Todo", desde: VALOR_TODO, hasta: referencia },
  ];
  return lista.map((a) => ({
    ...a,
    activo: !!actual && actual.hasta === a.hasta && (a.desde === VALOR_TODO ? actual.todo : !actual.todo && actual.desde === a.desde),
  }));
}

// ───────────── Rango por meses (indicadores) ─────────────

export type RangoMeses = {
  /** 'YYYY-MM' */
  desdeMes: string;
  hastaMes: string;
  meses: number;
  /** Fechas para la función SQL. */
  pDesde: string;
  pHasta: string;
  /** El rango pedido era más largo que el máximo y se recortó. */
  recortado: boolean;
};

/**
 * `?desde=YYYY-MM&hasta=YYYY-MM` (también acepta fechas completas) o el atajo heredado `?meses=6|12|24`.
 * El último mes llega hasta `corte` si es el mes del corte; un mes anterior se toma completo;
 * uno posterior, hasta fin de mes sin pasar de `hoy`.
 */
export function leerRangoMeses(
  sp: Params,
  corte: string,
  hoy: string,
  { mesesDefecto = 12, permitidos = [6, 12, 24], maximo = 36 }: { mesesDefecto?: number; permitidos?: number[]; maximo?: number } = {},
): RangoMeses {
  const mesCorte = corte.slice(0, 7);
  let hastaMes = mesISO(sp.hasta) ?? mesISO(sp.corte) ?? mesCorte;
  const pedidoMeses = Number(primero(sp.meses));
  let desdeMes = mesISO(sp.desde) ?? sumarMeses(hastaMes, -((permitidos.includes(pedidoMeses) ? pedidoMeses : mesesDefecto) - 1));
  if (desdeMes > hastaMes) [desdeMes, hastaMes] = [hastaMes, desdeMes];

  let meses = mesesEntre(desdeMes, hastaMes);
  const recortado = meses > maximo;
  if (recortado) {
    desdeMes = sumarMeses(hastaMes, -(maximo - 1));
    meses = maximo;
  }

  const pHasta = hastaMes === mesCorte ? corte : hastaMes < mesCorte ? finDeMes(hastaMes) : [finDeMes(hastaMes), hoy > corte ? hoy : corte].sort()[0];
  return { desdeMes, hastaMes, meses, pDesde: `${desdeMes}-01`, pHasta, recortado };
}

export function mesesEntre(desdeMes: string, hastaMes: string) {
  return (Number(hastaMes.slice(0, 4)) - Number(desdeMes.slice(0, 4))) * 12 + Number(hastaMes.slice(5, 7)) - Number(desdeMes.slice(5, 7)) + 1;
}

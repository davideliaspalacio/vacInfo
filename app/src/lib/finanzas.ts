// Modelo de rentabilidad del consultor (hoja "INFOR (2)" del Excel MANEJO FINANZAS).
// Entradas: parámetros mensuales de una finca. Salidas: el informe contable y el flujo de caja.

/** Unidades en las que se compra un recurso. */
export const UNIDADES_COSTO = ["kg", "L", "unidad"] as const;
/** Mismos grupos que el consumo automático de inventario (`components/inventario/consumo.ts`). */
export const GRUPOS_COSTO = ["vacas_ordeno", "vacas_horras", "levante", "todos"] as const;
export const PERIODOS_COSTO = ["dia", "mes"] as const;
export const MODOS_COSTO = ["mensual", "por_animal"] as const;

export type UnidadCosto = (typeof UNIDADES_COSTO)[number];
export type GrupoCosto = (typeof GRUPOS_COSTO)[number];
export type PeriodoCosto = (typeof PERIODOS_COSTO)[number];
export type ModoCosto = (typeof MODOS_COSTO)[number];

/**
 * Ítem de costo. Dos formas de entrada:
 * - `modo` ausente o `"mensual"`: `mes` es el valor que se escribió a mano (datos de siempre).
 * - `modo: "por_animal"`: se escribe el gasto por animal (`cantidad` de `unidad` por `periodo` para
 *   el `grupo`) y el sistema calcula `mes` con los animales de la finca (`calcularItem`). `mes`
 *   también se guarda ya calculado para que cualquier lectura antigua del jsonb siga funcionando.
 */
export type ItemCosto = {
  nombre: string;
  mes: number;
  caja?: boolean;
  modo?: ModoCosto;
  /** Solo `por_animal`: cantidad por animal y por `periodo`. */
  cantidad?: number;
  unidad?: UnidadCosto;
  /** Solo `por_animal`: COP por unidad. */
  precio_unitario?: number;
  grupo?: GrupoCosto;
  periodo?: PeriodoCosto;
};
export type CategoriaCosto = { categoria: string; items: ItemCosto[] };

/** Conteo de animales tal como lo usa el modelo (siempre completo). */
export type ConteoAnimales = {
  vacas_produccion: number;
  vacas_secas: number;
  novillas: number;
  terneras: number;
  terneros: number;
  novillos: number;
  toros: number;
  caballos: number;
  perros: number;
  otros: number;
};

/**
 * Animales guardados en `parametros_costos.datos.animales`. Los periodos antiguos traen
 * `vacas_horras` (hoy "vacas secas") y `terneronas` (etapa eliminada: cuentan como novillas),
 * y no traen terneros/novillos. `normalizarAnimales` los lleva a `ConteoAnimales`.
 */
export type AnimalesCostos = Partial<ConteoAnimales> & {
  vacas_produccion: number;
  novillas: number;
  terneras: number;
  /** @deprecated datos antiguos: equivale a `vacas_secas`. */
  vacas_horras?: number;
  /** @deprecated datos antiguos: se valorizan como novillas. */
  terneronas?: number;
};

export type ParametrosCostos = {
  precio_litro: number;
  valorizacion_mensual_por_animal: number;
  animales: AnimalesCostos;
  litros_dia: { venta: number; terneras: number; consumo_humano: number };
  costos: CategoriaCosto[];
};

export const ANIMALES_VACIOS: ConteoAnimales = {
  vacas_produccion: 0,
  vacas_secas: 0,
  novillas: 0,
  terneras: 0,
  terneros: 0,
  novillos: 0,
  toros: 0,
  caballos: 0,
  perros: 0,
  otros: 0,
};

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export function normalizarAnimales(a: Partial<AnimalesCostos> | null | undefined): ConteoAnimales {
  const x = a ?? {};
  return {
    vacas_produccion: n(x.vacas_produccion),
    vacas_secas: n(x.vacas_secas) + n(x.vacas_horras),
    novillas: n(x.novillas) + n(x.terneronas),
    terneras: n(x.terneras),
    terneros: n(x.terneros),
    novillos: n(x.novillos),
    toros: n(x.toros),
    caballos: n(x.caballos),
    perros: n(x.perros),
    otros: n(x.otros),
  };
}

export type Estado = "RENTABLE" | "AJUSTADA" | "EN RIESGO";

const DIAS_MES = 30;

export const ETIQUETA_GRUPO_COSTO: Record<GrupoCosto, string> = {
  vacas_ordeno: "Vacas en ordeño",
  vacas_horras: "Vacas secas",
  levante: "Terneras y novillas de levante",
  todos: "Todos los animales",
};

/** Plural en minúscula para la frase del cálculo: "43 vacas en ordeño". */
export const PLURAL_GRUPO_COSTO: Record<GrupoCosto, string> = {
  vacas_ordeno: "vacas en ordeño",
  vacas_horras: "vacas secas",
  levante: "animales de levante",
  todos: "animales",
};

export const ETIQUETA_UNIDAD_COSTO: Record<UnidadCosto, string> = { kg: "Kilo (kg)", L: "Litro (L)", unidad: "Unidad" };

export const ETIQUETA_PERIODO_COSTO: Record<PeriodoCosto, string> = { dia: "Por día", mes: "Por mes" };

/** Cuántos animales tiene cada grupo. Mismos grupos que el consumo automático de inventario. */
export function animalesPorGrupo(a: ConteoAnimales): Record<GrupoCosto, number> {
  return {
    vacas_ordeno: a.vacas_produccion,
    vacas_horras: a.vacas_secas,
    levante: a.terneras + a.terneros + a.novillas + a.novillos,
    todos: Object.values(a).reduce((s, v) => s + v, 0),
  };
}

export type ItemCalculado = {
  /** Valor del mes en COP: el escrito a mano, o el calculado con los animales de la finca. */
  mes: number;
  /** Animales del grupo (0 en modo mensual). */
  animales: number;
  /** Unidades consumidas en el mes: cantidad × animales × (periodo "dia" ? 30 : 1). */
  consumoMes: number;
  unidad: UnidadCosto | null;
};

/** Cálculo de un ítem de costo. Función pura: no depende de la UI ni de la base de datos. */
export function calcularItem(item: ItemCosto, animales: ConteoAnimales): ItemCalculado {
  if (item.modo !== "por_animal") return { mes: item.mes, animales: 0, consumoMes: 0, unidad: null };
  const cantidad = n(item.cantidad);
  const grupo = animalesPorGrupo(animales)[item.grupo ?? "todos"] ?? 0;
  const consumoMes = cantidad * grupo * (item.periodo === "dia" ? DIAS_MES : 1);
  return { mes: consumoMes * n(item.precio_unitario), animales: grupo, consumoMes, unidad: item.unidad ?? "unidad" };
}

const formatoCantidad = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 3 });
/** Cantidades de recurso (no de dinero): "0,5" · "645". */
export const cantidadCosto = (v: number) => formatoCantidad.format(v);

/** "kg" · "L" · "unidad" / "unidades". */
export const textoUnidad = (u: UnidadCosto, cantidad = 0) => (u === "unidad" ? (cantidad === 1 ? "unidad" : "unidades") : u);

/** "0,5 kg × 43 vacas en ordeño × 30 días = 645 kg al mes" (null si el ítem es mensual). */
export function describirItemPorAnimal(item: ItemCosto, animales: ConteoAnimales) {
  if (item.modo !== "por_animal") return null;
  const c = calcularItem(item, animales);
  const unidad = c.unidad ?? "unidad";
  const cantidad = n(item.cantidad);
  const partes = [`${cantidadCosto(cantidad)} ${textoUnidad(unidad, cantidad)}`, `${cantidadCosto(c.animales)} ${PLURAL_GRUPO_COSTO[item.grupo ?? "todos"]}`];
  if (item.periodo === "dia") partes.push(`${DIAS_MES} días`);
  return `${partes.join(" × ")} = ${cantidadCosto(c.consumoMes)} ${textoUnidad(unidad, c.consumoMes)} al mes`;
}

function estadoProduccion(margen: number): Estado {
  if (margen >= 0.08) return "RENTABLE";
  if (margen >= 0.03) return "AJUSTADA";
  return "EN RIESGO";
}

function estadoConLevante(margen: number): Estado {
  if (margen > 0.08) return "RENTABLE";
  if (margen > 0.05) return "AJUSTADA";
  return "EN RIESGO";
}

function estadoCaja(margen: number): Estado {
  if (margen >= 0.05) return "RENTABLE";
  if (margen >= 0.02) return "AJUSTADA";
  return "EN RIESGO";
}

export function calcularInforme(p: ParametrosCostos) {
  const precio = p.precio_litro;
  const animales = normalizarAnimales(p.animales);
  const ingresos = [
    { nombre: "Producción para la venta", litrosDia: p.litros_dia.venta },
    { nombre: "Producción para terneras", litrosDia: p.litros_dia.terneras },
    { nombre: "Producción para consumo humano", litrosDia: p.litros_dia.consumo_humano },
  ].map((i) => ({ ...i, litrosMes: i.litrosDia * DIAS_MES, valorDia: i.litrosDia * precio, valorMes: i.litrosDia * DIAS_MES * precio }));

  const litrosDia = ingresos.reduce((s, i) => s + i.litrosDia, 0);
  const ingresosMes = ingresos.reduce((s, i) => s + i.valorMes, 0);

  // Cada ítem se calcula una sola vez: los de modo "por_animal" salen de la cantidad por animal.
  const calculados = p.costos.map((c) => ({ categoria: c.categoria, items: c.items.map((item) => ({ item, calc: calcularItem(item, animales) })) }));

  const categorias = calculados.map((c) => {
    const totalMes = c.items.reduce((s, { calc }) => s + calc.mes, 0);
    return {
      categoria: c.categoria,
      items: c.items.map(({ item, calc }) => ({
        ...item,
        mes: calc.mes,
        dia: calc.mes / DIAS_MES,
        pct: ingresosMes ? calc.mes / ingresosMes : 0,
        porAnimal: item.modo === "por_animal",
        animalesGrupo: calc.animales,
        consumoMes: calc.consumoMes,
      })),
      totalMes,
      totalDia: totalMes / DIAS_MES,
      pct: ingresosMes ? totalMes / ingresosMes : 0,
    };
  });

  const costosMes = categorias.reduce((s, c) => s + c.totalMes, 0);
  const utilidadMes = ingresosMes - costosMes;
  const margen = ingresosMes ? utilidadMes / ingresosMes : 0;

  // Solo se valorizan terneras y novillas (las terneronas de datos antiguos ya vienen sumadas a novillas).
  const animalesLevante = animales.novillas + animales.terneras;
  const valorizacionMes = animalesLevante * p.valorizacion_mensual_por_animal;
  const utilidadTotalMes = utilidadMes + valorizacionMes;
  const margenTotal = ingresosMes ? utilidadTotalMes / ingresosMes : 0;

  const costoLitro = litrosDia ? costosMes / DIAS_MES / litrosDia : 0;
  const puntoEquilibrioLitros = precio ? costosMes / DIAS_MES / precio : 0;

  // Flujo de caja: solo la leche vendida entra; solo lo que se paga en el mes sale.
  const ingresosCaja = p.litros_dia.venta * DIAS_MES * precio;
  const pagosPorCategoria = calculados
    .map((c) => ({ categoria: c.categoria, mes: c.items.filter(({ item }) => item.caja !== false).reduce((s, { calc }) => s + calc.mes, 0) }))
    .filter((c) => c.mes > 0)
    .sort((a, b) => b.mes - a.mes);
  const pagosCaja = pagosPorCategoria.reduce((s, c) => s + c.mes, 0);
  const saldoCaja = ingresosCaja - pagosCaja;
  const margenCaja = ingresosCaja ? saldoCaja / ingresosCaja : 0;

  const mayorCosto = [...categorias].sort((a, b) => b.totalMes - a.totalMes)[0];
  const totalAnimales = Object.values(animales).reduce((s, v) => s + v, 0);

  return {
    precio,
    animales,
    animalesLevante,
    totalAnimales,
    litrosDia,
    promedioVaca: animales.vacas_produccion ? p.litros_dia.venta / animales.vacas_produccion : 0,
    ingresos,
    ingresosMes,
    categorias,
    costosMes,
    utilidadMes,
    margen,
    estado: estadoProduccion(margen),
    valorizacionMes,
    utilidadTotalMes,
    margenTotal,
    estadoTotal: estadoConLevante(margenTotal),
    costoLitro,
    utilidadLitro: precio - costoLitro,
    puntoEquilibrioLitros,
    margenEquilibrioLitros: litrosDia - puntoEquilibrioLitros,
    mayorCosto,
    caja: { ingresos: ingresosCaja, pagos: pagosCaja, saldo: saldoCaja, margen: margenCaja, estado: estadoCaja(margenCaja), pagosPorCategoria },
  };
}

export type InformeContable = ReturnType<typeof calcularInforme>;

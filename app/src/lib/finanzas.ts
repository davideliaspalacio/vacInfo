// Modelo de rentabilidad del consultor (hoja "INFOR (2)" del Excel MANEJO FINANZAS).
// Entradas: parámetros mensuales de una finca. Salidas: el informe contable y el flujo de caja.

export type ItemCosto = { nombre: string; mes: number; caja?: boolean };
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

  const categorias = p.costos.map((c) => {
    const totalMes = c.items.reduce((s, i) => s + i.mes, 0);
    return {
      categoria: c.categoria,
      items: c.items.map((i) => ({ ...i, dia: i.mes / DIAS_MES, pct: ingresosMes ? i.mes / ingresosMes : 0 })),
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
  const pagosPorCategoria = p.costos
    .map((c) => ({ categoria: c.categoria, mes: c.items.filter((i) => i.caja !== false).reduce((s, i) => s + i.mes, 0) }))
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

import { describe, expect, it } from "vitest";
import {
  animalesPorGrupo,
  ANIMALES_VACIOS,
  calcularInforme,
  calcularItem,
  describirItemPorAnimal,
  type ItemCosto,
  type ParametrosCostos,
} from "../finanzas";
import { pct } from "../formato";
import parametros from "./parametros-prueba.json";

// Valores publicados en "FINCA DE PRUEBA INFORME CONTABLE.pdf".
// El PDF muestra cada ítem redondeado al peso, así que las sumas pueden diferir en 1–2 pesos.
const aprox = (valor: number, esperado: number) => expect(Math.abs(valor - esperado)).toBeLessThanOrEqual(2);

describe("informe contable de la finca de prueba", () => {
  const r = calcularInforme(parametros as ParametrosCostos);

  it("reproduce ingresos y costos", () => {
    expect(r.litrosDia).toBe(865);
    expect(r.ingresosMes).toBe(56_830_500);
    aprox(r.costosMes, 56_263_613);
    aprox(r.utilidadMes, 566_887);
  });

  it("reproduce totales por categoría", () => {
    const total = (n: string) => r.categorias.find((c) => c.categoria === n)!.totalMes;
    expect(total("Concentrados")).toBe(18_449_681);
    expect(total("Fertilizantes")).toBe(12_442_804);
    expect(total("Nómina")).toBe(10_264_576);
  });

  it("reproduce indicadores y semáforos", () => {
    expect(Math.round(r.costoLitro)).toBe(2_168);
    expect(Math.round(r.utilidadLitro)).toBe(22);
    expect(Math.round(r.puntoEquilibrioLitros)).toBe(856);
    expect(r.margen).toBeCloseTo(0.01, 3);
    expect(r.estado).toBe("EN RIESGO");
    expect(r.valorizacionMes).toBe(2_880_000);
    expect(r.margenTotal).toBeCloseTo(0.0607, 3);
    expect(r.estadoTotal).toBe("AJUSTADA");
    expect(r.mayorCosto.categoria).toBe("Concentrados");
  });

  it("lee datos antiguos: terneronas como novillas y vacas horras como secas", () => {
    expect(r.animalesLevante).toBe(24);
    expect(r.animales.novillas).toBe(16);
    expect(r.animales.vacas_secas).toBe(8);
    expect(r.totalAnimales).toBe(74);
    const nuevo = calcularInforme({
      ...(parametros as ParametrosCostos),
      animales: { ...r.animales, novillas: 16, terneras: 8, terneros: 5, novillos: 3 },
    });
    expect(nuevo.valorizacionMes).toBe(2_880_000);
  });

  it("reproduce el flujo de caja", () => {
    expect(r.caja.ingresos).toBe(54_531_000);
    aprox(r.caja.pagos, 52_981_700);
    aprox(r.caja.saldo, 1_549_300);
    expect(r.caja.margen).toBeCloseTo(0.0284, 3);
    expect(r.caja.estado).toBe("AJUSTADA");
  });
});

describe("ítems de costo por animal", () => {
  const animales = { ...ANIMALES_VACIOS, vacas_produccion: 43, vacas_secas: 8, novillas: 16, terneras: 8, terneros: 5, novillos: 3 };

  const parametrosCon = (...items: ItemCosto[]): ParametrosCostos => ({
    precio_litro: 2_190,
    valorizacion_mensual_por_animal: 120_000,
    animales,
    litros_dia: { venta: 800, terneras: 40, consumo_humano: 25 },
    costos: [{ categoria: "Concentrados", items }],
  });

  const porDia: ItemCosto = {
    nombre: "Concentrado vacas",
    mes: 0,
    modo: "por_animal",
    cantidad: 0.5,
    unidad: "kg",
    precio_unitario: 2_000,
    grupo: "vacas_ordeno",
    periodo: "dia",
  };

  const porMes: ItemCosto = {
    nombre: "Sal mineralizada levante",
    mes: 0,
    modo: "por_animal",
    cantidad: 2,
    unidad: "L",
    precio_unitario: 5_000,
    grupo: "levante",
    periodo: "mes",
  };

  it("mapea cada grupo a la cantidad de animales", () => {
    expect(animalesPorGrupo(animales)).toEqual({ vacas_ordeno: 43, vacas_horras: 8, levante: 32, todos: 83 });
  });

  it("calcula una cantidad por día: 0,5 kg × 43 vacas en ordeño × 30 días", () => {
    expect(calcularItem(porDia, animales)).toEqual({ mes: 1_290_000, animales: 43, consumoMes: 645, unidad: "kg" });
    expect(describirItemPorAnimal(porDia, animales)).toBe("0,5 kg × 43 vacas en ordeño × 30 días = 645 kg al mes");
  });

  it("calcula una cantidad por mes sin multiplicar por los días", () => {
    expect(calcularItem(porMes, animales)).toEqual({ mes: 320_000, animales: 32, consumoMes: 64, unidad: "L" });
    expect(describirItemPorAnimal(porMes, animales)).toBe("2 L × 32 animales de levante = 64 L al mes");
  });

  it("da 0 sin romper cuando el grupo no tiene animales", () => {
    const sinVacas = { ...ANIMALES_VACIOS };
    expect(calcularItem(porDia, sinVacas)).toEqual({ mes: 0, animales: 0, consumoMes: 0, unidad: "kg" });
    const r = calcularInforme({ ...parametrosCon(porDia), animales: sinVacas });
    expect(r.costosMes).toBe(0);
    expect(r.categorias[0].items[0].mes).toBe(0);
    expect(r.categorias[0].items[0].consumoMes).toBe(0);
    expect(r.caja.pagos).toBe(0);
    expect(Number.isFinite(r.costoLitro)).toBe(true);
  });

  it("el informe usa el valor calculado y expone unidad, cantidad y consumo", () => {
    const r = calcularInforme(parametrosCon(porDia, porMes, { nombre: "Minerales", mes: 100_000 }));
    expect(r.categorias[0].totalMes).toBe(1_710_000);
    expect(r.costosMes).toBe(1_710_000);
    expect(r.caja.pagos).toBe(1_710_000);
    const [a, b, c] = r.categorias[0].items;
    expect([a.porAnimal, a.unidad, a.cantidad, a.animalesGrupo, a.consumoMes, a.mes]).toEqual([true, "kg", 0.5, 43, 645, 1_290_000]);
    expect([b.porAnimal, b.unidad, b.animalesGrupo, b.consumoMes]).toEqual([true, "L", 32, 64]);
    expect([c.porAnimal, c.mes, c.consumoMes]).toEqual([false, 100_000, 0]);
    expect(describirItemPorAnimal(c, animales)).toBeNull();
  });

  it("los ítems que no salen de caja siguen quedando fuera de los pagos", () => {
    const r = calcularInforme(parametrosCon({ ...porDia, caja: false }, porMes));
    expect(r.costosMes).toBe(1_610_000);
    expect(r.caja.pagos).toBe(320_000);
  });
});

describe("compatibilidad con los parámetros antiguos del consultor", () => {
  const r = calcularInforme(parametros as ParametrosCostos);

  it("mantiene los valores del PDF aunque el modelo acepte ítems por animal", () => {
    expect(Math.round(r.costoLitro)).toBe(2_168);
    expect(Math.round(r.puntoEquilibrioLitros)).toBe(856);
    expect(pct(r.margen)).toBe(pct(0.01));
    expect(r.valorizacionMes).toBe(2_880_000);
    // Ningún ítem antiguo trae `modo`: todos siguen tomando el valor escrito a mano.
    const items = r.categorias.flatMap((c) => c.items);
    expect(items.every((i) => !i.porAnimal && i.consumoMes === 0)).toBe(true);
    expect(items.reduce((s, i) => s + i.mes, 0)).toBe(r.costosMes);
  });
});

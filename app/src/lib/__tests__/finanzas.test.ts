import { describe, expect, it } from "vitest";
import { calcularInforme, type ParametrosCostos } from "../finanzas";
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

  it("reproduce el flujo de caja", () => {
    expect(r.caja.ingresos).toBe(54_531_000);
    aprox(r.caja.pagos, 52_981_700);
    aprox(r.caja.saldo, 1_549_300);
    expect(r.caja.margen).toBeCloseTo(0.0284, 3);
    expect(r.caja.estado).toBe("AJUSTADA");
  });
});

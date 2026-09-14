import { describe, expect, it } from "vitest";
import {
  atajosDias,
  completarRango,
  esParamPagina,
  fechaISO,
  hrefRango,
  INICIO_TODO,
  leerRango,
  leerRangoMeses,
  leerRangoPedido,
  paramsConservados,
  textoRango,
} from "../rango";

describe("leerRangoPedido", () => {
  it("valida fechas reales", () => {
    expect(fechaISO("2026-04-30")).toBe("2026-04-30");
    expect(fechaISO("2026-02-30")).toBeNull();
    expect(fechaISO("30/04/2026")).toBeNull();
    expect(fechaISO("2026-04-30'; drop")).toBeNull();
    expect(fechaISO(["2026-01-02", "x"])).toBe("2026-01-02");
  });

  it("lee desde y hasta, e intercambia si vienen al revés", () => {
    expect(leerRangoPedido({ desde: "2026-04-01", hasta: "2026-04-30" })).toEqual({ desde: "2026-04-01", hasta: "2026-04-30", todo: false });
    expect(leerRangoPedido({ desde: "2026-04-30", hasta: "2026-04-01" })).toEqual({ desde: "2026-04-01", hasta: "2026-04-30", todo: false });
  });

  it("?corte= heredado equivale a hasta; hasta explícito gana", () => {
    expect(leerRangoPedido({ corte: "2026-03-15" }).hasta).toBe("2026-03-15");
    expect(leerRangoPedido({ corte: "2026-03-15", hasta: "2026-03-20" }).hasta).toBe("2026-03-20");
  });

  it("ignora basura", () => {
    expect(leerRangoPedido({ desde: "ayer", hasta: "" })).toEqual({ desde: null, hasta: null, todo: false });
    expect(leerRangoPedido({ desde: "todo" })).toEqual({ desde: null, hasta: null, todo: true });
  });
});

describe("completarRango", () => {
  it("por defecto: hasta = corte y desde = hasta − 29 días (30 días)", () => {
    expect(leerRango({}, "2026-04-30")).toEqual({ desde: "2026-04-01", hasta: "2026-04-30", todo: false });
    expect(leerRango({}, "2026-03-10", { dias: 60 })).toEqual({ desde: "2026-01-10", hasta: "2026-03-10", todo: false });
  });

  it("legacy corte mueve la ventana por defecto", () => {
    expect(leerRango({ corte: "2026-03-31" }, "2026-04-30")).toEqual({ desde: "2026-03-02", hasta: "2026-03-31", todo: false });
  });

  it("solo desde posterior al hasta por defecto: se intercambia", () => {
    expect(leerRango({ desde: "2026-05-10" }, "2026-04-30")).toEqual({ desde: "2026-04-30", hasta: "2026-05-10", todo: false });
  });

  it("todo el historial", () => {
    expect(leerRango({ desde: "todo", hasta: "2026-04-30" }, "2026-01-01")).toEqual({ desde: INICIO_TODO, hasta: "2026-04-30", todo: true });
    expect(completarRango({ desde: null, hasta: null, todo: false }, "2026-04-30", { todoPorDefecto: true }).todo).toBe(true);
    expect(completarRango({ desde: "2026-04-02", hasta: null, todo: false }, "2026-04-30", { todoPorDefecto: true }).todo).toBe(false);
  });

  it("texto del rango", () => {
    expect(textoRango({ desde: "2026-04-15", hasta: "2026-04-30", todo: false })).toBe("Del 15/04/2026 al 30/04/2026");
    expect(textoRango({ desde: INICIO_TODO, hasta: "2026-04-30", todo: true })).toBe("Todo el historial hasta el 30/04/2026");
    expect(textoRango({ desde: "2026-04-30", hasta: "2026-04-30", todo: false })).toBe("El 30/04/2026");
  });
});

describe("atajos y enlaces", () => {
  it("atajos contados hasta la referencia", () => {
    const rango = leerRango({}, "2026-03-15");
    const a = Object.fromEntries(atajosDias("2026-03-15", rango).map((x) => [x.clave, x]));
    expect([a["7d"].desde, a["7d"].hasta]).toEqual(["2026-03-09", "2026-03-15"]);
    expect(a["15d"].desde).toBe("2026-03-01");
    expect(a["30d"].desde).toBe("2026-02-14");
    expect([a.mes.desde, a.mes.hasta]).toEqual(["2026-03-01", "2026-03-15"]);
    expect([a["mes-anterior"].desde, a["mes-anterior"].hasta]).toEqual(["2026-02-01", "2026-02-28"]);
    expect(a.anio.desde).toBe("2026-01-01");
    expect(a.todo.desde).toBe("todo");
    // el rango por defecto coincide con "Últimos 30 días"
    expect(atajosDias("2026-03-15", rango).filter((x) => x.activo).map((x) => x.clave)).toEqual(["30d"]);
    expect(atajosDias("2026-01-10")[4]).toMatchObject({ desde: "2025-12-01", hasta: "2025-12-31" });
  });

  it("detecta los parámetros de paginación", () => {
    for (const p of ["pagina", "pmov", "pcons", "prot", "prep", "psan", "pbajas", "pvivos", "plista_servicio", "ppes"]) expect(esParamPagina(p)).toBe(true);
    for (const p of ["tab", "finca", "animal", "desde", "hasta", "Pmov", "p1"]) expect(esParamPagina(p)).toBe(false);
  });

  it("conserva filtros y reinicia páginas, corte y meses", () => {
    const sp = { tab: "historial", finca: "f1", pagina: "3", pmov: "2", corte: "2026-01-01", meses: "12", desde: "x", animal: ["a", "b"] };
    expect(paramsConservados(sp)).toEqual([
      ["tab", "historial"],
      ["finca", "f1"],
      ["animal", "a"],
      ["animal", "b"],
    ]);
    expect(hrefRango("/inventario", sp, { desde: "2026-04-01", hasta: "2026-04-30" }, ["animal"])).toBe(
      "/inventario?tab=historial&finca=f1&desde=2026-04-01&hasta=2026-04-30",
    );
  });
});

describe("leerRangoMeses", () => {
  const corte = "2026-04-30";
  const hoy = "2026-09-14";

  it("por defecto 12 meses hasta el corte", () => {
    expect(leerRangoMeses({}, corte, hoy)).toEqual({ desdeMes: "2025-05", hastaMes: "2026-04", meses: 12, pDesde: "2025-05-01", pHasta: corte, recortado: false });
  });

  it("?meses= heredado como atajo", () => {
    expect(leerRangoMeses({ meses: "6" }, corte, hoy)).toMatchObject({ desdeMes: "2025-11", meses: 6 });
    expect(leerRangoMeses({ meses: "7" }, corte, hoy)).toMatchObject({ meses: 12 });
  });

  it("desde/hasta por meses, al revés y con fechas completas", () => {
    expect(leerRangoMeses({ desde: "2026-02", hasta: "2025-11" }, corte, hoy)).toMatchObject({ desdeMes: "2025-11", hastaMes: "2026-02", meses: 4, pHasta: "2026-02-28" });
    expect(leerRangoMeses({ desde: "2026-01-15", hasta: "2026-03-02" }, corte, hoy)).toMatchObject({ pDesde: "2026-01-01", pHasta: "2026-03-31" });
  });

  it("un mes posterior al corte llega a fin de mes sin pasar de hoy", () => {
    expect(leerRangoMeses({ desde: "2026-06", hasta: "2026-09" }, corte, hoy).pHasta).toBe(hoy);
    expect(leerRangoMeses({ desde: "2026-05", hasta: "2026-05" }, corte, hoy).pHasta).toBe("2026-05-31");
  });

  it("recorta rangos demasiado largos", () => {
    expect(leerRangoMeses({ desde: "2020-01", hasta: "2026-04" }, corte, hoy)).toMatchObject({ desdeMes: "2023-05", meses: 36, recortado: true });
  });
});

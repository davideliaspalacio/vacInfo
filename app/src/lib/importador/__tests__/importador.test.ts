import { existsSync, readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { leerLibro, type LibroLeido } from "../leer";
import { combinarHojas } from "../combinar";
import { fechaDeNombreHoja, normalizarEncabezado, normalizarRaza, titulo } from "../normalizar";

const ARCHIVO = "/Users/1234/Downloads/OneDrive_3_9-12-2026/FINCA TONELES INFORME OPERATIVO - (24 PLA TONELES)).xlsx";

describe("normalización", () => {
  it("lee la fecha del nombre de la hoja", () => {
    expect(fechaDeNombreHoja("15624")).toBe("2024-06-15");
    expect(fechaDeNombreHoja("151024")).toBe("2024-10-15");
    expect(fechaDeNombreHoja("28225")).toBe("2025-02-28");
    expect(fechaDeNombreHoja("aseo")).toBeNull();
    expect(fechaDeNombreHoja("Hoja1 (2)")).toBeNull();
  });

  it("normaliza encabezados, razas y nombres", () => {
    expect(normalizarEncabezado("ABORTO     SI NO")).toBe("ABORTO SI NO");
    expect(normalizarEncabezado("MAÑAN")).toBe("MAÑAN");
    expect(normalizarRaza("JERSY")).toBe("Jersey");
    expect(normalizarRaza("HOSTEIN")).toBe("Holstein");
    expect(normalizarRaza("GUIR")).toBe("Gyr");
    expect(normalizarRaza("PARDO")).toBe("Pardo Suizo");
    expect(normalizarRaza("PARJOL")).toBe("PARJOL");
    expect(titulo(" JOSE  FREDY")).toBe("Jose Fredy");
  });
});

describe.skipIf(!existsSync(ARCHIVO))("planilla real de Finca Toneles", () => {
  let libro: LibroLeido;

  beforeAll(async () => {
    libro = await leerLibro(readFileSync(ARCHIVO));
  }, 60_000);

  // El libro trae 46 quincenas (15/06/24 → 30/04/26) más las hojas «aseo» y «Hoja1 (2)».
  it("detecta todas las quincenas y el corte más reciente", () => {
    expect(libro.hojas).toHaveLength(46);
    expect(libro.hojas[0].nombre).toBe("15624");
    expect(libro.hojas.at(-1)!.nombre).toBe("30426");
    expect(libro.ignoradas.sort()).toEqual(["Hoja1 (2)", "aseo"]);
    const plan = combinarHojas(libro);
    expect(plan.hasta).toBe("2026-04-30");
    expect(plan.desde).toBe("2024-06-15");
  });

  it("reúne los partos de Aide (chapeta 4)", () => {
    const aide = combinarHojas(libro).animales.find((a) => a.chapeta === "4" && a.nombre === "Aide");
    expect(aide).toBeDefined();
    const fechas = aide!.partos.map((p) => p.fecha);
    expect(fechas).toContain("2024-12-01");
    expect(fechas).toContain("2025-11-24");
    expect(aide!.enUltimaHoja).toBe(true);
  });

  it("separa las dos vacas con chapeta 909", () => {
    const nombres = combinarHojas(libro)
      .animales.filter((a) => a.chapeta === "909")
      .map((a) => a.nombre)
      .sort();
    expect(nombres).toEqual(["Canasta", "Carma"]);
  });

  it("no repite eventos y el resultado es estable", () => {
    const a = combinarHojas(libro);
    const b = combinarHojas(libro);
    expect(b).toEqual(a);
    for (const an of a.animales) {
      expect(new Set(an.partos.map((p) => p.fecha)).size).toBe(an.partos.length);
      expect(new Set(an.servicios.map((p) => p.fecha)).size).toBe(an.servicios.length);
      expect(new Set(an.ordenos.map((o) => `${o.fecha}${o.jornada}`)).size).toBe(an.ordenos.length);
    }
  });
});

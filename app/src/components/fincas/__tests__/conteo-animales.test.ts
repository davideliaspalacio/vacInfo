import { describe, expect, it } from "vitest";
import { contarAnimales, finDePeriodo, type AnimalConteo } from "../conteo-animales-calculo";

const animal = (id: string, cambios: Partial<AnimalConteo> = {}): AnimalConteo => ({
  id,
  categoria: "vaca",
  especie: "bovino",
  sexo: "hembra",
  estado: "activo",
  fecha_nacimiento: null,
  bajas: [],
  ...cambios,
});

describe("conteo de animales para costos", () => {
  const animales = [
    animal("ordeno"),
    animal("seca"),
    animal("sin-parto"),
    animal("novilla-parida", { categoria: "novilla" }),
    animal("novilla", { categoria: "novilla" }),
    animal("ternerona", { categoria: "ternerona" }),
    animal("ternera", { categoria: "ternera" }),
    animal("ternero", { categoria: "ternero", sexo: "macho" }),
    animal("novillo", { categoria: "novilla", sexo: "macho" }),
    animal("toro", { categoria: "toro", sexo: "macho" }),
    animal("caballo", { categoria: "otro", especie: "equino", sexo: "macho" }),
    animal("perro", { categoria: "perro", especie: "canino" }),
    animal("futura", { categoria: "ternera", fecha_nacimiento: "2026-05-10" }),
    animal("vendida-despues", { estado: "vendido", bajas: [{ fecha: "2026-05-02" }] }),
    animal("muerta-antes", { estado: "muerto", bajas: [{ fecha: "2026-04-01" }] }),
    animal("retirada-sin-fecha", { estado: "retirado", bajas: [] }),
  ];
  const partos = [
    { animal_id: "ordeno", fecha: "2026-03-01" },
    { animal_id: "seca", fecha: "2025-06-01" },
    { animal_id: "novilla-parida", fecha: "2026-04-20" },
    { animal_id: "vendida-despues", fecha: "2026-01-01" },
    { animal_id: "ordeno", fecha: "2026-06-01" },
  ];
  const secados = [
    { animal_id: "seca", fecha: "2026-02-01" },
    { animal_id: "ordeno", fecha: "2026-02-01" },
  ];

  it("cuenta cada animal en su grupo a la fecha", () => {
    expect(contarAnimales(animales, partos, secados, "2026-04-30")).toEqual({
      vacas_produccion: 3,
      vacas_secas: 2,
      novillas: 2,
      terneras: 1,
      terneros: 1,
      novillos: 1,
      toros: 1,
      caballos: 1,
      perros: 1,
      otros: 0,
    });
  });

  it("calcula el fin de mes", () => {
    expect(finDePeriodo("2026-02-01")).toBe("2026-02-28");
    expect(finDePeriodo("2028-02-01")).toBe("2028-02-29");
    expect(finDePeriodo("2026-04-01")).toBe("2026-04-30");
  });
});

import { describe, expect, it } from "vitest";
import { cuadreHato, type ConteosHato } from "../cuadre-hato";

const conteos = (cambios: Partial<ConteosHato> = {}): ConteosHato => ({
  vacas_ordeno: 0,
  vacas_horras: 0,
  novillas_vientre: 0,
  crias: 0,
  otros: 0,
  total_animales: 0,
  ...cambios,
});

describe("cuadre del hato de la finca", () => {
  it("explica el total con cada grupo, incluidas las crías", () => {
    expect(cuadreHato(conteos({ vacas_ordeno: 43, vacas_horras: 2, novillas_vientre: 12, crias: 8, total_animales: 65 }))).toBe(
      "65 animales en total: 43 en ordeño + 2 secas + 12 novillas + 8 crías",
    );
  });

  it("resuelve el reclamo del cliente: la cría ya aparece en la suma", () => {
    expect(cuadreHato(conteos({ vacas_ordeno: 1, vacas_horras: 2, crias: 1, total_animales: 4 }))).toBe(
      "4 animales en total: 1 en ordeño + 2 secas + 1 cría",
    );
  });

  it("nombra los machos y las otras especies", () => {
    expect(cuadreHato(conteos({ vacas_ordeno: 10, crias: 3, otros: 2, total_animales: 15 }))).toBe(
      "15 animales en total: 10 en ordeño + 3 crías + 2 más (novillos, toros y otras especies)",
    );
  });

  it("no inventa grupos vacíos", () => {
    expect(cuadreHato(conteos({ novillas_vientre: 1, total_animales: 1 }))).toBe("1 animal en total: 1 novilla");
  });

  it("avisa si los grupos no explican el total", () => {
    expect(cuadreHato(conteos({ vacas_ordeno: 1, total_animales: 3 }))).toBe("3 animales en total: 1 en ordeño + 2 animales sin agrupar");
  });

  it("no dice nada sin animales ni sin resumen", () => {
    expect(cuadreHato(conteos())).toBeNull();
    expect(cuadreHato(null)).toBeNull();
    expect(cuadreHato(undefined)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { codigoAnimal, etapaReproductiva, letrasFinca } from "../etiquetas";

describe("código automático del animal", () => {
  it("usa 4 letras de la finca, el nombre y la chapeta", () => {
    expect(codigoAnimal("Finca Toneles", "Josefina", "2079")).toBe("TONE-JOSEFINA-2079");
    expect(codigoAnimal("Finca Roja", "Aide", "4")).toBe("ROJA-AIDE-4");
  });

  it("quita tildes, espacios y signos del nombre", () => {
    expect(codigoAnimal("Finca Toneles", "La Niña Bonita", "10")).toBe("TONE-LANINABONITA-10");
  });

  it("completa el prefijo cuando la finca tiene menos de 4 letras", () => {
    expect(letrasFinca("La Y")).toBe("LAYX");
    expect(letrasFinca("Finca 123")).toBe("FINC");
  });

  it("arma el código con lo que haya si falta el nombre o la chapeta", () => {
    expect(codigoAnimal("Finca Toneles", "Josefina", "")).toBe("TONE-JOSEFINA");
    expect(codigoAnimal("Finca Toneles", "", "2079")).toBe("TONE-2079");
  });
});

describe("etapa reproductiva que se muestra", () => {
  it("una vaca sin partos registrados está seca, no es novilla", () => {
    expect(etapaReproductiva({ en_ordeno: false, ultimo_parto: null, categoria: "vaca" })).toBe("seca");
  });

  it("una novilla sin partos sigue siendo novilla", () => {
    expect(etapaReproductiva({ en_ordeno: false, ultimo_parto: null, categoria: "novilla" })).toBe("novilla");
  });

  it("la que está en ordeño manda sobre todo lo demás", () => {
    expect(etapaReproductiva({ en_ordeno: true, ultimo_parto: null, categoria: "novilla" })).toBe("ordeno");
  });

  it("con parto registrado y sin ordeño, seca", () => {
    expect(etapaReproductiva({ en_ordeno: false, ultimo_parto: "2026-01-10", categoria: "novilla" })).toBe("seca");
  });
});

describe("etapa reproductiva con la regla híbrida", () => {
  it("una novilla de 25 meses sin partos sigue apareciendo como novilla", () => {
    // Con la regla por edad la base la volvía «vaca» y la ficha mostraba «Seca».
    expect(etapaReproductiva({ en_ordeno: false, ultimo_parto: null, categoria: "novilla" })).toBe("novilla");
  });

  it("la novilla servida, mientras no tenga parto, sigue siendo novilla", () => {
    expect(etapaReproductiva({ en_ordeno: false, ultimo_parto: null, categoria: "novilla" })).toBe("novilla");
  });

  it("la que da leche aparece en ordeño aunque la base la haya pasado a vaca por los ordeños", () => {
    expect(etapaReproductiva({ en_ordeno: true, ultimo_parto: null, categoria: "vaca" })).toBe("ordeno");
  });

  it("la vaca cargada sin historial (más de 36 meses) aparece seca, no novilla", () => {
    expect(etapaReproductiva({ en_ordeno: false, ultimo_parto: null, categoria: "vaca" })).toBe("seca");
  });

  it("la ternera sin historial no se muestra como seca", () => {
    expect(etapaReproductiva({ en_ordeno: false, ultimo_parto: null, categoria: "ternera" })).toBe("novilla");
  });
});

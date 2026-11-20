import { describe, expect, it } from "vitest";
import { DIAS_MORA_PRENEZ, leerMora, UMBRAL_MORA_ALTA } from "../mora";

describe("leerMora", () => {
  it("sin mora (vaca que no está en ordeño) no devuelve nada", () => {
    expect(leerMora(null)).toBeNull();
    expect(leerMora(undefined)).toBeNull();
    expect(leerMora(null, true)).toBeNull();
  });

  it("los 45 días post parto se leen como descanso, nunca como alarma", () => {
    // Peluche, chapeta 80: parto 16/03/26, corte 01/04/26 → 16 días en ordeño.
    const m = leerMora(16 - DIAS_MORA_PRENEZ)!;
    expect(m.dias).toBe(-29);
    expect(m.nivel).toBe("descanso");
    expect(m.valor).toBe("-29");
    expect(m.corta).toBe("descanso");
    expect(m.detalle).toBe("Está en descanso, faltan 29 días para poder inseminar");
    expect(m.clase).not.toContain("alerta");
  });

  it("el día 45 el contador llega a 0 y la vaca queda lista", () => {
    const m = leerMora(0)!;
    expect(m.nivel).toBe("al_dia");
    expect(m.valor).toBe("0");
    expect(m.detalle).toBe("Terminó la mora de preñez de 45 días: ya se puede inseminar");
    expect(m.clase).not.toContain("alerta");
  });

  it("pasado el día 0 son días de retraso, con signo y sin rojo hasta el umbral alto", () => {
    // Aloha, chapeta 10: parto 05/03/26, corte 30/04/26 → 56 días en ordeño.
    const m = leerMora(56 - DIAS_MORA_PRENEZ)!;
    expect(m.dias).toBe(11);
    expect(m.nivel).toBe("retraso");
    expect(m.valor).toBe("+11");
    expect(m.detalle).toBe("Lleva 11 días de retraso para inseminar");
    expect(m.clase).not.toContain("alerta");

    expect(leerMora(UMBRAL_MORA_ALTA)!.nivel).toBe("retraso");
  });

  it("por encima de 60 días de retraso se pinta de alerta", () => {
    // Aide, chapeta 4: parto 24/11/25, corte 30/04/26 → 157 días en ordeño.
    const m = leerMora(157 - DIAS_MORA_PRENEZ)!;
    expect(m.dias).toBe(112);
    expect(m.nivel).toBe("retraso_alto");
    expect(m.valor).toBe("+112");
    expect(m.detalle).toBe("Lleva 112 días de retraso para inseminar");
    expect(m.clase).toContain("text-alerta");

    expect(leerMora(UMBRAL_MORA_ALTA + 1)!.nivel).toBe("retraso_alto");
  });

  it("la mora congelada por preñez confirmada es historia: se muestra apagada", () => {
    // Tia, chapeta 1394: parto 31/07/25, servicio 03/09/25 → inseminada en el día 34.
    const temprana = leerMora(34 - DIAS_MORA_PRENEZ, true)!;
    expect(temprana.dias).toBe(-11);
    expect(temprana.nivel).toBe("congelada");
    expect(temprana.valor).toBe("-11");
    expect(temprana.corta).toBe("cerrada");
    expect(temprana.detalle).toBe("Mora cerrada el día del servicio: la inseminaron 11 días antes de terminar el descanso");

    // Yamile, chapeta 1401: parto 03/12/25, servicio 29/01/26 → inseminada en el día 57.
    const tardia = leerMora(57 - DIAS_MORA_PRENEZ, true)!;
    expect(tardia.dias).toBe(12);
    expect(tardia.valor).toBe("+12");
    expect(tardia.detalle).toBe("Mora cerrada el día del servicio: la inseminaron 12 días tarde");
    // Ni un retraso congelado grande se pinta de alerta: ya no hay nada que hacer.
    expect(leerMora(189, true)!.clase).not.toContain("alerta");

    expect(leerMora(0, true)!.detalle).toBe("Mora cerrada el día del servicio: la inseminaron justo al terminar el descanso");
  });
});

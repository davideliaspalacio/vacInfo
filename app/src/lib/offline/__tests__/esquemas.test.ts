// Reglas del esquema compartido por el teléfono y el servidor (el mismo zod valida en los dos lados).
// Ejecutar con: pnpm test
import { describe, expect, it } from "vitest";
import { partoConCria, validarDatos } from "../esquemas";

const VACA = "00000000-0000-4000-8000-000000000016";
const FECHA = "2026-11-21";

const limpios = (accion: Parameters<typeof validarDatos>[0], datos: Record<string, unknown>) => {
  const r = validarDatos(accion, datos);
  if (!r.ok) throw new Error(r.mensaje);
  return r.datos;
};

// Problema 8 del cliente: «si selecciono "fue aborto", automáticamente debe cerrarse la opción de
// "sí" en "¿nació viva?" y también la pregunta de "¿tomó calostro?"».
describe("parto con aborto", () => {
  const conAborto = {
    animal_id: VACA,
    fecha: FECHA,
    aborto: "on",
    // Lo que podría llegar de una cola vieja o de un cliente que no bloquea la casilla:
    nacido_vivo: "si",
    toma_calostro: "si",
    persona_calostro: "Jhon",
    registrar_cria: "on",
    cria_sexo: "hembra",
  };

  it("no manda «nació viva» y deja el parto sin calostro", () => {
    const datos = limpios("parto", conAborto);
    expect(datos.aborto).toBe(true);
    expect(datos.nacido_vivo).toBe(false);
    expect(datos.nacido_vivo).not.toBe(true);
    expect(datos.toma_calostro).toBeUndefined();
    expect(datos.persona_calostro).toBeUndefined();
  });

  it("no crea la cría aunque se haya pedido", () => {
    expect(partoConCria(limpios("parto", conAborto))).toBe(false);
    // Sin aborto sí se crea.
    expect(partoConCria(limpios("parto", { animal_id: VACA, fecha: FECHA, nacido_vivo: "si", registrar_cria: "on", cria_sexo: "hembra" }))).toBe(true);
  });

  it("sin aborto no toca nada", () => {
    const datos = limpios("parto", { animal_id: VACA, fecha: FECHA, nacido_vivo: "si", toma_calostro: "si", persona_calostro: "Jhon" });
    expect(datos).toMatchObject({ nacido_vivo: true, toma_calostro: true, persona_calostro: "Jhon" });
    expect(datos.aborto).toBeUndefined();
  });

  it("una cría nacida muerta tampoco se registra", () => {
    expect(partoConCria(limpios("parto", { animal_id: VACA, fecha: FECHA, nacido_vivo: "no", registrar_cria: "on", cria_sexo: "hembra" }))).toBe(false);
  });
});

// Problema 6 del cliente: dos pajillas de toros distintos en el mismo servicio. El toro 2 es opcional.
describe("servicio con dos toros", () => {
  const base = { animal_id: VACA, fecha: FECHA, tipo: "inseminacion" };

  it("guarda el nombre y la raza del segundo toro", () => {
    expect(limpios("servicio", { ...base, toro_nombre: "Apolo", toro_raza: "Holstein", toro2_nombre: "Zeus", toro2_raza: "Jersey" })).toMatchObject({
      toro_nombre: "Apolo",
      toro_raza: "Holstein",
      toro2_nombre: "Zeus",
      toro2_raza: "Jersey",
    });
  });

  it("el segundo toro es opcional: el formulario se envía sin llenarlo", () => {
    const datos = limpios("servicio", { ...base, toro_nombre: "Apolo", toro2_nombre: "", toro2_raza: "" });
    expect(datos.toro2_nombre).toBeUndefined();
    expect(datos.toro2_raza).toBeUndefined();
  });

  it("no acepta un toro 2 sin toro 1", () => {
    const r = validarDatos("servicio", { ...base, toro2_nombre: "Zeus" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.mensaje).toMatch(/nombre del toro/);
  });
});

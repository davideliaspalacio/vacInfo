import { describe, expect, it } from "vitest";
import { LADO_MAXIMO_FOTO, nombreArchivoFoto, rutaFoto, rutaFotoValida, tamanoRedimensionado } from "../fotos";

const ORG = "00000000-0000-4000-8000-000000000001";
const OTRA = "99999999-9999-4999-8999-999999999999";
const UUID = "11111111-1111-4111-8111-111111111111";

describe("ruta de la foto", () => {
  it("arma {organizacion}/{tipo}/{uuid}.jpg", () => {
    expect(rutaFoto(ORG, "animales", nombreArchivoFoto(UUID))).toBe(`${ORG}/animales/${UUID}.jpg`);
  });

  it("acepta la ruta propia de cada tipo", () => {
    for (const tipo of ["animales", "bienes", "fincas"] as const) {
      expect(rutaFotoValida(`${ORG}/${tipo}/${UUID}.jpg`, ORG, tipo)).toBe(true);
    }
  });

  it("rechaza la foto de otra empresa", () => {
    expect(rutaFotoValida(`${OTRA}/animales/${UUID}.jpg`, ORG, "animales")).toBe(false);
  });

  it("rechaza que el tipo no coincida", () => {
    expect(rutaFotoValida(`${ORG}/bienes/${UUID}.jpg`, ORG, "animales")).toBe(false);
  });

  it("rechaza carpetas inventadas, rutas anidadas y travesías", () => {
    expect(rutaFotoValida(`${ORG}/documentos/${UUID}.jpg`, ORG, "animales")).toBe(false);
    expect(rutaFotoValida(`${ORG}/animales/sub/${UUID}.jpg`, ORG, "animales")).toBe(false);
    expect(rutaFotoValida(`${ORG}/animales/../../${UUID}.jpg`, ORG, "animales")).toBe(false);
    expect(rutaFotoValida(`../${ORG}/animales/${UUID}.jpg`, ORG, "animales")).toBe(false);
    expect(rutaFotoValida(`/${ORG}/animales/${UUID}.jpg`, ORG, "animales")).toBe(false);
  });

  it("rechaza nombres de archivo que no sean un uuid .jpg", () => {
    expect(rutaFotoValida(`${ORG}/animales/${UUID}.png`, ORG, "animales")).toBe(false);
    expect(rutaFotoValida(`${ORG}/animales/foto.jpg`, ORG, "animales")).toBe(false);
    expect(rutaFotoValida(`${ORG}/animales/.jpg`, ORG, "animales")).toBe(false);
    expect(rutaFotoValida(`${ORG}/animales/`, ORG, "animales")).toBe(false);
  });

  it("rechaza una organización que no sea un uuid", () => {
    expect(rutaFotoValida(`empresa/animales/${UUID}.jpg`, "empresa", "animales")).toBe(false);
  });
});

describe("redimensionado en el navegador", () => {
  it("deja igual las fotos que ya caben", () => {
    expect(tamanoRedimensionado(800, 600)).toEqual({ ancho: 800, alto: 600 });
    expect(tamanoRedimensionado(LADO_MAXIMO_FOTO, 900)).toEqual({ ancho: LADO_MAXIMO_FOTO, alto: 900 });
  });

  it("baja el lado mayor a 1600 px conservando la proporción", () => {
    expect(tamanoRedimensionado(4000, 3000)).toEqual({ ancho: 1600, alto: 1200 });
    expect(tamanoRedimensionado(3000, 4000)).toEqual({ ancho: 1200, alto: 1600 });
    expect(tamanoRedimensionado(4032, 3024)).toEqual({ ancho: 1600, alto: 1200 });
  });

  it("nunca deja un lado en cero con fotos muy alargadas", () => {
    const { ancho, alto } = tamanoRedimensionado(12000, 10);
    expect(ancho).toBe(1600);
    expect(alto).toBe(1);
  });

  it("respeta un lado máximo distinto (miniaturas)", () => {
    expect(tamanoRedimensionado(1000, 500, 200)).toEqual({ ancho: 200, alto: 100 });
  });

  it("tolera tamaños inválidos", () => {
    expect(tamanoRedimensionado(0, 0)).toEqual({ ancho: 0, alto: 0 });
    expect(tamanoRedimensionado(Number.NaN, 100)).toEqual({ ancho: 0, alto: 0 });
  });
});

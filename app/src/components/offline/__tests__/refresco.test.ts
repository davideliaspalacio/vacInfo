// El cliente quitó el botón «Actualizar datos de la finca»: ahora la descarga del catálogo es
// automática. Estas pruebas cubren la decisión, que no necesita navegador. Ejecutar con: pnpm test
import { describe, expect, it } from "vitest";
import { GRACIA_TECLEO, INTERVALO_REFRESCO, TIC_REFRESCO, hayEdicionEnCurso, tocaRefrescar } from "../refresco";

const AHORA = new Date("2026-11-21T08:00:00Z").getTime();

const estado = (cambios: Partial<Parameters<typeof tocaRefrescar>[0]> = {}) => ({
  enLinea: true,
  descargando: false,
  escribiendo: false,
  ultimaDescarga: AHORA - INTERVALO_REFRESCO,
  ahora: AHORA,
  ...cambios,
});

describe("tocaRefrescar", () => {
  it("son 2 minutos y el reloj late más seguido, para no irse a 4", () => {
    expect(INTERVALO_REFRESCO).toBe(2 * 60_000);
    expect(TIC_REFRESCO).toBeLessThan(INTERVALO_REFRESCO);
  });

  it("no hace nada sin señal, aunque el catálogo esté viejísimo", () => {
    expect(tocaRefrescar(estado({ enLinea: false, ultimaDescarga: AHORA - 24 * 60 * 60_000 }))).toBe(false);
  });

  it("no hace nada sin señal ni cuando el teléfono no tiene catálogo (el modo sin señal manda)", () => {
    expect(tocaRefrescar(estado({ enLinea: false, ultimaDescarga: null }))).toBe(false);
  });

  it("no lanza otra descarga si ya hay una en curso", () => {
    expect(tocaRefrescar(estado({ descargando: true, ultimaDescarga: null }))).toBe(false);
  });

  it("no pisa los datos mientras el trabajador escribe en un formulario", () => {
    expect(tocaRefrescar(estado({ escribiendo: true }))).toBe(false);
  });

  it("baja el catálogo de una si el teléfono no tiene nada guardado", () => {
    expect(tocaRefrescar(estado({ ultimaDescarga: null }))).toBe(true);
  });

  it("antes de los 2 minutos no, a los 2 minutos sí", () => {
    expect(tocaRefrescar(estado({ ultimaDescarga: AHORA - (INTERVALO_REFRESCO - 1) }))).toBe(false);
    expect(tocaRefrescar(estado({ ultimaDescarga: AHORA - INTERVALO_REFRESCO }))).toBe(true);
    expect(tocaRefrescar(estado({ ultimaDescarga: AHORA - 5 * INTERVALO_REFRESCO }))).toBe(true);
  });

  it("acabado de descargar, no se repite al volver a primer plano", () => {
    expect(tocaRefrescar(estado({ ultimaDescarga: AHORA - 1_000 }))).toBe(false);
  });

  it("si el teléfono tiene la fecha movida y la marca queda en el futuro, se vuelve a bajar", () => {
    expect(tocaRefrescar(estado({ ultimaDescarga: AHORA + 60 * 60_000 }))).toBe(true);
  });

  it("se puede pedir otro intervalo", () => {
    expect(tocaRefrescar(estado({ ultimaDescarga: AHORA - 30_000, intervalo: 10_000 }))).toBe(true);
    expect(tocaRefrescar(estado({ ultimaDescarga: AHORA - 30_000, intervalo: 60_000 }))).toBe(false);
  });
});

describe("hayEdicionEnCurso", () => {
  it("con el foco en un campo, está escribiendo (aunque no teclee)", () => {
    for (const tagName of ["INPUT", "TEXTAREA", "SELECT"]) {
      expect(hayEdicionEnCurso({ tagName }, 0, AHORA)).toBe(true);
    }
  });

  it("también cuenta un campo editable que no es input", () => {
    expect(hayEdicionEnCurso({ tagName: "DIV", isContentEditable: true }, 0, AHORA)).toBe(true);
  });

  it("con el foco en un botón o sin foco, no está escribiendo", () => {
    expect(hayEdicionEnCurso({ tagName: "BUTTON" }, 0, AHORA)).toBe(false);
    expect(hayEdicionEnCurso(null, 0, AHORA)).toBe(false);
  });

  it("acabó de teclear: se espera a que suelte el teléfono", () => {
    expect(hayEdicionEnCurso(null, AHORA - 1_000, AHORA)).toBe(true);
    expect(hayEdicionEnCurso(null, AHORA - (GRACIA_TECLEO - 1), AHORA)).toBe(true);
  });

  it("pasada la espera desde la última tecla, ya se puede actualizar", () => {
    expect(hayEdicionEnCurso(null, AHORA - GRACIA_TECLEO, AHORA)).toBe(false);
    expect(hayEdicionEnCurso(null, AHORA - 10 * 60_000, AHORA)).toBe(false);
  });

  it("un formulario recién abierto, sin una sola tecla, no bloquea la actualización", () => {
    expect(hayEdicionEnCurso(null, 0, AHORA)).toBe(false);
  });
});

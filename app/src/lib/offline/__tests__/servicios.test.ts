// Dos pajillas por vaca y día, no más. Esta prueba cubre la revisión del teléfono (sin señal):
// solo usa la cola pendiente, el historial y el catálogo descargado. Ejecutar con: pnpm test
import { describe, expect, it } from "vitest";
import { indiceOrdenos } from "../ordenos";
import { MAX_DOSIS_DIA, dosisConocidas, dosisDeServicio, dosisDelDia, revisarDosisServicio } from "../servicios";
import type { AnimalCatalogo, Catalogo, RegistroCola, RegistroHistorial, ServicioRegistrado } from "../tipos";

const VACA = "00000000-0000-4000-8000-000000000016";
const OTRA = "00000000-0000-4000-8000-000000000017";
const FINCA = "00000000-0000-4000-8000-000000000101";
const HOY = "2026-11-21";
const AYER = "2026-11-20";

const animal = (id: string, extra: Partial<AnimalCatalogo> = {}): AnimalCatalogo => ({
  id,
  codigo: `TON-${id.slice(-2)}`,
  chapeta: id.slice(-2),
  nombre: `Vaca ${id.slice(-2)}`,
  categoria: "vaca",
  sexo: "hembra",
  fecha_destete: null,
  en_ordeno: true,
  prenada: null,
  dias_ordeno: null,
  ultimo_parto: null,
  ultimo_servicio: null,
  palpar_el: null,
  secar_el: null,
  parto_esperado: null,
  litros_am: null,
  litros_pm: null,
  ...extra,
});

const catalogoCon = (animales: AnimalCatalogo[]) =>
  ({
    finca_id: FINCA,
    finca: { id: FINCA, nombre: "Toneles", municipio: null },
    corte: HOY,
    animales,
    potreros_estado: [],
    dias_descanso_objetivo: 35,
    grupos: [],
    rotaciones_abiertas: [],
    bienes: [],
    insumos: [],
    toros: [],
    descargado_en: `${HOY}T11:00:00.000Z`,
  }) as Catalogo;

const enCola = (accion: RegistroCola["accion"], datos: Record<string, unknown>): RegistroCola => ({
  cliente_id: crypto.randomUUID(),
  accion,
  datos,
  finca_id: FINCA,
  resumen: accion,
  creado_en: `${HOY}T11:30:00.000Z`,
  intentos: 0,
  estado: "pendiente",
  error: null,
  ultimo_intento: null,
});

const enviado = (accion: RegistroCola["accion"], datos: Record<string, unknown>): RegistroHistorial => ({
  ...enCola(accion, datos),
  resultado: "ok",
  mensaje: null,
  sincronizado_en: `${HOY}T11:35:00.000Z`,
});

const servicio = (datos: Record<string, unknown>) => ({ animal_id: VACA, fecha: HOY, tipo: "inseminacion", ...datos });
const conServicios = (servicios: ServicioRegistrado[]) => catalogoCon([animal(VACA, { servicios_recientes: servicios }), animal(OTRA, { servicios_recientes: [] })]);

describe("dosis de pajilla de un registro de servicio", () => {
  it("una pajilla con un solo toro, dos cuando viene el toro 2", () => {
    expect(dosisDeServicio(servicio({ toro_nombre: "Apolo" }))).toBe(1);
    expect(dosisDeServicio(servicio({ toro_nombre: "Apolo", toro2_nombre: "Zeus" }))).toBe(2);
    // El toro 2 también cuenta si solo se escribió la raza.
    expect(dosisDeServicio(servicio({ toro_nombre: "Apolo", toro2_raza: "Jersey" }))).toBe(2);
    // Campos vacíos del formulario: sigue siendo una sola pajilla.
    expect(dosisDeServicio(servicio({ toro_nombre: "Apolo", toro2_nombre: "  ", toro2_raza: "" }))).toBe(1);
  });
});

describe("dosis que el teléfono ya conoce", () => {
  it("suma las del catálogo y las de la cola pendiente", () => {
    const dosis = dosisConocidas([enCola("servicio", servicio({ toro_nombre: "Zeus" }))], conServicios([{ fecha: HOY, toros: ["Apolo"] }]));
    expect(dosis.get(`${VACA}|${HOY}`)).toBe(2);
    expect(dosis.get(`${OTRA}|${HOY}`)).toBeUndefined();
  });

  it("no cuenta dos veces la misma pajilla cuando ya está en el catálogo y en el historial", () => {
    // Caso normal después de sincronizar y volver a descargar: el mismo servicio se ve por los dos lados.
    const dosis = dosisConocidas([enviado("servicio", servicio({ toro_nombre: "Apolo" }))], conServicios([{ fecha: HOY, toros: ["apolo"] }]));
    expect(dosis.get(`${VACA}|${HOY}`)).toBe(1);
  });

  it("cuenta las dos pajillas de un servicio con toro 2 y separa los días", () => {
    const dosis = dosisConocidas([], conServicios([{ fecha: HOY, toros: ["Apolo", "Zeus"] }, { fecha: AYER, toros: ["Apolo"] }]));
    expect(dosis.get(`${VACA}|${HOY}`)).toBe(2);
    expect(dosis.get(`${VACA}|${AYER}`)).toBe(1);
  });

  it("un catálogo anterior (sin los servicios recientes) cuenta una dosis el día del último servicio", () => {
    const viejo = catalogoCon([animal(VACA, { ultimo_servicio: HOY })]);
    expect(dosisConocidas([], viejo).get(`${VACA}|${HOY}`)).toBe(1);
    // Y si ese mismo servicio ya está en el historial del teléfono, no se cuenta dos veces.
    expect(dosisConocidas([enviado("servicio", servicio({ toro_nombre: "Apolo" }))], viejo).get(`${VACA}|${HOY}`)).toBe(1);
  });

  it("el índice del teléfono lleva las dosis al lado de los ordeños", () => {
    const indice = indiceOrdenos([enCola("servicio", servicio({ toro_nombre: "Apolo" }))], conServicios([]));
    expect(dosisDelDia(indice, VACA, HOY)).toBe(1);
    expect(dosisDelDia(indice, OTRA, HOY)).toBe(0);
  });
});

describe("tope de 2 dosis por vaca y día", () => {
  const unaDosis = indiceOrdenos([], conServicios([{ fecha: HOY, toros: ["Apolo"] }]));
  const dosDosis = indiceOrdenos([], conServicios([{ fecha: HOY, toros: ["Apolo", "Zeus"] }]));

  it("deja la segunda pajilla del día", () => {
    expect(revisarDosisServicio("servicio", servicio({ toro_nombre: "Zeus" }), unaDosis, HOY)).toBeNull();
  });

  it("rechaza la tercera dosis del día", () => {
    const problema = revisarDosisServicio("servicio", servicio({ toro_nombre: "Toro nuevo" }), dosDosis, HOY);
    expect(problema).toMatch(/ya tiene 2 dosis de pajilla registradas hoy/);
    expect(problema).toMatch(new RegExp(`Solo se permiten ${MAX_DOSIS_DIA} dosis por día`));
  });

  it("rechaza un registro con dos toros cuando el día ya tiene una dosis", () => {
    const problema = revisarDosisServicio("servicio", servicio({ toro_nombre: "Zeus", toro2_nombre: "Toro nuevo" }), unaDosis, HOY);
    expect(problema).toMatch(/ya tiene 1 dosis de pajilla registrada hoy/);
    expect(problema).toMatch(/este registro trae 2 \(toro 1 y toro 2\)/);
  });

  it("no se mete con otro día, con otra vaca ni con otras acciones", () => {
    expect(revisarDosisServicio("servicio", servicio({ fecha: AYER, toro_nombre: "Toro nuevo" }), dosDosis, HOY)).toBeNull();
    expect(revisarDosisServicio("servicio", servicio({ animal_id: OTRA, toro_nombre: "Toro nuevo" }), dosDosis, HOY)).toBeNull();
    expect(revisarDosisServicio("palpacion", { animal_id: VACA, fecha: HOY, resultado: "vacia" }, dosDosis, HOY)).toBeNull();
  });

  it("cuenta las dosis de todas las jornadas del día", () => {
    // Una en la mañana y una en la tarde: el tope es por día, no por jornada.
    const indice = indiceOrdenos(
      [enCola("servicio", servicio({ jornada: "am", toro_nombre: "Apolo" })), enCola("servicio", servicio({ jornada: "pm", toro_nombre: "Zeus" }))],
      null,
    );
    expect(dosisDelDia(indice, VACA, HOY)).toBe(2);
    expect(revisarDosisServicio("servicio", servicio({ jornada: "pm", toro_nombre: "Toro nuevo" }), indice, HOY)).toMatch(/2 dosis de pajilla/);
  });
});

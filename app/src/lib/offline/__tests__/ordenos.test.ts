// Una vaca no se puede ordeñar dos veces en la misma jornada. Esta prueba cubre la revisión del teléfono
// (sin señal): solo usa la cola pendiente y el catálogo descargado. Ejecutar con: pnpm test
import { describe, expect, it } from "vitest";
import { indiceOrdenos, jornadaLibre, revisarOrdenoRepetido, textoJornadasCompletas, textoYaOrdenada, yaOrdenada } from "../ordenos";
import type { AnimalCatalogo, Catalogo, RegistroCola, RegistroHistorial } from "../tipos";

const VACA = "00000000-0000-4000-8000-000000000016";
const OTRA = "00000000-0000-4000-8000-000000000017";
const FINCA = "00000000-0000-4000-8000-000000000101";
const HOY = "2026-10-16";

const animal = (id: string, ordenos?: { fecha: string; jornada: "am" | "pm" }[]): AnimalCatalogo => ({
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
  ...(ordenos ? { ordenos_recientes: ordenos } : {}),
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

describe("ordeños que el teléfono ya conoce", () => {
  it("toma los del catálogo descargado y los de la cola pendiente", () => {
    const indice = indiceOrdenos(
      [enCola("ordeno", { animal_id: OTRA, fecha: HOY, jornada: "am", litros: 9 })],
      catalogoCon([animal(VACA, [{ fecha: HOY, jornada: "am" }]), animal(OTRA)]),
    );

    expect(yaOrdenada(indice, VACA, HOY, "am")).toBe(true);
    expect(yaOrdenada(indice, VACA, HOY, "pm")).toBe(false);
    expect(yaOrdenada(indice, OTRA, HOY, "am")).toBe(true);
    expect(yaOrdenada(indice, OTRA, "2026-10-15", "am")).toBe(false);
  });

  it("lee también los ordeños por lista que están en la cola", () => {
    const indice = indiceOrdenos(
      [enCola("ordeno_lista", { fecha: HOY, jornada: "pm", items: [{ animal_id: VACA, litros: 8 }, { animal_id: OTRA, litros: 7 }] })],
      null,
    );
    expect(yaOrdenada(indice, VACA, HOY, "pm")).toBe(true);
    expect(yaOrdenada(indice, OTRA, HOY, "pm")).toBe(true);
    expect(yaOrdenada(indice, VACA, HOY, "am")).toBe(false);
  });

  it("lo que ya se envió (historial) sigue bloqueando aunque el catálogo no se haya vuelto a descargar", () => {
    const indice = indiceOrdenos([enviado("ordeno", { animal_id: VACA, fecha: HOY, jornada: "pm", litros: 10 })], catalogoCon([animal(VACA)]));
    expect(yaOrdenada(indice, VACA, HOY, "pm")).toBe(true);
    expect(revisarOrdenoRepetido("ordeno", { animal_id: VACA, fecha: HOY, jornada: "pm", litros: 10 }, indice, HOY)).toMatch(/de la tarde de hoy/);
  });

  it("un catálogo viejo (sin la jornada del último ordeño) no bloquea nada", () => {
    const indice = indiceOrdenos([], catalogoCon([animal(VACA)]));
    expect(indice.size).toBe(0);
    expect(revisarOrdenoRepetido("ordeno", { animal_id: VACA, fecha: HOY, jornada: "am", litros: 10 }, indice, HOY)).toBeNull();
  });
});

describe("no se deja registrar dos veces la misma jornada", () => {
  const indice = indiceOrdenos([enCola("ordeno", { animal_id: VACA, fecha: HOY, jornada: "am", litros: 12 })], null);

  it("rechaza en el teléfono un segundo ordeño de la misma vaca, fecha y jornada", () => {
    const problema = revisarOrdenoRepetido("ordeno", { animal_id: VACA, fecha: HOY, jornada: "am", litros: 11 }, indice, HOY);
    expect(problema).toMatch(/Ya se registró el ordeño de la mañana de hoy/);
  });

  it("deja registrar la otra jornada del mismo día y la misma jornada de otra vaca", () => {
    expect(revisarOrdenoRepetido("ordeno", { animal_id: VACA, fecha: HOY, jornada: "pm", litros: 11 }, indice, HOY)).toBeNull();
    expect(revisarOrdenoRepetido("ordeno", { animal_id: OTRA, fecha: HOY, jornada: "am", litros: 11 }, indice, HOY)).toBeNull();
    expect(revisarOrdenoRepetido("ordeno", { animal_id: VACA, fecha: "2026-10-15", jornada: "am", litros: 11 }, indice, HOY)).toBeNull();
  });

  it("rechaza el ordeño por lista que incluye una vaca ya ordeñada en esa jornada", () => {
    const problema = revisarOrdenoRepetido(
      "ordeno_lista",
      { fecha: HOY, jornada: "am", items: [{ animal_id: VACA, litros: 10 }, { animal_id: OTRA, litros: 9 }] },
      indice,
      HOY,
    );
    expect(problema).toMatch(/1 vaca ya tiene el ordeño de la mañana de hoy/);
    expect(problema).toMatch(/Ya ordeñada/);
  });

  it("no se mete con otras acciones", () => {
    expect(revisarOrdenoRepetido("secado", { animal_id: VACA, fecha: HOY }, indice, HOY)).toBeNull();
    expect(revisarOrdenoRepetido("salud", { animal_id: VACA, fecha: HOY, jornada: "am" }, indice, HOY)).toBeNull();
  });

  it("propone la jornada que todavía se puede registrar", () => {
    expect(jornadaLibre(indice, VACA, HOY, "am")).toBe("pm");
    expect(jornadaLibre(indice, VACA, HOY, "pm")).toBe("pm");
    expect(jornadaLibre(indice, OTRA, HOY, "am")).toBe("am");
    const lasDos = indiceOrdenos(
      [enCola("ordeno_lista", { fecha: HOY, jornada: "pm", items: [{ animal_id: VACA, litros: 8 }] }), ...[enCola("ordeno", { animal_id: VACA, fecha: HOY, jornada: "am", litros: 9 })]],
      null,
    );
    expect(jornadaLibre(lasDos, VACA, HOY, "am")).toBeNull();
  });

  it("explica la jornada y el día en el aviso", () => {
    expect(textoYaOrdenada(HOY, "am", HOY)).toBe("Ya se registró el ordeño de la mañana de hoy.");
    expect(textoYaOrdenada(HOY, "pm", HOY)).toBe("Ya se registró el ordeño de la tarde de hoy.");
    expect(textoYaOrdenada("2026-10-15", "pm", HOY)).toBe("Ya se registró el ordeño de la tarde del 15/10.");
    expect(textoJornadasCompletas(HOY, HOY)).toBe("Ya se registró el ordeño de la mañana y de la tarde de hoy.");
  });
});

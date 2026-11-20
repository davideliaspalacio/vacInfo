import { describe, expect, it } from "vitest";
import {
  MAX_SANIDAD_ANIMAL,
  FALTA_DESCARGAR,
  agruparSanidad,
  armarHojaVida,
  desdeSanidad,
  diasEntre,
  edadTexto,
  hojaVidaDe,
  retiroVigente,
  textoMora,
  textoRetiro,
  type FilaSanidad,
} from "../hoja-vida";
import type { AnimalCatalogo, EventoSanitarioCatalogo, HojaVidaCatalogo } from "../tipos";

const HOY = "2026-11-20";

const animal = (extra: Partial<AnimalCatalogo> = {}): AnimalCatalogo => ({
  id: "a1",
  codigo: "001",
  chapeta: "1309",
  nombre: "Ayana",
  categoria: "vaca",
  sexo: "hembra",
  fecha_destete: null,
  en_ordeno: true,
  prenada: false,
  dias_ordeno: 312,
  ultimo_parto: "2025-06-21",
  ultimo_servicio: "2025-12-10",
  palpar_el: null,
  secar_el: "2026-07-08",
  parto_esperado: "2026-09-11",
  litros_am: null,
  litros_pm: null,
  ordenos_recientes: [],
  ...extra,
});

const evento = (extra: Partial<EventoSanitarioCatalogo> = {}): EventoSanitarioCatalogo => ({
  fecha: "2026-11-18",
  tipo: "mastitis",
  diagnostico: "Mastitis clínica",
  producto: "Antibiótico intramamario",
  cuartos: ["TDD"],
  dias_retiro: 5,
  fecha_fin: null,
  proxima_fecha: null,
  estado: "en_tratamiento",
  ...extra,
});

const hojaVida = (extra: Partial<HojaVidaCatalogo> = {}): HojaVidaCatalogo => ({
  fecha_nacimiento: "2021-03-15",
  madre: { nombre: "Milagros", chapeta: "2092" },
  padre: { nombre: "Trueno", chapeta: null },
  mora_prenez: null,
  sanidad: [],
  ...extra,
});

describe("fechas y edad", () => {
  it("trae los eventos sanitarios de los últimos 12 meses", () => {
    expect(desdeSanidad("2026-11-20")).toBe("2025-11-20");
    expect(desdeSanidad("2026-01-05")).toBe("2025-01-05");
    expect(desdeSanidad("2026-11-20", 6)).toBe("2026-05-20");
  });

  it("cuenta los días entre dos fechas sin corrimientos", () => {
    expect(diasEntre("2026-11-20", "2026-11-25")).toBe(5);
    expect(diasEntre("2026-11-20", "2026-11-20")).toBe(0);
    expect(diasEntre("2026-11-20", "2026-11-18")).toBe(-2);
  });

  it("dice la edad en palabras y no se inventa una sin fecha de nacimiento", () => {
    expect(edadTexto("2026-03-20", HOY)).toBe("8 meses");
    expect(edadTexto("2026-10-20", HOY)).toBe("1 mes");
    expect(edadTexto("2021-03-15", HOY)).toBe("5 años y 8 meses");
    expect(edadTexto("2024-11-20", HOY)).toBe("2 años");
    expect(edadTexto(null, HOY)).toBeNull();
  });
});

describe("mora de preñez", () => {
  it("explica en palabras una mora negativa (la vaca sigue en descanso)", () => {
    expect(textoMora(animal(), -12).detalle).toBe("Está en descanso, faltan 12 días para poder inseminar.");
    // El texto del detalle lo pone `lib/mora.ts` (criterio compartido con la web); aquí solo importa que explique el descanso.
    expect(textoMora(animal(), -1).valor).toBe("En descanso");
    expect(textoMora(animal(), -12).alerta).toBe(false);
  });

  it("avisa cuando hay retraso", () => {
    expect(textoMora(animal(), 20).valor).toBe("20 días de retraso");
    expect(textoMora(animal(), 1).valor).toBe("1 día de retraso");
    expect(textoMora(animal(), 20).alerta).toBe(true);
  });

  it("en cero dice que ya se puede inseminar", () => {
    expect(textoMora(animal(), 0).valor).toBe("Al día");
    expect(textoMora(animal(), 0).detalle).toContain("ya se puede inseminar");
  });

  it("sin número explica por qué no aplica", () => {
    expect(textoMora(animal({ en_ordeno: false }), null).detalle).toBe("Solo se cuenta mientras el animal está en ordeño.");
    expect(textoMora(animal(), undefined).valor).toBe("Sin dato");
  });

  it("en una vaca ya preñada la cuenta en pasado y sin alerta", () => {
    const prenada = animal({ prenada: true });
    expect(textoMora(prenada, 127)).toMatchObject({ valor: "127 días de retraso", alerta: false });
    expect(textoMora(prenada, 127).detalle).toContain("Mora cerrada el día del servicio");
    expect(textoMora(prenada, -10)).toMatchObject({ valor: "Sin retraso", alerta: false });
    expect(textoMora(prenada, 0).valor).toBe("Al día");
  });
});

describe("retiro de leche", () => {
  it("avisa del retiro vigente contando desde la fecha de fin del tratamiento", () => {
    const retiro = retiroVigente([evento({ fecha: "2026-11-18", dias_retiro: 5 })], HOY);
    expect(retiro).toMatchObject({ hasta: "2026-11-23", faltan: 4 });
    expect(textoRetiro(retiro!)).toContain("No entregues la leche de esta vaca");
    expect(textoRetiro(retiro!)).toContain("23/11/2026");
  });

  it("el último día todavía cuenta y un retiro vencido no avisa", () => {
    expect(retiroVigente([evento({ fecha: "2026-11-15", dias_retiro: 5 })], HOY)).toMatchObject({ hasta: "2026-11-20", faltan: 1 });
    expect(retiroVigente([evento({ fecha: "2026-11-01", dias_retiro: 5 })], HOY)).toBeNull();
    expect(retiroVigente([evento({ dias_retiro: null })], HOY)).toBeNull();
    expect(retiroVigente([], HOY)).toBeNull();
  });

  it("de varios retiros se queda con el que termina más tarde", () => {
    const retiro = retiroVigente(
      [evento({ fecha: "2026-11-18", dias_retiro: 3, producto: "Corto" }), evento({ fecha: "2026-11-19", dias_retiro: 10, producto: "Largo" })],
      HOY,
    );
    expect(retiro).toMatchObject({ hasta: "2026-11-29", producto: "Largo" });
  });

  it("cuenta el retiro desde fecha_fin cuando el tratamiento duró varios días", () => {
    expect(retiroVigente([evento({ fecha: "2026-11-10", fecha_fin: "2026-11-19", dias_retiro: 4 })], HOY)).toMatchObject({ hasta: "2026-11-23" });
  });
});

describe("armado del catálogo", () => {
  const fila = (extra: Partial<FilaSanidad> = {}): FilaSanidad => ({ animal_id: "a1", ...evento(), ...extra });

  it("agrupa por animal, lo más nuevo primero y sin pasar el tope por animal", () => {
    // Una fecha distinta por evento, de la más vieja a la más nueva (así se comprueba que se reordena).
    const filas = Array.from({ length: MAX_SANIDAD_ANIMAL + 4 }, (_, i) => fila({ fecha: `2026-01-${String(i + 1).padStart(2, "0")}`, tipo: "vacuna" }));
    const agrupado = agruparSanidad([...filas, fila({ animal_id: "a2", fecha: "2026-05-05" })]);
    expect(agrupado.get("a1")).toHaveLength(MAX_SANIDAD_ANIMAL);
    expect(agrupado.get("a1")![0].fecha).toBe(`2026-01-0${MAX_SANIDAD_ANIMAL + 4}`);
    expect(agrupado.get("a1")!.map((e) => e.fecha)).toEqual([...agrupado.get("a1")!.map((e) => e.fecha)].sort().reverse());
    expect(agrupado.get("a2")).toHaveLength(1);
    expect(agrupado.get("a1")![0]).not.toHaveProperty("animal_id");
  });

  it("respeta un tope por animal más pequeño", () => {
    expect(agruparSanidad([fila(), fila({ fecha: "2026-10-01" }), fila({ fecha: "2026-09-01" })], 2)).toEqual(
      new Map([["a1", [expect.objectContaining({ fecha: "2026-11-18" }), expect.objectContaining({ fecha: "2026-10-01" })]]]),
    );
  });

  it("toma la mamá de su ficha (con chapeta real) y si no, del nombre escrito a mano", () => {
    const fichas = new Map([["m1", { nombre: "Milagros", chapeta: "2092" }]]);
    const base = { fecha_nacimiento: "2025-11-11", madre_id: "m1", madre_nombre: "Mila", madre_chapeta: null, padre_nombre: null, padre_chapeta: null };
    expect(hojaVidaDe(base, { mora_prenez: null, fichas }).madre).toEqual({ nombre: "Milagros", chapeta: "2092" });
    expect(hojaVidaDe({ ...base, madre_id: "borrada" }, { mora_prenez: null, fichas }).madre).toEqual({ nombre: "Mila", chapeta: null });
    expect(hojaVidaDe({ ...base, madre_id: null, madre_nombre: "  " }, { mora_prenez: null, fichas }).madre).toBeNull();
  });

  it("deja el papá con nombre y chapeta, y la mora tal como la da la base (también negativa)", () => {
    const hv = hojaVidaDe(
      { fecha_nacimiento: null, madre_id: null, madre_nombre: null, madre_chapeta: null, padre_nombre: "Trueno", padre_chapeta: "T7" },
      { mora_prenez: -12, sanidad: [evento()] },
    );
    expect(hv).toMatchObject({ padre: { nombre: "Trueno", chapeta: "T7" }, mora_prenez: -12, fecha_nacimiento: null });
    expect(hv.sanidad).toHaveLength(1);
  });
});

describe("pantalla de hoja de vida", () => {
  const valor = (vista: { identificacion: { etiqueta: string; valor: string }[]; ciclo: { etiqueta: string; valor: string }[] }, etiqueta: string) =>
    [...vista.identificacion, ...vista.ciclo].find((d) => d.etiqueta === etiqueta)!;

  it("muestra identificación, mamá, papá y el ciclo tal como vienen del catálogo", () => {
    const vista = armarHojaVida(animal({ hoja_vida: hojaVida() }), { hoy: HOY, sanidadDesde: "2025-11-20" });
    expect(vista.faltanDatos).toBe(false);
    expect(valor(vista, "Chapeta").valor).toBe("1309");
    expect(valor(vista, "Fecha de nacimiento")).toMatchObject({ valor: "15/03/2021", detalle: "5 años y 8 meses" });
    expect(valor(vista, "Mamá").valor).toBe("Milagros · chapeta 2092");
    expect(valor(vista, "Papá").valor).toBe("Trueno");
    expect(valor(vista, "Fecha del último parto").valor).toBe("21/06/2025");
    expect(valor(vista, "Días en ordeño").valor).toBe("312 días");
    expect(valor(vista, "Fecha servida").valor).toBe("10/12/2025");
    expect(valor(vista, "Fecha posible de secado").valor).toBe("08/07/2026");
    expect(valor(vista, "Posible fecha de nacimiento de la cría").valor).toBe("11/09/2026");
  });

  it("dice «Sin dato» en vez de romperse cuando el ciclo viene vacío", () => {
    const vacia = animal({
      hoja_vida: hojaVida({ fecha_nacimiento: null, madre: null, padre: null }),
      ultimo_parto: null,
      ultimo_servicio: null,
      secar_el: null,
      parto_esperado: null,
      dias_ordeno: null,
      en_ordeno: false,
    });
    const vista = armarHojaVida(vacia, { hoy: HOY });
    // Todo lo que falta se lee «Sin dato»; la mora dice «No aplica» porque la vaca no está en ordeño.
    expect([...vista.identificacion, ...vista.ciclo].filter((d) => d.valor === "Sin dato")).toHaveLength(8);
    expect(valor(vista, "Mora de preñez")).toMatchObject({ valor: "No aplica", detalle: "Solo se cuenta mientras el animal está en ordeño." });
    expect(vista.sanidad).toEqual([]);
    expect(vista.retiro).toBeNull();
  });

  it("pone la mora negativa en palabras dentro del ciclo", () => {
    const vista = armarHojaVida(animal({ hoja_vida: hojaVida({ mora_prenez: -12 }) }), { hoy: HOY });
    expect(valor(vista, "Mora de preñez")).toMatchObject({ valor: "En descanso", detalle: "Está en descanso, faltan 12 días para poder inseminar." });
  });

  it("ordena la salud de lo más nuevo a lo más viejo y avisa del retiro vigente", () => {
    const vista = armarHojaVida(animal({ hoja_vida: hojaVida({ sanidad: [evento(), evento({ fecha: "2026-02-02", tipo: "vacuna", dias_retiro: null })] }) }), {
      hoy: HOY,
    });
    expect(vista.sanidad.map((e) => e.fecha)).toEqual(["2026-11-18", "2026-02-02"]);
    expect(vista.retiro).toMatchObject({ hasta: "2026-11-23" });
  });

  it("con un catálogo viejo (sin hoja de vida) no se rompe: pide descargar de nuevo", () => {
    const viejo = animal({ hoja_vida: null });
    const vista = armarHojaVida(viejo, { hoy: HOY });
    expect(vista.faltanDatos).toBe(true);
    expect(valor(vista, "Fecha de nacimiento")).toMatchObject({ valor: FALTA_DESCARGAR, sinDescarga: true });
    expect(valor(vista, "Mamá").valor).toBe(FALTA_DESCARGAR);
    expect(valor(vista, "Papá").valor).toBe(FALTA_DESCARGAR);
    expect(valor(vista, "Mora de preñez").valor).toBe(FALTA_DESCARGAR);
    expect(vista.sanidad).toEqual([]);
    expect(vista.retiro).toBeNull();
    // Lo que el catálogo viejo sí trae se sigue mostrando.
    expect(valor(vista, "Fecha del último parto").valor).toBe("21/06/2025");
    expect(valor(vista, "Días en ordeño").valor).toBe("312 días");
  });

  it("un animal de un catálogo viejo de verdad (sin la clave) se lee igual", () => {
    const sinClave = animal();
    delete sinClave.hoja_vida;
    expect(armarHojaVida(sinClave, { hoy: HOY }).faltanDatos).toBe(true);
  });
});

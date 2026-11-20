/**
 * Planilla de implementación de seres vivos.
 *
 * Las pruebas de lectura corren siempre: se arma un .xlsx de ejemplo sobre la plantilla real.
 * La integración contra el Supabase local (finca Toneles) corre con:
 *   VACDATA_INTEGRACION=1 pnpm exec vitest run src/lib/importador/__tests__/seres-vivos.test.ts
 * y borra al final todo lo que creó.
 */
import ExcelJS from "exceljs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/database.types";
import { generarPlantillaSeresVivos } from "../seres-vivos-plantilla";
import { campoDeEncabezado, categoriaDerivada, leerPlanillaSeresVivos, siNoDeTexto, type PlanSeresVivos } from "../seres-vivos";
import { aplicarSeresVivos, previsualizarSeresVivos } from "../seres-vivos-aplicar";
import { DIAS_GESTACION, DIAS_MORA_PRENEZ, DIAS_SECADO_TRAS_SERVICIO, proyectarDatosProductivos } from "../reproduccion-proyectada";
import { diasEntre, sumarDiasISO } from "../normalizar";

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:55321";
const CLAVE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const TONELES = "00000000-0000-4000-8000-000000000101";

/** Chapeta de una vaca que ya está registrada en la finca Toneles (Alegría, TON-1003). */
const CHAPETA_EXISTENTE = "1003";
const HOY = "2026-10-16";

type Cliente = SupabaseClient<Database>;

/** Fecha ISO de hace `meses` meses contada desde HOY. */
function haceMeses(meses: number) {
  const [a, m, d] = HOY.split("-").map(Number);
  const f = new Date(Date.UTC(a, m - 1 - meses, d));
  return f.toISOString().slice(0, 10);
}

const comoDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const ddmmaaaa = (iso: string) => iso.split("-").reverse().join("/");

type Celdas = Record<string, string | number | Date | null>;

/**
 * Filas de ejemplo con los casos borde que hay que cubrir. Usan los nombres NUEVOS de columna de la
 * planilla del cliente (HEMBRA O MACHO, PAPÁ, MAMÁ, FECHA ÚLTIMO PARTO, FECHA SERVIDA); los viejos
 * se prueban aparte, en «lee igual una planilla con los títulos viejos».
 */
const FILAS: Celdas[] = [
  // Madre que llega en la misma planilla (la hija de abajo la referencia por chapeta).
  {
    ESPECIE: "Bovino",
    "HEMBRA O MACHO": "Hembra",
    NOMBRE: "Prueba Madre",
    "FECHA NACIMIENTO": comoDate(haceMeses(40)),
    CHAPETA: "ZPRU0",
    PESO: 480,
    RAZA: "Jersy",
    // Su madre sí está registrada en la finca: debe quedar enlazada por chapeta.
    MAMÁ: "Alegria",
    "CHAPETA MAMÁ": CHAPETA_EXISTENTE,
    // Historial: vaca en ordeño con litros → parto + ordeño de la mañana, y servida → servicio.
    "FECHA ÚLTIMO PARTO": comoDate(haceMeses(3)),
    "FECHA SERVIDA": comoDate(haceMeses(1)),
    "EN ORDEÑO": "Sí",
    "LITROS ÚLTIMO ORDEÑO": 12.5,
    // Lo que el ganadero escribió en las columnas calculadas: se avisa y no se guarda.
    "DÍAS ORDEÑO": 999,
    "MORA PREÑEZ": 7,
    "FECHA POSIBLE DE SECADO": comoDate("2027-01-01"),
  },
  // Hija: ternera (5 meses) con la madre enlazada por chapeta dentro del archivo.
  {
    ESPECIE: "bovino",
    "HEMBRA O MACHO": "h",
    NOMBRE: "Prueba Cria",
    "FECHA NACIMIENTO": ddmmaaaa(haceMeses(5)),
    CHAPETA: "ZPRU1",
    PESO: 95,
    MAMÁ: "Prueba Madre",
    "CHAPETA MAMÁ": "ZPRU0",
  },
  { ESPECIE: "Bovino", "HEMBRA O MACHO": "Macho", NOMBRE: "Prueba Ternero", "FECHA NACIMIENTO": comoDate(haceMeses(6)), CHAPETA: "ZPRU2", PESO: 120 },
  { ESPECIE: "Bovino", "HEMBRA O MACHO": "Macho", NOMBRE: "Prueba Novillo", "FECHA NACIMIENTO": comoDate(haceMeses(18)), CHAPETA: "ZPRU3", PESO: 300 },
  { ESPECIE: "Bovino", "HEMBRA O MACHO": "Macho", NOMBRE: "Prueba Toro", "FECHA NACIMIENTO": comoDate(haceMeses(40)), CHAPETA: "ZPRU4", PESO: 700 },
  // Sin fecha de nacimiento: la hembra queda vaca. Historial: seca → parto + secado, sin ordeños,
  // y con fecha servida posterior al parto → servicio.
  {
    ESPECIE: "Bovino",
    "HEMBRA O MACHO": "Hembra",
    NOMBRE: "Prueba Sin Fecha",
    CHAPETA: "ZPRU5",
    PESO: 450,
    "FECHA ÚLTIMO PARTO": ddmmaaaa(haceMeses(10)),
    "FECHA SERVIDA": ddmmaaaa(haceMeses(4)),
    "EN ORDEÑO": "no",
  },
  // Caballo: categoría caballo y especie equino.
  {
    ESPECIE: "Caballo",
    "HEMBRA O MACHO": "Macho",
    NOMBRE: "Prueba Caballo",
    "FECHA NACIMIENTO": comoDate(haceMeses(60)),
    CHAPETA: "ZPRU6",
    PESO: 400,
    COLOR: "castaño",
  },
  // Peso fuera de rango: se importa sin peso y sin pesaje. En ordeño con litros: parto + ordeño.
  {
    ESPECIE: "Bovino",
    "HEMBRA O MACHO": "Hembra",
    NOMBRE: "Prueba Peso",
    "FECHA NACIMIENTO": comoDate(haceMeses(20)),
    CHAPETA: "ZPRU7",
    PESO: 2000,
    "FECHA ÚLTIMO PARTO": comoDate(haceMeses(1)),
    "EN ORDEÑO": "SI",
    "LITROS ÚLTIMO ORDEÑO": 8,
  },
  // Madre que no existe en ninguna parte: se guardan nombre y chapeta sin enlazar.
  {
    ESPECIE: "Bovino",
    "HEMBRA O MACHO": "Hembra",
    NOMBRE: "Prueba Madre Ajena",
    "FECHA NACIMIENTO": comoDate(haceMeses(24)),
    CHAPETA: "ZPRU8",
    PESO: 380,
    MAMÁ: "Fantasma",
    "CHAPETA MAMÁ": "ZNOEXISTE",
    PAPÁ: "Toro Prestado",
    "CHAPETA PAPÁ": "ZPAD9",
  },
  // Fecha futura: se deja vacía y la hembra queda vaca. «Sí» sin litros: no se crea ningún ordeño.
  {
    ESPECIE: "Bovino",
    "HEMBRA O MACHO": "Hembra",
    NOMBRE: "Prueba Futura",
    "FECHA NACIMIENTO": comoDate("2030-01-01"),
    CHAPETA: "ZPRU9",
    PESO: 400,
    "FECHA ÚLTIMO PARTO": comoDate(haceMeses(2)),
    "EN ORDEÑO": "si",
  },
  // Parto futuro: se avisa y no se registra el parto.
  {
    ESPECIE: "Bovino",
    "HEMBRA O MACHO": "Hembra",
    NOMBRE: "Prueba Parto Futuro",
    "FECHA NACIMIENTO": comoDate(haceMeses(40)),
    CHAPETA: "ZPRUB",
    PESO: 500,
    "FECHA ÚLTIMO PARTO": comoDate("2030-05-04"),
  },
  // Parto anterior a la fecha de nacimiento: se avisa y no se registra el parto.
  {
    ESPECIE: "Bovino",
    "HEMBRA O MACHO": "Hembra",
    NOMBRE: "Prueba Parto Viejo",
    "FECHA NACIMIENTO": comoDate(haceMeses(30)),
    CHAPETA: "ZPRUC",
    PESO: 480,
    "FECHA ÚLTIMO PARTO": comoDate("2023-01-15"),
  },
  // Litros fuera del rango 0–60: se avisa, el parto sí se registra y el ordeño no.
  // Fecha servida futura: se avisa y no se registra el servicio.
  {
    ESPECIE: "Bovino",
    "HEMBRA O MACHO": "Hembra",
    NOMBRE: "Prueba Litros",
    "FECHA NACIMIENTO": comoDate(haceMeses(40)),
    CHAPETA: "ZPRUD",
    PESO: 460,
    "FECHA ÚLTIMO PARTO": comoDate(haceMeses(2)),
    "FECHA SERVIDA": comoDate("2030-07-07"),
    "EN ORDEÑO": "Sí",
    "LITROS ÚLTIMO ORDEÑO": 80,
  },
  // Macho con historial: no se ordeña y no puede tener partos ni servicios.
  {
    ESPECIE: "Bovino",
    "HEMBRA O MACHO": "Macho",
    NOMBRE: "Prueba Macho Ordeño",
    "FECHA NACIMIENTO": comoDate(haceMeses(40)),
    CHAPETA: "ZPRUE",
    PESO: 800,
    "FECHA ÚLTIMO PARTO": comoDate(haceMeses(2)),
    "FECHA SERVIDA": comoDate(haceMeses(1)),
    "EN ORDEÑO": "Sí",
    "LITROS ÚLTIMO ORDEÑO": 10,
  },
  // Ternera en ordeño y servida: se avisa y se ignoran las dos cosas.
  {
    ESPECIE: "Bovino",
    "HEMBRA O MACHO": "Hembra",
    NOMBRE: "Prueba Ternera Ordeño",
    "FECHA NACIMIENTO": comoDate(haceMeses(6)),
    CHAPETA: "ZPRUF",
    PESO: 90,
    "FECHA SERVIDA": comoDate(haceMeses(1)),
    "EN ORDEÑO": "Sí",
    "LITROS ÚLTIMO ORDEÑO": 5,
  },
  // Novilla servida sin parto: no hay parto que registrar, pero sí el servicio.
  {
    ESPECIE: "Bovino",
    "HEMBRA O MACHO": "Hembra",
    NOMBRE: "Prueba Novilla Servida",
    "FECHA NACIMIENTO": comoDate(haceMeses(20)),
    CHAPETA: "ZPRUG",
    PESO: 350,
    "FECHA SERVIDA": comoDate(haceMeses(2)),
  },
  // Chapeta repetida dentro del archivo.
  { ESPECIE: "Bovino", "HEMBRA O MACHO": "Hembra", NOMBRE: "Prueba Clon", "FECHA NACIMIENTO": comoDate(haceMeses(20)), CHAPETA: "ZPRU1", PESO: 300 },
  // Sexo que no se entiende.
  { ESPECIE: "Bovino", "HEMBRA O MACHO": "???", NOMBRE: "Prueba Sin Sexo", "FECHA NACIMIENTO": comoDate(haceMeses(20)), CHAPETA: "ZPRUA", PESO: 300 },
  // Sin nombre ni chapeta.
  { ESPECIE: "Bovino", "HEMBRA O MACHO": "Hembra", PESO: 300 },
  // Animal que ya está registrado en la finca (misma chapeta).
  {
    ESPECIE: "Bovino",
    "HEMBRA O MACHO": "Hembra",
    NOMBRE: "Alegria",
    "FECHA NACIMIENTO": comoDate(haceMeses(50)),
    CHAPETA: CHAPETA_EXISTENTE,
    PESO: 500,
  },
];

/** Llena la plantilla real con las filas de ejemplo y devuelve el .xlsx. */
async function planillaDeEjemplo(filas: Celdas[], finca = "Finca Toneles") {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await generarPlantillaSeresVivos()) as unknown as ExcelJS.Buffer);
  const ws = wb.getWorksheet("Seres vivos")!;

  let filaEncabezados = 0;
  const columnas = new Map<string, number>();
  for (let r = 1; r <= 10 && !filaEncabezados; r++) {
    const fila = ws.getRow(r);
    const encontradas = new Map<string, number>();
    fila.eachCell((celda, c) => {
      const t = typeof celda.value === "string" ? celda.value.trim() : "";
      if (t) encontradas.set(t, c);
    });
    if (encontradas.has("ESPECIE")) {
      filaEncabezados = r;
      for (const [k, v] of encontradas) columnas.set(k, v);
    }
  }
  expect(filaEncabezados).toBeGreaterThan(0);
  ws.getCell(`B${filaEncabezados - 2}`).value = finca;

  filas.forEach((datos, i) => {
    const fila = ws.getRow(filaEncabezados + 1 + i);
    for (const [titulo, valor] of Object.entries(datos)) {
      const c = columnas.get(titulo);
      expect(c, `columna ${titulo}`).toBeDefined();
      fila.getCell(c!).value = valor;
    }
  });

  return Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);
}

describe("encabezados y categorías", () => {
  it("reconoce los títulos con tildes, minúsculas y variantes", () => {
    expect(campoDeEncabezado("#")).toBe("numero");
    expect(campoDeEncabezado("No.")).toBe("numero");
    expect(campoDeEncabezado("especie")).toBe("especie");
    expect(campoDeEncabezado("Fecha de Nacimiento")).toBe("fechaNacimiento");
    expect(campoDeEncabezado("FECHA NACIMIENTO")).toBe("fechaNacimiento");
    expect(campoDeEncabezado("Peso (kg)")).toBe("peso");
    expect(campoDeEncabezado("Chapeta")).toBe("chapeta");
    expect(campoDeEncabezado("CHAPETA PADRE")).toBe("chapetaPadre");
    expect(campoDeEncabezado("Chapeta de la madre")).toBe("chapetaMadre");
    expect(campoDeEncabezado("Nombre del padre")).toBe("padre");
    expect(campoDeEncabezado("MADRE")).toBe("madre");
    expect(campoDeEncabezado("NOMBRE")).toBe("nombre");
    expect(campoDeEncabezado("Observaciones")).toBeNull();
  });

  it("reconoce los títulos nuevos de la planilla del cliente", () => {
    expect(campoDeEncabezado("HEMBRA O MACHO")).toBe("sexo");
    expect(campoDeEncabezado("Hembra o macho")).toBe("sexo");
    expect(campoDeEncabezado("H/M")).toBe("sexo");
    expect(campoDeEncabezado("PAPÁ")).toBe("padre");
    expect(campoDeEncabezado("papa")).toBe("padre");
    expect(campoDeEncabezado("CHAPETA PAPÁ")).toBe("chapetaPadre");
    expect(campoDeEncabezado("MAMÁ")).toBe("madre");
    expect(campoDeEncabezado("CHAPETA MAMÁ")).toBe("chapetaMadre");
    // Los viejos siguen valiendo: las planillas ya repartidas se importan igual.
    expect(campoDeEncabezado("SEXO")).toBe("sexo");
    expect(campoDeEncabezado("PADRE")).toBe("padre");
    expect(campoDeEncabezado("MADRE")).toBe("madre");
    expect(campoDeEncabezado("CHAPETA MADRE")).toBe("chapetaMadre");
  });

  it("reconoce los títulos de historial y no confunde los calculados", () => {
    expect(campoDeEncabezado("FECHA ÚLTIMO PARTO")).toBe("ultimoParto");
    expect(campoDeEncabezado("ÚLTIMO PARTO")).toBe("ultimoParto");
    expect(campoDeEncabezado("Fecha del último parto")).toBe("ultimoParto");
    expect(campoDeEncabezado("FECHA SERVIDA")).toBe("fechaServida");
    expect(campoDeEncabezado("Fecha de servicio")).toBe("fechaServida");
    expect(campoDeEncabezado("Último servicio")).toBe("fechaServida");
    expect(campoDeEncabezado("EN ORDEÑO")).toBe("enOrdeno");
    expect(campoDeEncabezado("en ordeno")).toBe("enOrdeno");
    expect(campoDeEncabezado("LITROS ÚLTIMO ORDEÑO")).toBe("litrosOrdeno");
    expect(campoDeEncabezado("Litros del último ordeño")).toBe("litrosOrdeno");
    // Las cuatro que calcula el sistema: se reconocen aparte para no leerlas como otra cosa.
    expect(campoDeEncabezado("DÍAS ORDEÑO")).toBe("diasOrdeno");
    expect(campoDeEncabezado("dias ordeno")).toBe("diasOrdeno");
    expect(campoDeEncabezado("MORA PREÑEZ")).toBe("moraPrenez");
    expect(campoDeEncabezado("FECHA POSIBLE DE SECADO")).toBe("fechaSecado");
    expect(campoDeEncabezado("POSIBLE FECHA NACIMIENTO CRÍA")).toBe("partoEsperado");
    // El título del bloque no es una columna.
    expect(campoDeEncabezado("DATOS DE VACAS PRODUCTIVOS")).toBeNull();
  });

  it("entiende el sí y el no de la columna EN ORDEÑO", () => {
    expect(siNoDeTexto("Sí")).toBe(true);
    expect(siNoDeTexto("si")).toBe(true);
    expect(siNoDeTexto("SI")).toBe(true);
    expect(siNoDeTexto("S")).toBe(true);
    expect(siNoDeTexto("X")).toBe(true);
    expect(siNoDeTexto("true")).toBe(true);
    expect(siNoDeTexto("No")).toBe(false);
    expect(siNoDeTexto("N")).toBe(false);
    expect(siNoDeTexto("seca")).toBe(false);
    expect(siNoDeTexto("horra")).toBe(false);
    expect(siNoDeTexto("false")).toBe(false);
    expect(siNoDeTexto("tal vez")).toBeNull();
    expect(siNoDeTexto(null)).toBeNull();
    expect(siNoDeTexto("")).toBeNull();
  });

  it("deriva la categoría por especie, sexo y edad", () => {
    expect(categoriaDerivada("bovino", "hembra", haceMeses(6), HOY)).toBe("ternera");
    expect(categoriaDerivada("bovino", "hembra", haceMeses(12), HOY)).toBe("novilla");
    expect(categoriaDerivada("bovino", "hembra", haceMeses(24), HOY)).toBe("novilla");
    // Una novilla que todavía no han servido no se vuelve vaca sola: hasta los 36 meses sigue novilla.
    expect(categoriaDerivada("bovino", "hembra", haceMeses(25), HOY)).toBe("novilla");
    expect(categoriaDerivada("bovino", "hembra", haceMeses(36), HOY)).toBe("novilla");
    // Sin un solo dato a esa edad, es una vaca cargada sin historial.
    expect(categoriaDerivada("bovino", "hembra", haceMeses(37), HOY)).toBe("vaca");
    expect(categoriaDerivada("bovino", "hembra", haceMeses(60), HOY)).toBe("vaca");
    expect(categoriaDerivada("bovino", "hembra", haceMeses(120), HOY)).toBe("vaca");
    expect(categoriaDerivada("bovino", "hembra", null, HOY)).toBe("vaca");
    expect(categoriaDerivada("bovino", "macho", haceMeses(11), HOY)).toBe("ternero");
    expect(categoriaDerivada("bovino", "macho", haceMeses(12), HOY)).toBe("novillo");
    expect(categoriaDerivada("bovino", "macho", haceMeses(24), HOY)).toBe("novillo");
    expect(categoriaDerivada("bovino", "macho", haceMeses(25), HOY)).toBe("toro");
    expect(categoriaDerivada("bovino", "macho", null, HOY)).toBe("toro");
  });

  it("si la fila trae último parto, la hembra es vaca aunque sea joven", () => {
    expect(categoriaDerivada("bovino", "hembra", haceMeses(20), HOY, true)).toBe("vaca");
    expect(categoriaDerivada("bovino", "hembra", haceMeses(11), HOY, true)).toBe("vaca");
    // El parto no cambia nada en machos ni en otras especies.
    expect(categoriaDerivada("bovino", "macho", haceMeses(20), HOY, true)).toBe("novillo");
    expect(categoriaDerivada("equino", "hembra", haceMeses(60), HOY, true)).toBe("caballo");
    expect(categoriaDerivada("equino", "hembra", haceMeses(60), HOY)).toBe("caballo");
    expect(categoriaDerivada("canino", "macho", haceMeses(20), HOY)).toBe("perro");
    expect(categoriaDerivada("ave", "hembra", haceMeses(6), HOY)).toBe("otro");
    expect(categoriaDerivada("otro", "macho", null, HOY)).toBe("otro");
  });
});

describe("datos de vacas productivas que calcula el sistema", () => {
  it("calcula días en ordeño, mora con signo, secado y nacimiento de la cría", () => {
    const parto = sumarDiasISO(HOY, -100);
    const servida = sumarDiasISO(HOY, -30);
    expect(proyectarDatosProductivos({ ultimoParto: parto, fechaServida: servida }, HOY)).toEqual({
      diasOrdeno: 100,
      moraPrenez: 100 - DIAS_MORA_PRENEZ,
      secadoEl: sumarDiasISO(servida, DIAS_SECADO_TRAS_SERVICIO),
      partoEsperado: sumarDiasISO(servida, DIAS_GESTACION),
    });
  });

  it("la mora es negativa mientras la vaca descansa sus 45 días", () => {
    const recienParida = proyectarDatosProductivos({ ultimoParto: sumarDiasISO(HOY, -10), fechaServida: null }, HOY);
    expect(recienParida.diasOrdeno).toBe(10);
    expect(recienParida.moraPrenez).toBe(10 - DIAS_MORA_PRENEZ);
    expect(recienParida.moraPrenez).toBeLessThan(0);
    // El día 45 la mora llega a 0: ya se puede inseminar.
    expect(proyectarDatosProductivos({ ultimoParto: sumarDiasISO(HOY, -DIAS_MORA_PRENEZ), fechaServida: null }, HOY).moraPrenez).toBe(0);
  });

  it("sin parto no hay días en ordeño ni mora; una vaca seca tampoco los tiene", () => {
    expect(proyectarDatosProductivos({ ultimoParto: null, fechaServida: null }, HOY)).toMatchObject({ diasOrdeno: null, moraPrenez: null });
    // Solo con fecha servida ya hay secado y nacimiento posible (la novilla servida).
    const servida = sumarDiasISO(HOY, -60);
    expect(proyectarDatosProductivos({ ultimoParto: null, fechaServida: servida }, HOY)).toEqual({
      diasOrdeno: null,
      moraPrenez: null,
      secadoEl: sumarDiasISO(servida, DIAS_SECADO_TRAS_SERVICIO),
      partoEsperado: sumarDiasISO(servida, DIAS_GESTACION),
    });
    expect(proyectarDatosProductivos({ ultimoParto: sumarDiasISO(HOY, -200), fechaServida: null, seca: true }, HOY)).toMatchObject({
      diasOrdeno: null,
      moraPrenez: null,
    });
  });
});

describe("lectura de la planilla", () => {
  let plan: PlanSeresVivos;

  beforeAll(async () => {
    plan = (await leerPlanillaSeresVivos(await planillaDeEjemplo(FILAS), HOY))!;
  }, 30_000);

  it("lee la hoja, la finca del encabezado y las filas válidas", () => {
    expect(plan).toBeTruthy();
    expect(plan.hoja).toBe("Seres vivos");
    expect(plan.fincaEnArchivo).toBe("Finca Toneles");
    // 20 filas: 3 se omiten (chapeta repetida, sexo ilegible, sin nombre ni chapeta).
    expect(plan.filas).toHaveLength(17);
    expect(plan.omitidas).toBe(3);
    expect(plan.conHistorial).toBe(true);
  });

  it("avisa de las columnas calculadas que el ganadero llenó y no las guarda", () => {
    // Lo escrito en DÍAS ORDEÑO, MORA PREÑEZ y FECHA POSIBLE DE SECADO no entra en ninguna fila.
    expect(plan.calculadasConDatos.sort()).toEqual(["DÍAS ORDEÑO", "FECHA POSIBLE DE SECADO", "MORA PREÑEZ"]);
    expect(plan.advertencias.join("\n")).toMatch(/esas columnas las calcula el sistema a partir de FECHA ÚLTIMO PARTO y FECHA SERVIDA/);
    // Ninguna propiedad de la fila guarda esos valores: la fila solo tiene las dos fechas.
    expect(Object.keys(plan.filas[0])).not.toContain("diasOrdeno");
  });

  it("deriva categoría, especie y sexo de cada fila", () => {
    const por = (chapeta: string) => plan.filas.find((f) => f.chapeta === chapeta)!;
    expect(por("ZPRU0").categoria).toBe("vaca");
    expect(por("ZPRU0").raza).toBe("Jersey");
    expect(por("ZPRU1").categoria).toBe("ternera");
    expect(por("ZPRU1").fechaNacimiento).toBe(haceMeses(5));
    expect(por("ZPRU2").categoria).toBe("ternero");
    expect(por("ZPRU3").categoria).toBe("novillo");
    expect(por("ZPRU4").categoria).toBe("toro");
    expect(por("ZPRU5").categoria).toBe("vaca");
    expect(por("ZPRU6")).toMatchObject({ especie: "equino", categoria: "caballo", sexo: "macho", color: "Castaño" });
    expect(por("ZPRU9").fechaNacimiento).toBeNull();
    expect(por("ZPRU9").categoria).toBe("vaca");
    expect(por("ZPRU8")).toMatchObject({ madreNombre: "Fantasma", madreChapeta: "ZNOEXISTE", padreNombre: "Toro Prestado", padreChapeta: "ZPAD9" });
  });

  it("deja el peso fuera de rango vacío y conserva los demás", () => {
    expect(plan.filas.find((f) => f.chapeta === "ZPRU7")!.pesoKg).toBeNull();
    expect(plan.filas.find((f) => f.chapeta === "ZPRU0")!.pesoKg).toBe(480);
  });

  it("lee el historial mínimo de cada fila", () => {
    const por = (chapeta: string) => plan.filas.find((f) => f.chapeta === chapeta)!;
    // Vaca en ordeño con litros y servida.
    expect(por("ZPRU0")).toMatchObject({ ultimoParto: haceMeses(3), fechaServida: haceMeses(1), enOrdeno: true, litrosOrdeno: 12.5 });
    // Vaca seca: parto sí, servicio sí, ordeño no.
    expect(por("ZPRU5")).toMatchObject({ ultimoParto: haceMeses(10), fechaServida: haceMeses(4), enOrdeno: false, litrosOrdeno: null });
    // Novilla en ordeño con litros, sin fecha servida.
    expect(por("ZPRU7")).toMatchObject({ ultimoParto: haceMeses(1), fechaServida: null, enOrdeno: true, litrosOrdeno: 8 });
    // «Sí» sin litros: queda en ordeño por el parto, pero sin ordeño que registrar.
    expect(por("ZPRU9")).toMatchObject({ ultimoParto: haceMeses(2), enOrdeno: true, litrosOrdeno: null });
    // Novilla servida sin parto: no es vaca (el servicio no cambia la etapa) y guarda el servicio.
    expect(por("ZPRUG")).toMatchObject({ categoria: "novilla", ultimoParto: null, fechaServida: haceMeses(2) });
    // Filas sin historial: los campos quedan vacíos.
    expect(por("ZPRU1")).toMatchObject({ ultimoParto: null, fechaServida: null, enOrdeno: null, litrosOrdeno: null });
    expect(por("ZPRU8")).toMatchObject({ ultimoParto: null, fechaServida: null, enOrdeno: null, litrosOrdeno: null });
  });

  it("descarta el historial que no se puede registrar", () => {
    const por = (chapeta: string) => plan.filas.find((f) => f.chapeta === chapeta)!;
    expect(por("ZPRUB").ultimoParto).toBeNull(); // parto futuro
    expect(por("ZPRUC").ultimoParto).toBeNull(); // parto anterior al nacimiento
    expect(por("ZPRUD")).toMatchObject({ ultimoParto: haceMeses(2), fechaServida: null, litrosOrdeno: null }); // servida futura, litros fuera de rango
    expect(por("ZPRUE")).toMatchObject({ ultimoParto: null, fechaServida: null, enOrdeno: null, litrosOrdeno: null }); // macho
    expect(por("ZPRUF")).toMatchObject({ categoria: "ternera", fechaServida: null, enOrdeno: null, litrosOrdeno: null }); // ternera
  });

  it("avisa de cada caso dudoso del historial en español", () => {
    const todas = plan.advertencias.join("\n");
    expect(todas).toMatch(/la fecha del último parto \(2030-05-04\) es futura; no se registrará el parto/);
    expect(todas).toMatch(/el último parto \(2023-01-15\) es anterior a la fecha de nacimiento/);
    expect(todas).toMatch(/los litros del último ordeño \(80\) están fuera del rango \(0 a 60 litros\)/);
    expect(todas).toMatch(/un macho no se ordeña; se ignoró la columna EN ORDEÑO/);
    expect(todas).toMatch(/solo una hembra bovina puede tener partos/);
    expect(todas).toMatch(/por su edad es una ternera y todavía no se ordeña/);
    expect(todas).toMatch(/dice que está en ordeño pero no trae LITROS ÚLTIMO ORDEÑO/);
    expect(todas).toMatch(/hembras no traen FECHA ÚLTIMO PARTO/);
    // Fecha servida: los mismos avisos para el segundo dato que sí se captura.
    expect(todas).toMatch(/la fecha servida \(2030-07-07\) es futura; no se registrará el servicio/);
    expect(todas).toMatch(/solo una hembra bovina puede tener servicios/);
    expect(todas).toMatch(/por su edad es una ternera y todavía no se sirve/);
    expect(todas).toMatch(/vacas con parto no traen FECHA SERVIDA/);
  });

  it("avisa de cada caso dudoso en español", () => {
    const todas = plan.advertencias.join("\n");
    expect(todas).toMatch(/la chapeta ZPRU1 ya aparece en la fila/);
    expect(todas).toMatch(/no se entendió el sexo «\?\?\?»/);
    expect(todas).toMatch(/no tiene nombre ni chapeta/);
    expect(todas).toMatch(/es futura/);
    expect(todas).toMatch(/fuera del rango \(1 a 1500 kg\)/);
    expect(todas).toMatch(/sin fecha de nacimiento no se puede calcular la etapa/);
  });

  it("no confunde una hoja de planilla quincenal con la de seres vivos", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("30426");
    ws.getRow(1).values = ["CHAPETA", "NOMBRE", "FECHA PARTO ANTERIOS", "FECHA CRIO", "TARDE", "MAÑAN"];
    ws.getRow(2).values = ["4", "Aide", comoDate("2024-12-01"), comoDate("2025-11-24"), 8, 9];
    expect(await leerPlanillaSeresVivos(Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer), HOY)).toBeNull();
  });

  it("reconoce columnas movidas, en minúsculas y con columnas ajenas en medio", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Listado");
    ws.getCell("A1").value = "PLANILLA IMPLEMENTACIÓN SERES VIVOS";
    ws.getCell("A2").value = "PERTENECEN A FINCA:";
    ws.getCell("C2").value = "La Esperanza";
    ws.getRow(5).values = [
      "Observaciones",
      "Nombre",
      "chapeta",
      "Sexo",
      "especie",
      "Fecha de nacimiento",
      "Peso (kg)",
      "Chapeta de la madre",
      "Potrero",
    ];
    ws.getRow(6).values = ["ninguna", "Lucero", "A-7", "hembra", "vacuno", ddmmaaaa(haceMeses(8)), 140, "", "El Alto"];
    const plan = (await leerPlanillaSeresVivos(Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer), HOY))!;
    expect(plan.fincaEnArchivo).toBe("La Esperanza");
    expect(plan.filas).toHaveLength(1);
    expect(plan.filas[0]).toMatchObject({ nombre: "Lucero", chapeta: "A-7", especie: "bovino", categoria: "ternera", pesoKg: 140 });
  });

  it("lee igual una planilla vieja sin las tres columnas de historial", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Seres vivos");
    ws.getRow(1).values = ["#", "ESPECIE", "SEXO", "NOMBRE", "FECHA NACIMIENTO", "CHAPETA", "PESO", "MADRE", "CHAPETA MADRE"];
    ws.getRow(2).values = [1, "Bovino", "Hembra", "Vieja Vaca", comoDate(haceMeses(50)), "V-1", 520, "", ""];
    ws.getRow(3).values = [2, "Bovino", "Hembra", "Vieja Ternera", comoDate(haceMeses(4)), "V-2", 85, "Vieja Vaca", "V-1"];
    const plan = (await leerPlanillaSeresVivos(Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer), HOY))!;
    expect(plan.conHistorial).toBe(false);
    expect(plan.filas).toHaveLength(2);
    expect(plan.filas[0]).toMatchObject({ nombre: "Vieja Vaca", categoria: "vaca", pesoKg: 520, ultimoParto: null, enOrdeno: null, litrosOrdeno: null });
    expect(plan.filas[1]).toMatchObject({ nombre: "Vieja Ternera", categoria: "ternera", madreChapeta: "V-1" });
    // Se puede importar igual, pero se avisa de lo que el sistema no va a poder calcular.
    expect(plan.advertencias.join("\n")).toMatch(
      /La planilla no trae las columnas de historial \(FECHA ÚLTIMO PARTO, FECHA SERVIDA, EN ORDEÑO, LITROS ÚLTIMO ORDEÑO\): 1 hembra entrará sin antecedentes/,
    );
  });

  it("lee igual una planilla con los títulos viejos (SEXO, PADRE, MADRE, ÚLTIMO PARTO)", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Seres vivos");
    ws.getRow(1).values = [
      "#",
      "ESPECIE",
      "SEXO",
      "NOMBRE",
      "FECHA NACIMIENTO",
      "CHAPETA",
      "PESO",
      "PADRE",
      "CHAPETA PADRE",
      "MADRE",
      "CHAPETA MADRE",
      "ÚLTIMO PARTO",
      "EN ORDEÑO",
      "LITROS ÚLTIMO ORDEÑO",
    ];
    ws.getRow(2).values = [
      1,
      "Bovino",
      "Hembra",
      "Vieja Vaca",
      comoDate(haceMeses(50)),
      "V-1",
      520,
      "Toro Viejo",
      "T-9",
      "",
      "",
      comoDate(haceMeses(3)),
      "Sí",
      10,
    ];
    const plan = (await leerPlanillaSeresVivos(Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer), HOY))!;
    expect(plan.conHistorial).toBe(true);
    expect(plan.filas).toHaveLength(1);
    expect(plan.filas[0]).toMatchObject({
      nombre: "Vieja Vaca",
      categoria: "vaca",
      sexo: "hembra",
      padreNombre: "Toro Viejo",
      padreChapeta: "T-9",
      ultimoParto: haceMeses(3),
      // La planilla vieja no tiene FECHA SERVIDA: el servicio queda vacío y no se inventa.
      fechaServida: null,
      enOrdeno: true,
      litrosOrdeno: 10,
    });
    expect(plan.calculadasConDatos).toEqual([]);
  });
});

describe.skipIf(!process.env.VACDATA_INTEGRACION)("integración con la finca Toneles", () => {
  const supabase: Cliente = createClient<Database>(URL_SUPABASE, CLAVE, { auth: { persistSession: false } });
  const creados: string[] = [];
  const importaciones: string[] = [];
  /** Conteos de la finca antes de importar, para comprobar que la limpieza los deja igual. */
  const antes: Record<string, number> = {};
  let archivo: Buffer;

  const contar = async (consulta: PromiseLike<{ count: number | null }>) => (await consulta).count ?? 0;
  const animalesDeToneles = () => supabase.from("animales").select("*", { count: "exact", head: true }).eq("finca_id", TONELES);
  const deToneles = (tabla: "pesajes" | "partos" | "servicios" | "ordenos" | "secados") =>
    // `partos` tiene dos llaves hacia `animales` (madre y cría): hay que decir por cuál se une.
    supabase
      .from(tabla)
      .select(tabla === "partos" ? "*, animales!partos_animal_id_fkey!inner(finca_id)" : "*, animales!inner(finca_id)", {
        count: "exact",
        head: true,
      })
      .eq("animales.finca_id", TONELES);
  const conteos = async () => ({
    animales: await contar(animalesDeToneles()),
    pesajes: await contar(deToneles("pesajes")),
    partos: await contar(deToneles("partos")),
    servicios: await contar(deToneles("servicios")),
    ordenos: await contar(deToneles("ordenos")),
    secados: await contar(deToneles("secados")),
  });

  beforeAll(async () => {
    const { error } = await supabase.auth.signInWithPassword({ email: "propietario@vacinfo.local", password: "vacinfo123" });
    if (error) throw error;
    archivo = await planillaDeEjemplo(FILAS);
    Object.assign(antes, await conteos());
  }, 60_000);

  afterAll(async () => {
    if (importaciones.length) await supabase.from("importaciones").delete().in("id", importaciones);
    // Los pesajes, partos, ordeños y secados de los animales creados se van en cascada con la ficha.
    if (creados.length) await supabase.from("animales").delete().in("id", creados);
    expect(await conteos()).toEqual(antes);
  }, 60_000);

  it("la vista previa separa nuevos, existentes y omitidos", async () => {
    const plan = (await leerPlanillaSeresVivos(archivo, HOY))!;
    const vista = await previsualizarSeresVivos(supabase, TONELES, plan);
    expect(vista.fincaNombre).toBe("Finca Toneles");
    expect(vista.nuevos).toHaveLength(16);
    expect(vista.existentes).toHaveLength(1);
    expect(vista.existentes[0].chapeta).toBe(CHAPETA_EXISTENTE);
    expect(vista.omitidas).toBe(3);
    expect(vista.pesajes).toBe(15); // 16 nuevos menos el del peso fuera de rango
    expect(vista.madresEnlazadas).toBe(2); // Alegría (ya en la finca) y la madre que viene en la planilla
    // Historial: 5 partos (los 2 inválidos y el del macho no cuentan), 3 servicios, 2 ordeños y 1 secado.
    expect(vista.conHistorial).toBe(true);
    expect(vista.partos).toBe(5);
    expect(vista.servicios).toBe(3);
    expect(vista.ordenos).toBe(2);
    expect(vista.secados).toBe(1);
    expect(vista.historialYaRegistrado).toBe(0);
    const porChapeta = (chapeta: string) => vista.nuevos.find((n) => n.chapeta === chapeta)!;
    expect(porChapeta("ZPRU0")).toMatchObject({
      parto: "crear",
      fechaServida: haceMeses(1),
      servicio: "crear",
      enOrdeno: true,
      litrosOrdeno: 12.5,
      ordeno: "crear",
      secado: null,
    });
    expect(porChapeta("ZPRU5")).toMatchObject({ parto: "crear", servicio: "crear", enOrdeno: false, ordeno: null, secado: "crear" });
    expect(porChapeta("ZPRU9")).toMatchObject({ parto: "crear", servicio: null, enOrdeno: true, litrosOrdeno: null, ordeno: null });
    expect(porChapeta("ZPRUG")).toMatchObject({ categoria: "novilla", parto: null, servicio: "crear" });

    // Los cuatro datos calculados viajan en la vista previa para que el ganadero los compruebe.
    expect(porChapeta("ZPRU0").calculados).toEqual({
      diasOrdeno: diasEntre(haceMeses(3), HOY),
      moraPrenez: diasEntre(haceMeses(3), HOY) - DIAS_MORA_PRENEZ,
      secadoEl: sumarDiasISO(haceMeses(1), DIAS_SECADO_TRAS_SERVICIO),
      partoEsperado: sumarDiasISO(haceMeses(1), DIAS_GESTACION),
    });
    // Vaca seca: no tiene días en ordeño ni mora, pero sí secado y parto posibles por el servicio.
    expect(porChapeta("ZPRU5").calculados).toMatchObject({ diasOrdeno: null, moraPrenez: null, partoEsperado: sumarDiasISO(haceMeses(4), DIAS_GESTACION) });
    // Lo que el ganadero escribió en las columnas calculadas no entró a ninguna parte.
    expect(vista.calculadasConDatos.sort()).toEqual(["DÍAS ORDEÑO", "FECHA POSIBLE DE SECADO", "MORA PREÑEZ"]);
    expect(porChapeta("ZPRU0").calculados.diasOrdeno).not.toBe(999);
    // Código nuevo: 4 letras de la finca, nombre y chapeta.
    expect(vista.nuevos.map((n) => n.codigo)).toContain("TONE-PRUEBAMADRE-ZPRU0");
    expect(vista.nuevos.map((n) => n.codigo)).toContain("TONE-PRUEBACABALLO-ZPRU6");
    expect(vista.advertencias.join("\n")).toMatch(/la chapeta 1003 ya está registrada en la finca/);
    expect(vista.advertencias.join("\n")).toMatch(/no se encontró ningún animal con la chapeta ZNOEXISTE/);
    expect(await contar(animalesDeToneles())).toBe(antes.animales);
  }, 60_000);

  it("crea las fichas con su categoría, su madre y su pesaje", async () => {
    const plan = (await leerPlanillaSeresVivos(archivo, HOY))!;
    const r = await aplicarSeresVivos(supabase, TONELES, plan, "prueba-seres-vivos.xlsx");
    if (r.importacionId) importaciones.push(r.importacionId);
    expect(r.animales.creados).toBe(16);
    expect(r.pesajes.creados).toBe(15);
    expect(r.partos.creados).toBe(5);
    expect(r.servicios.creados).toBe(3);
    expect(r.ordenos.creados).toBe(2);
    expect(r.secados.creados).toBe(1);
    expect(r.madresEnlazadas).toBe(2); // la de la finca (Alegría) y la que venía en la planilla

    const { data } = await supabase
      .from("animales")
      .select(
        "id, codigo, chapeta, nombre, especie, categoria, sexo, fecha_nacimiento, peso_kg, madre_id, madre_nombre, madre_chapeta, padre_nombre, padre_chapeta",
      )
      .eq("finca_id", TONELES)
      .like("chapeta", "ZPRU%");
    creados.push(...(data ?? []).map((a) => a.id));
    expect(data).toHaveLength(16);

    const por = (chapeta: string) => data!.find((a) => a.chapeta === chapeta)!;
    expect(por("ZPRU0")).toMatchObject({
      codigo: "TONE-PRUEBAMADRE-ZPRU0",
      categoria: "vaca",
      especie: "bovino",
      sexo: "hembra",
      madre_nombre: "Alegria",
    });
    expect(por("ZPRU1")).toMatchObject({ categoria: "ternera", madre_id: por("ZPRU0").id, madre_nombre: "Prueba Madre", madre_chapeta: "ZPRU0" });
    expect(por("ZPRU2").categoria).toBe("ternero");
    expect(por("ZPRU3").categoria).toBe("novillo");
    expect(por("ZPRU4").categoria).toBe("toro");
    expect(por("ZPRU5")).toMatchObject({ categoria: "vaca", fecha_nacimiento: null });
    expect(por("ZPRU6")).toMatchObject({ categoria: "caballo", especie: "equino" });
    expect(por("ZPRU7").peso_kg).toBeNull();
    expect(por("ZPRU8")).toMatchObject({
      madre_id: null,
      madre_nombre: "Fantasma",
      madre_chapeta: "ZNOEXISTE",
      padre_nombre: "Toro Prestado",
      padre_chapeta: "ZPAD9",
    });
    expect(por("ZPRU9").fecha_nacimiento).toBeNull();

    // La vaca que ya estaba en la finca quedó como madre de la fila que la referenciaba por chapeta.
    const { data: alegria } = await supabase
      .from("animales")
      .select("id")
      .eq("finca_id", TONELES)
      .eq("chapeta", CHAPETA_EXISTENTE)
      .order("codigo")
      .limit(1)
      .single();
    expect(por("ZPRU0").madre_id).toBe(alegria!.id);

    const { data: pesajes } = await supabase.from("pesajes").select("animal_id, fecha, peso_kg").in("animal_id", creados);
    expect(pesajes).toHaveLength(15);
    expect(pesajes!.every((p) => p.fecha === HOY)).toBe(true);
    expect(pesajes!.find((p) => p.animal_id === por("ZPRU0").id)!.peso_kg).toBe(480);
    expect(await contar(animalesDeToneles())).toBe(antes.animales + 16);
  }, 120_000);

  it("crea el historial: partos sin cría, ordeños de la mañana y el secado de la vaca seca", async () => {
    const { data } = await supabase.from("animales").select("id, chapeta").eq("finca_id", TONELES).like("chapeta", "ZPRU%");
    const id = (chapeta: string) => data!.find((a) => a.chapeta === chapeta)!.id;

    const { data: partos } = await supabase.from("partos").select("animal_id, fecha, cria_id, cria_sexo, aborto, nacido_vivo").in("animal_id", creados);
    expect(partos).toHaveLength(5);
    expect(partos!.every((p) => p.cria_id === null && p.cria_sexo === null && !p.aborto && p.nacido_vivo)).toBe(true);
    expect(partos!.find((p) => p.animal_id === id("ZPRU0"))!.fecha).toBe(haceMeses(3));
    expect(partos!.find((p) => p.animal_id === id("ZPRU5"))!.fecha).toBe(haceMeses(10));
    // Los inválidos y el del macho no se registraron.
    for (const chapeta of ["ZPRUB", "ZPRUC", "ZPRUE", "ZPRUF"]) expect(partos!.some((p) => p.animal_id === id(chapeta))).toBe(false);

    const { data: ordenos } = await supabase.from("ordenos").select("animal_id, fecha, jornada, litros").in("animal_id", creados);
    expect(ordenos).toHaveLength(2);
    expect(ordenos!.every((o) => o.fecha === HOY && o.jornada === "am")).toBe(true);
    expect(ordenos!.find((o) => o.animal_id === id("ZPRU0"))!.litros).toBe(12.5);
    expect(ordenos!.find((o) => o.animal_id === id("ZPRU7"))!.litros).toBe(8);
    // «Sí» sin litros no crea un ordeño de 0 litros.
    expect(ordenos!.some((o) => o.animal_id === id("ZPRU9"))).toBe(false);

    const { data: secados } = await supabase.from("secados").select("animal_id, fecha").in("animal_id", creados);
    expect(secados).toHaveLength(1);
    expect(secados![0]).toMatchObject({ animal_id: id("ZPRU5"), fecha: HOY });

    // Servicios: la fecha servida de la planilla, tal cual, con el tipo por omisión y sin toro.
    const { data: servicios } = await supabase.from("servicios").select("animal_id, fecha, tipo, toro_nombre").in("animal_id", creados);
    expect(servicios).toHaveLength(3);
    expect(servicios!.find((s) => s.animal_id === id("ZPRU0"))).toMatchObject({ fecha: haceMeses(1), tipo: "inseminacion", toro_nombre: null });
    expect(servicios!.find((s) => s.animal_id === id("ZPRU5"))!.fecha).toBe(haceMeses(4));
    expect(servicios!.find((s) => s.animal_id === id("ZPRUG"))!.fecha).toBe(haceMeses(2));
    // La servida futura, la del macho y la de la ternera no se registraron.
    for (const chapeta of ["ZPRUD", "ZPRUE", "ZPRUF"]) expect(servicios!.some((s) => s.animal_id === id(chapeta))).toBe(false);
  }, 120_000);

  it("ahora sí calcula días en ordeño, mora de preñez y vaca seca", async () => {
    const { data, error } = await supabase.rpc("estado_reproductivo", { p_finca: TONELES, p_corte: HOY });
    expect(error).toBeNull();
    const por = (chapeta: string) => data!.find((e) => e.chapeta === chapeta)!;

    // Vaca en ordeño: parto hace 3 meses, con litros del ordeño de hoy, su servicio y su mora.
    const enOrdeno = por("ZPRU0");
    expect(enOrdeno.en_ordeno).toBe(true);
    expect(enOrdeno.ultimo_parto).toBe(haceMeses(3));
    expect(enOrdeno.ultimo_servicio).toBe(haceMeses(1));
    expect(enOrdeno.dias_ordeno).toBeGreaterThan(80);
    expect(Number(enOrdeno.litros_am)).toBe(12.5);

    // La base y la proyección que muestran la vista previa y el formulario dan lo mismo: si la
    // función SQL cambia sus constantes, esta comparación lo delata.
    const proyectado = proyectarDatosProductivos({ ultimoParto: enOrdeno.ultimo_parto, fechaServida: enOrdeno.ultimo_servicio }, HOY);
    expect(enOrdeno.dias_ordeno).toBe(proyectado.diasOrdeno);
    expect(enOrdeno.mora_prenez).toBe(proyectado.moraPrenez);

    // Vaca seca: el secado posterior al parto la saca del ordeño.
    const seca = por("ZPRU5");
    expect(seca.en_ordeno).toBe(false);
    expect(seca.ultimo_secado).toBe(HOY);
    expect(seca.dias_ordeno).toBeNull();
    expect(seca.dias_seca).toBe(0);

    // «Sí» sin litros: queda en ordeño por el parto, pero sin producción registrada.
    const sinLitros = por("ZPRU9");
    expect(sinLitros.en_ordeno).toBe(true);
    expect(sinLitros.dias_ordeno).toBeGreaterThan(50);
    expect(sinLitros.litros_am).toBeNull();

    // Novilla servida sin parto: la función la ve servida y le pone fecha de palpación.
    const novilla = por("ZPRUG");
    expect(novilla.ultimo_servicio).toBe(haceMeses(2));
    expect(novilla.en_ordeno).toBe(false);
    expect(novilla.palpar_el).toBe(sumarDiasISO(haceMeses(2), 33));

    // Antes del cambio esta vaca no tenía parto y el sistema no podía decir nada de ella.
    const sinHistorial = por("ZPRU8");
    expect(sinHistorial.ultimo_parto).toBeNull();
    expect(sinHistorial.en_ordeno).toBe(false);
  }, 120_000);

  it("con la preñez confirmada da la fecha de secado y la de nacimiento de la cría", async () => {
    // La planilla no trae palpaciones: el secado y el parto esperado solo salen de `estado_reproductivo`
    // cuando una palpación confirma la preñez de ese servicio. Se registra una para comprobarlo (se va
    // en cascada al borrar el animal, igual que el resto de su historial).
    const { data: animales } = await supabase.from("animales").select("id, chapeta").eq("finca_id", TONELES).like("chapeta", "ZPRU%");
    const id = (chapeta: string) => animales!.find((a) => a.chapeta === chapeta)!.id;
    const servicio = haceMeses(1);
    const { error } = await supabase
      .from("palpaciones")
      // 20 días después del servicio: posterior al servicio y anterior al corte, como pide la función.
      .upsert({ animal_id: id("ZPRU0"), fecha: sumarDiasISO(servicio, 20), resultado: "prenada" }, { onConflict: "animal_id,fecha", ignoreDuplicates: true });
    expect(error).toBeNull();

    const { data } = await supabase.rpc("estado_reproductivo", { p_finca: TONELES, p_corte: HOY });
    const vaca = data!.find((e) => e.chapeta === "ZPRU0")!;
    expect(vaca.prenada).toBe(true);
    const proyectado = proyectarDatosProductivos({ ultimoParto: vaca.ultimo_parto, fechaServida: servicio }, HOY);
    // Secado y parto esperado: los mismos que muestra la vista previa (servicio + 210 y + 280).
    expect(vaca.secar_el).toBe(proyectado.secadoEl);
    expect(vaca.parto_esperado).toBe(proyectado.partoEsperado);
    // Con la preñez confirmada la mora queda congelada en el día del servicio.
    expect(vaca.mora_prenez).toBe(diasEntre(vaca.ultimo_parto!, servicio) - DIAS_MORA_PRENEZ);
  }, 120_000);

  it("no duplica nada si se importa la misma planilla otra vez", async () => {
    const plan = (await leerPlanillaSeresVivos(archivo, HOY))!;
    const vista = await previsualizarSeresVivos(supabase, TONELES, plan);
    expect(vista.nuevos).toHaveLength(0);
    expect(vista.existentes).toHaveLength(17);
    // El historial ya está: la vista previa no ofrece crear nada y lo cuenta como ya registrado.
    expect(vista.partos).toBe(0);
    expect(vista.servicios).toBe(0);
    expect(vista.ordenos).toBe(0);
    expect(vista.secados).toBe(0);
    expect(vista.historialYaRegistrado).toBe(11); // 5 partos + 3 servicios + 2 ordeños + 1 secado
    expect(vista.existentes.filter((e) => e.parto === "ya")).toHaveLength(5);
    expect(vista.existentes.filter((e) => e.servicio === "ya")).toHaveLength(3);
    expect(vista.existentes.filter((e) => e.ordeno === "ya")).toHaveLength(2);
    expect(vista.existentes.filter((e) => e.secado === "ya")).toHaveLength(1);

    const despues = await conteos();
    const r = await aplicarSeresVivos(supabase, TONELES, plan, "prueba-seres-vivos.xlsx");
    if (r.importacionId) importaciones.push(r.importacionId);
    expect(r.animales.creados).toBe(0);
    expect(r.pesajes.creados).toBe(0);
    expect(r.partos).toEqual({ creados: 0, omitidos: 5 });
    expect(r.servicios).toEqual({ creados: 0, omitidos: 3 });
    expect(r.ordenos).toEqual({ creados: 0, omitidos: 2 });
    expect(r.secados).toEqual({ creados: 0, omitidos: 1 });
    // Ni un registro más en la finca que antes de reimportar.
    expect(await conteos()).toEqual(despues);
    expect(despues).toEqual({
      animales: antes.animales + 16,
      pesajes: antes.pesajes + 15,
      partos: antes.partos + 5,
      servicios: antes.servicios + 3,
      ordenos: antes.ordenos + 2,
      secados: antes.secados + 1,
    });
  }, 120_000);

  // Va al final a propósito: crea un animal más y movería los conteos de las pruebas anteriores.
  it("importa igual una planilla con los títulos viejos (SEXO, PADRE, MADRE, ÚLTIMO PARTO)", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Seres vivos");
    ws.getCell("A1").value = "PLANILLA IMPLEMENTACIÓN SERES VIVOS";
    ws.getCell("A2").value = "PERTENECEN A FINCA:";
    ws.getCell("B2").value = "Finca Toneles";
    ws.getRow(4).values = [
      "#",
      "ESPECIE",
      "SEXO",
      "NOMBRE",
      "FECHA NACIMIENTO",
      "CHAPETA",
      "PESO",
      "PADRE",
      "CHAPETA PADRE",
      "MADRE",
      "CHAPETA MADRE",
      "ÚLTIMO PARTO",
      "EN ORDEÑO",
      "LITROS ÚLTIMO ORDEÑO",
    ];
    ws.getRow(5).values = [1, "Bovino", "Hembra", "Prueba Vieja", comoDate(haceMeses(45)), "ZVIEJ1", 505, "Toro Viejo", "T-9", "", "", comoDate(haceMeses(2)), "Sí", 9];
    const archivoViejo = Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);

    const plan = (await leerPlanillaSeresVivos(archivoViejo, HOY))!;
    expect(plan.filas).toHaveLength(1);
    const vista = await previsualizarSeresVivos(supabase, TONELES, plan);
    expect(vista.nuevos).toHaveLength(1);
    expect(vista.partos).toBe(1);
    expect(vista.ordenos).toBe(1);
    expect(vista.servicios).toBe(0); // la planilla vieja no tiene FECHA SERVIDA

    const r = await aplicarSeresVivos(supabase, TONELES, plan, "prueba-seres-vivos-vieja.xlsx");
    if (r.importacionId) importaciones.push(r.importacionId);
    expect(r.animales.creados).toBe(1);
    expect(r.partos.creados).toBe(1);
    expect(r.ordenos.creados).toBe(1);
    expect(r.servicios.creados).toBe(0);

    const { data: creada } = await supabase
      .from("animales")
      .select("id, codigo, categoria, padre_nombre, padre_chapeta")
      .eq("finca_id", TONELES)
      .eq("chapeta", "ZVIEJ1")
      .single();
    creados.push(creada!.id);
    expect(creada).toMatchObject({ codigo: "TONE-PRUEBAVIEJA-ZVIEJ1", categoria: "vaca", padre_nombre: "Toro Viejo", padre_chapeta: "T-9" });

    // La base calcula sus días en ordeño y su mora igual que la proyección de la vista previa.
    const { data } = await supabase.rpc("estado_reproductivo", { p_finca: TONELES, p_corte: HOY });
    const er = data!.find((e) => e.chapeta === "ZVIEJ1")!;
    expect(er.en_ordeno).toBe(true);
    expect(er.dias_ordeno).toBe(diasEntre(haceMeses(2), HOY));
    expect(er.mora_prenez).toBe(diasEntre(haceMeses(2), HOY) - DIAS_MORA_PRENEZ);
  }, 120_000);
});

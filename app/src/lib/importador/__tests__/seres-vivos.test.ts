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

/** Filas de ejemplo con los casos borde que hay que cubrir. */
const FILAS: Celdas[] = [
  // Madre que llega en la misma planilla (la hija de abajo la referencia por chapeta).
  {
    ESPECIE: "Bovino",
    SEXO: "Hembra",
    NOMBRE: "Prueba Madre",
    "FECHA NACIMIENTO": comoDate(haceMeses(40)),
    CHAPETA: "ZPRU0",
    PESO: 480,
    RAZA: "Jersy",
    // Su madre sí está registrada en la finca: debe quedar enlazada por chapeta.
    MADRE: "Alegria",
    "CHAPETA MADRE": CHAPETA_EXISTENTE,
    // Historial: vaca en ordeño con litros → parto + ordeño de la mañana.
    "ÚLTIMO PARTO": comoDate(haceMeses(3)),
    "EN ORDEÑO": "Sí",
    "LITROS ÚLTIMO ORDEÑO": 12.5,
  },
  // Hija: ternera (5 meses) con la madre enlazada por chapeta dentro del archivo.
  {
    ESPECIE: "bovino",
    SEXO: "h",
    NOMBRE: "Prueba Cria",
    "FECHA NACIMIENTO": ddmmaaaa(haceMeses(5)),
    CHAPETA: "ZPRU1",
    PESO: 95,
    MADRE: "Prueba Madre",
    "CHAPETA MADRE": "ZPRU0",
  },
  { ESPECIE: "Bovino", SEXO: "Macho", NOMBRE: "Prueba Ternero", "FECHA NACIMIENTO": comoDate(haceMeses(6)), CHAPETA: "ZPRU2", PESO: 120 },
  { ESPECIE: "Bovino", SEXO: "Macho", NOMBRE: "Prueba Novillo", "FECHA NACIMIENTO": comoDate(haceMeses(18)), CHAPETA: "ZPRU3", PESO: 300 },
  { ESPECIE: "Bovino", SEXO: "Macho", NOMBRE: "Prueba Toro", "FECHA NACIMIENTO": comoDate(haceMeses(40)), CHAPETA: "ZPRU4", PESO: 700 },
  // Sin fecha de nacimiento: la hembra queda vaca. Historial: seca → parto + secado, sin ordeños.
  {
    ESPECIE: "Bovino",
    SEXO: "Hembra",
    NOMBRE: "Prueba Sin Fecha",
    CHAPETA: "ZPRU5",
    PESO: 450,
    "ÚLTIMO PARTO": ddmmaaaa(haceMeses(10)),
    "EN ORDEÑO": "no",
  },
  // Caballo: categoría caballo y especie equino.
  {
    ESPECIE: "Caballo",
    SEXO: "Macho",
    NOMBRE: "Prueba Caballo",
    "FECHA NACIMIENTO": comoDate(haceMeses(60)),
    CHAPETA: "ZPRU6",
    PESO: 400,
    COLOR: "castaño",
  },
  // Peso fuera de rango: se importa sin peso y sin pesaje. En ordeño con litros: parto + ordeño.
  {
    ESPECIE: "Bovino",
    SEXO: "Hembra",
    NOMBRE: "Prueba Peso",
    "FECHA NACIMIENTO": comoDate(haceMeses(20)),
    CHAPETA: "ZPRU7",
    PESO: 2000,
    "ÚLTIMO PARTO": comoDate(haceMeses(1)),
    "EN ORDEÑO": "SI",
    "LITROS ÚLTIMO ORDEÑO": 8,
  },
  // Madre que no existe en ninguna parte: se guardan nombre y chapeta sin enlazar.
  {
    ESPECIE: "Bovino",
    SEXO: "Hembra",
    NOMBRE: "Prueba Madre Ajena",
    "FECHA NACIMIENTO": comoDate(haceMeses(24)),
    CHAPETA: "ZPRU8",
    PESO: 380,
    MADRE: "Fantasma",
    "CHAPETA MADRE": "ZNOEXISTE",
    PADRE: "Toro Prestado",
    "CHAPETA PADRE": "ZPAD9",
  },
  // Fecha futura: se deja vacía y la hembra queda vaca. «Sí» sin litros: no se crea ningún ordeño.
  {
    ESPECIE: "Bovino",
    SEXO: "Hembra",
    NOMBRE: "Prueba Futura",
    "FECHA NACIMIENTO": comoDate("2030-01-01"),
    CHAPETA: "ZPRU9",
    PESO: 400,
    "ÚLTIMO PARTO": comoDate(haceMeses(2)),
    "EN ORDEÑO": "si",
  },
  // Parto futuro: se avisa y no se registra el parto.
  {
    ESPECIE: "Bovino",
    SEXO: "Hembra",
    NOMBRE: "Prueba Parto Futuro",
    "FECHA NACIMIENTO": comoDate(haceMeses(40)),
    CHAPETA: "ZPRUB",
    PESO: 500,
    "ÚLTIMO PARTO": comoDate("2030-05-04"),
  },
  // Parto anterior a la fecha de nacimiento: se avisa y no se registra el parto.
  {
    ESPECIE: "Bovino",
    SEXO: "Hembra",
    NOMBRE: "Prueba Parto Viejo",
    "FECHA NACIMIENTO": comoDate(haceMeses(30)),
    CHAPETA: "ZPRUC",
    PESO: 480,
    "ÚLTIMO PARTO": comoDate("2023-01-15"),
  },
  // Litros fuera del rango 0–60: se avisa, el parto sí se registra y el ordeño no.
  {
    ESPECIE: "Bovino",
    SEXO: "Hembra",
    NOMBRE: "Prueba Litros",
    "FECHA NACIMIENTO": comoDate(haceMeses(40)),
    CHAPETA: "ZPRUD",
    PESO: 460,
    "ÚLTIMO PARTO": comoDate(haceMeses(2)),
    "EN ORDEÑO": "Sí",
    "LITROS ÚLTIMO ORDEÑO": 80,
  },
  // Macho con historial: no se ordeña y no puede tener partos.
  {
    ESPECIE: "Bovino",
    SEXO: "Macho",
    NOMBRE: "Prueba Macho Ordeño",
    "FECHA NACIMIENTO": comoDate(haceMeses(40)),
    CHAPETA: "ZPRUE",
    PESO: 800,
    "ÚLTIMO PARTO": comoDate(haceMeses(2)),
    "EN ORDEÑO": "Sí",
    "LITROS ÚLTIMO ORDEÑO": 10,
  },
  // Ternera en ordeño: se avisa y se ignora el historial de ordeño.
  {
    ESPECIE: "Bovino",
    SEXO: "Hembra",
    NOMBRE: "Prueba Ternera Ordeño",
    "FECHA NACIMIENTO": comoDate(haceMeses(6)),
    CHAPETA: "ZPRUF",
    PESO: 90,
    "EN ORDEÑO": "Sí",
    "LITROS ÚLTIMO ORDEÑO": 5,
  },
  // Chapeta repetida dentro del archivo.
  { ESPECIE: "Bovino", SEXO: "Hembra", NOMBRE: "Prueba Clon", "FECHA NACIMIENTO": comoDate(haceMeses(20)), CHAPETA: "ZPRU1", PESO: 300 },
  // Sexo que no se entiende.
  { ESPECIE: "Bovino", SEXO: "???", NOMBRE: "Prueba Sin Sexo", "FECHA NACIMIENTO": comoDate(haceMeses(20)), CHAPETA: "ZPRUA", PESO: 300 },
  // Sin nombre ni chapeta.
  { ESPECIE: "Bovino", SEXO: "Hembra", PESO: 300 },
  // Animal que ya está registrado en la finca (misma chapeta).
  { ESPECIE: "Bovino", SEXO: "Hembra", NOMBRE: "Alegria", "FECHA NACIMIENTO": comoDate(haceMeses(50)), CHAPETA: CHAPETA_EXISTENTE, PESO: 500 },
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

  it("reconoce los títulos de las tres columnas de historial", () => {
    expect(campoDeEncabezado("ÚLTIMO PARTO")).toBe("ultimoParto");
    expect(campoDeEncabezado("Fecha del último parto")).toBe("ultimoParto");
    expect(campoDeEncabezado("EN ORDEÑO")).toBe("enOrdeno");
    expect(campoDeEncabezado("en ordeno")).toBe("enOrdeno");
    expect(campoDeEncabezado("LITROS ÚLTIMO ORDEÑO")).toBe("litrosOrdeno");
    expect(campoDeEncabezado("Litros del último ordeño")).toBe("litrosOrdeno");
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

describe("lectura de la planilla", () => {
  let plan: PlanSeresVivos;

  beforeAll(async () => {
    plan = (await leerPlanillaSeresVivos(await planillaDeEjemplo(FILAS), HOY))!;
  }, 30_000);

  it("lee la hoja, la finca del encabezado y las filas válidas", () => {
    expect(plan).toBeTruthy();
    expect(plan.hoja).toBe("Seres vivos");
    expect(plan.fincaEnArchivo).toBe("Finca Toneles");
    // 19 filas: 3 se omiten (chapeta repetida, sexo ilegible, sin nombre ni chapeta).
    expect(plan.filas).toHaveLength(16);
    expect(plan.omitidas).toBe(3);
    expect(plan.conHistorial).toBe(true);
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
    // Vaca en ordeño con litros.
    expect(por("ZPRU0")).toMatchObject({ ultimoParto: haceMeses(3), enOrdeno: true, litrosOrdeno: 12.5 });
    // Vaca seca: parto sí, ordeño no.
    expect(por("ZPRU5")).toMatchObject({ ultimoParto: haceMeses(10), enOrdeno: false, litrosOrdeno: null });
    // Novilla en ordeño con litros.
    expect(por("ZPRU7")).toMatchObject({ ultimoParto: haceMeses(1), enOrdeno: true, litrosOrdeno: 8 });
    // «Sí» sin litros: queda en ordeño por el parto, pero sin ordeño que registrar.
    expect(por("ZPRU9")).toMatchObject({ ultimoParto: haceMeses(2), enOrdeno: true, litrosOrdeno: null });
    // Filas sin historial: los tres campos quedan vacíos.
    expect(por("ZPRU1")).toMatchObject({ ultimoParto: null, enOrdeno: null, litrosOrdeno: null });
    expect(por("ZPRU8")).toMatchObject({ ultimoParto: null, enOrdeno: null, litrosOrdeno: null });
  });

  it("descarta el historial que no se puede registrar", () => {
    const por = (chapeta: string) => plan.filas.find((f) => f.chapeta === chapeta)!;
    expect(por("ZPRUB").ultimoParto).toBeNull(); // parto futuro
    expect(por("ZPRUC").ultimoParto).toBeNull(); // parto anterior al nacimiento
    expect(por("ZPRUD")).toMatchObject({ ultimoParto: haceMeses(2), litrosOrdeno: null }); // litros fuera de rango
    expect(por("ZPRUE")).toMatchObject({ ultimoParto: null, enOrdeno: null, litrosOrdeno: null }); // macho
    expect(por("ZPRUF")).toMatchObject({ categoria: "ternera", enOrdeno: null, litrosOrdeno: null }); // ternera
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
    expect(todas).toMatch(/hembras no traen ÚLTIMO PARTO/);
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
      /La planilla no trae las columnas de historial \(ÚLTIMO PARTO, EN ORDEÑO, LITROS ÚLTIMO ORDEÑO\): 1 hembra entrará sin antecedentes/,
    );
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
  const deToneles = (tabla: "pesajes" | "partos" | "ordenos" | "secados") =>
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
    expect(vista.nuevos).toHaveLength(15);
    expect(vista.existentes).toHaveLength(1);
    expect(vista.existentes[0].chapeta).toBe(CHAPETA_EXISTENTE);
    expect(vista.omitidas).toBe(3);
    expect(vista.pesajes).toBe(14); // 15 nuevos menos el del peso fuera de rango
    expect(vista.madresEnlazadas).toBe(2); // Alegría (ya en la finca) y la madre que viene en la planilla
    // Historial: 5 partos (los 2 inválidos y el del macho no cuentan), 2 ordeños y 1 secado.
    expect(vista.conHistorial).toBe(true);
    expect(vista.partos).toBe(5);
    expect(vista.ordenos).toBe(2);
    expect(vista.secados).toBe(1);
    expect(vista.historialYaRegistrado).toBe(0);
    const porChapeta = (chapeta: string) => vista.nuevos.find((n) => n.chapeta === chapeta)!;
    expect(porChapeta("ZPRU0")).toMatchObject({ parto: "crear", enOrdeno: true, litrosOrdeno: 12.5, ordeno: "crear", secado: null });
    expect(porChapeta("ZPRU5")).toMatchObject({ parto: "crear", enOrdeno: false, ordeno: null, secado: "crear" });
    expect(porChapeta("ZPRU9")).toMatchObject({ parto: "crear", enOrdeno: true, litrosOrdeno: null, ordeno: null });
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
    expect(r.animales.creados).toBe(15);
    expect(r.pesajes.creados).toBe(14);
    expect(r.partos.creados).toBe(5);
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
    expect(data).toHaveLength(15);

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
    expect(pesajes).toHaveLength(14);
    expect(pesajes!.every((p) => p.fecha === HOY)).toBe(true);
    expect(pesajes!.find((p) => p.animal_id === por("ZPRU0").id)!.peso_kg).toBe(480);
    expect(await contar(animalesDeToneles())).toBe(antes.animales + 15);
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
  }, 120_000);

  it("ahora sí calcula días en ordeño, mora de preñez y vaca seca", async () => {
    const { data, error } = await supabase.rpc("estado_reproductivo", { p_finca: TONELES, p_corte: HOY });
    expect(error).toBeNull();
    const por = (chapeta: string) => data!.find((e) => e.chapeta === chapeta)!;

    // Vaca en ordeño: parto hace 3 meses, con litros del ordeño de hoy y mora de preñez (sin servicio).
    const enOrdeno = por("ZPRU0");
    expect(enOrdeno.en_ordeno).toBe(true);
    expect(enOrdeno.ultimo_parto).toBe(haceMeses(3));
    expect(enOrdeno.dias_ordeno).toBeGreaterThan(80);
    expect(enOrdeno.mora_prenez).toBe(enOrdeno.dias_ordeno - 40);
    expect(Number(enOrdeno.litros_am)).toBe(12.5);

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

    // Antes del cambio esta vaca no tenía parto y el sistema no podía decir nada de ella.
    const sinHistorial = por("ZPRU8");
    expect(sinHistorial.ultimo_parto).toBeNull();
    expect(sinHistorial.en_ordeno).toBe(false);
  }, 120_000);

  it("no duplica nada si se importa la misma planilla otra vez", async () => {
    const plan = (await leerPlanillaSeresVivos(archivo, HOY))!;
    const vista = await previsualizarSeresVivos(supabase, TONELES, plan);
    expect(vista.nuevos).toHaveLength(0);
    expect(vista.existentes).toHaveLength(16);
    // El historial ya está: la vista previa no ofrece crear nada y lo cuenta como ya registrado.
    expect(vista.partos).toBe(0);
    expect(vista.ordenos).toBe(0);
    expect(vista.secados).toBe(0);
    expect(vista.historialYaRegistrado).toBe(8); // 5 partos + 2 ordeños + 1 secado
    expect(vista.existentes.filter((e) => e.parto === "ya")).toHaveLength(5);
    expect(vista.existentes.filter((e) => e.ordeno === "ya")).toHaveLength(2);
    expect(vista.existentes.filter((e) => e.secado === "ya")).toHaveLength(1);

    const despues = await conteos();
    const r = await aplicarSeresVivos(supabase, TONELES, plan, "prueba-seres-vivos.xlsx");
    if (r.importacionId) importaciones.push(r.importacionId);
    expect(r.animales.creados).toBe(0);
    expect(r.pesajes.creados).toBe(0);
    expect(r.partos).toEqual({ creados: 0, omitidos: 5 });
    expect(r.ordenos).toEqual({ creados: 0, omitidos: 2 });
    expect(r.secados).toEqual({ creados: 0, omitidos: 1 });
    // Ni un registro más en la finca que antes de reimportar.
    expect(await conteos()).toEqual(despues);
    expect(despues).toEqual({
      animales: antes.animales + 15,
      pesajes: antes.pesajes + 14,
      partos: antes.partos + 5,
      ordenos: antes.ordenos + 2,
      secados: antes.secados + 1,
    });
  }, 120_000);
});

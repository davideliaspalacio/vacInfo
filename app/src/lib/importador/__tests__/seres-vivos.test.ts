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
import { campoDeEncabezado, categoriaDerivada, leerPlanillaSeresVivos, type PlanSeresVivos } from "../seres-vivos";
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
  // Sin fecha de nacimiento: la hembra queda vaca.
  { ESPECIE: "Bovino", SEXO: "Hembra", NOMBRE: "Prueba Sin Fecha", CHAPETA: "ZPRU5", PESO: 450 },
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
  // Peso fuera de rango: se importa sin peso y sin pesaje.
  { ESPECIE: "Bovino", SEXO: "Hembra", NOMBRE: "Prueba Peso", "FECHA NACIMIENTO": comoDate(haceMeses(20)), CHAPETA: "ZPRU7", PESO: 2000 },
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
  // Fecha futura: se deja vacía y la hembra queda vaca.
  { ESPECIE: "Bovino", SEXO: "Hembra", NOMBRE: "Prueba Futura", "FECHA NACIMIENTO": comoDate("2030-01-01"), CHAPETA: "ZPRU9", PESO: 400 },
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

  it("deriva la categoría por especie, sexo y edad", () => {
    expect(categoriaDerivada("bovino", "hembra", haceMeses(6), HOY)).toBe("ternera");
    expect(categoriaDerivada("bovino", "hembra", haceMeses(12), HOY)).toBe("novilla");
    expect(categoriaDerivada("bovino", "hembra", null, HOY)).toBe("vaca");
    expect(categoriaDerivada("bovino", "macho", haceMeses(11), HOY)).toBe("ternero");
    expect(categoriaDerivada("bovino", "macho", haceMeses(12), HOY)).toBe("novillo");
    expect(categoriaDerivada("bovino", "macho", haceMeses(24), HOY)).toBe("novillo");
    expect(categoriaDerivada("bovino", "macho", haceMeses(25), HOY)).toBe("toro");
    expect(categoriaDerivada("bovino", "macho", null, HOY)).toBe("toro");
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
    // 14 filas: 3 se omiten (chapeta repetida, sexo ilegible, sin nombre ni chapeta).
    expect(plan.filas).toHaveLength(11);
    expect(plan.omitidas).toBe(3);
  });

  it("deriva categoría, especie y sexo de cada fila", () => {
    const por = (chapeta: string) => plan.filas.find((f) => f.chapeta === chapeta)!;
    expect(por("ZPRU0").categoria).toBe("novilla");
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
});

describe.skipIf(!process.env.VACDATA_INTEGRACION)("integración con la finca Toneles", () => {
  const supabase: Cliente = createClient<Database>(URL_SUPABASE, CLAVE, { auth: { persistSession: false } });
  const creados: string[] = [];
  const importaciones: string[] = [];
  let antes = 0;
  let pesajesAntes = 0;
  let archivo: Buffer;

  const contar = async (consulta: PromiseLike<{ count: number | null }>) => (await consulta).count ?? 0;
  const animalesDeToneles = () => supabase.from("animales").select("*", { count: "exact", head: true }).eq("finca_id", TONELES);
  const pesajesDeToneles = () =>
    supabase.from("pesajes").select("*, animales!inner(finca_id)", { count: "exact", head: true }).eq("animales.finca_id", TONELES);

  beforeAll(async () => {
    const { error } = await supabase.auth.signInWithPassword({ email: "propietario@vacinfo.local", password: "vacinfo123" });
    if (error) throw error;
    archivo = await planillaDeEjemplo(FILAS);
    antes = await contar(animalesDeToneles());
    pesajesAntes = await contar(pesajesDeToneles());
  }, 60_000);

  afterAll(async () => {
    if (importaciones.length) await supabase.from("importaciones").delete().in("id", importaciones);
    // Los pesajes de los animales creados se van en cascada con la ficha.
    if (creados.length) await supabase.from("animales").delete().in("id", creados);
    expect(await contar(animalesDeToneles())).toBe(antes);
    expect(await contar(pesajesDeToneles())).toBe(pesajesAntes);
  }, 60_000);

  it("la vista previa separa nuevos, existentes y omitidos", async () => {
    const plan = (await leerPlanillaSeresVivos(archivo, HOY))!;
    const vista = await previsualizarSeresVivos(supabase, TONELES, plan);
    expect(vista.fincaNombre).toBe("Finca Toneles");
    expect(vista.nuevos).toHaveLength(10);
    expect(vista.existentes).toHaveLength(1);
    expect(vista.existentes[0].chapeta).toBe(CHAPETA_EXISTENTE);
    expect(vista.omitidas).toBe(3);
    expect(vista.pesajes).toBe(9); // 10 nuevos menos el del peso fuera de rango
    expect(vista.madresEnlazadas).toBe(2); // Alegría (ya en la finca) y la madre que viene en la planilla
    expect(vista.nuevos.map((n) => n.codigo)).toContain("TON-ZPRU0");
    expect(vista.advertencias.join("\n")).toMatch(/la chapeta 1003 ya está registrada en la finca/);
    expect(vista.advertencias.join("\n")).toMatch(/no se encontró ningún animal con la chapeta ZNOEXISTE/);
    expect(await contar(animalesDeToneles())).toBe(antes);
  }, 60_000);

  it("crea las fichas con su categoría, su madre y su pesaje", async () => {
    const plan = (await leerPlanillaSeresVivos(archivo, HOY))!;
    const r = await aplicarSeresVivos(supabase, TONELES, plan, "prueba-seres-vivos.xlsx");
    if (r.importacionId) importaciones.push(r.importacionId);
    expect(r.animales.creados).toBe(10);
    expect(r.pesajes.creados).toBe(9);
    expect(r.madresEnlazadas).toBe(2); // la de la finca (Alegría) y la que venía en la planilla

    const { data } = await supabase
      .from("animales")
      .select(
        "id, codigo, chapeta, nombre, especie, categoria, sexo, fecha_nacimiento, peso_kg, madre_id, madre_nombre, madre_chapeta, padre_nombre, padre_chapeta",
      )
      .eq("finca_id", TONELES)
      .like("chapeta", "ZPRU%");
    creados.push(...(data ?? []).map((a) => a.id));
    expect(data).toHaveLength(10);

    const por = (chapeta: string) => data!.find((a) => a.chapeta === chapeta)!;
    expect(por("ZPRU0")).toMatchObject({ codigo: "TON-ZPRU0", categoria: "novilla", especie: "bovino", sexo: "hembra", madre_nombre: "Alegria" });
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
    expect(pesajes).toHaveLength(9);
    expect(pesajes!.every((p) => p.fecha === HOY)).toBe(true);
    expect(pesajes!.find((p) => p.animal_id === por("ZPRU0").id)!.peso_kg).toBe(480);
    expect(await contar(animalesDeToneles())).toBe(antes + 10);
  }, 120_000);

  it("no duplica nada si se importa la misma planilla otra vez", async () => {
    const plan = (await leerPlanillaSeresVivos(archivo, HOY))!;
    const vista = await previsualizarSeresVivos(supabase, TONELES, plan);
    expect(vista.nuevos).toHaveLength(0);
    expect(vista.existentes).toHaveLength(11);

    const r = await aplicarSeresVivos(supabase, TONELES, plan, "prueba-seres-vivos.xlsx");
    if (r.importacionId) importaciones.push(r.importacionId);
    expect(r.animales.creados).toBe(0);
    expect(r.pesajes.creados).toBe(0);
    expect(await contar(animalesDeToneles())).toBe(antes + 10);
  }, 120_000);
});

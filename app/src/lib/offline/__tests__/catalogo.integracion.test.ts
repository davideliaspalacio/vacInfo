// Prueba contra el Supabase local. Ejecutar con: VACDATA_INTEGRACION=1 pnpm exec vitest run src/lib/offline
// Solo lee (la hoja de vida no registra nada), así que no hay nada que limpiar al final.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/database.types";
import { FALTA_DESCARGAR, agruparSanidad, armarHojaVida, consultaParientes, consultaSanidad, desdeSanidad, hojaVidaDe } from "../hoja-vida";
import type { AnimalCatalogo, HojaVidaCatalogo, ParienteCatalogo } from "../tipos";

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:55321";
const CLAVE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const TONELES = "00000000-0000-4000-8000-000000000101";
const JOSEFINA = "00000000-0000-4000-8000-000000000016"; // vaca en ordeño con una mastitis registrada
const AYANA = "00000000-0000-4000-8000-000000000004"; // vaca preñada con secado y parto esperado
const MILAGROS = "00000000-0000-4000-8000-000000000026"; // mamá de «Cría de Milagros»
/** Igual que en la ruta del catálogo: la finca de demostración registró leche hasta abril. */
const CORTE = "2026-04-30";

type Cliente = SupabaseClient<Database>;

describe.skipIf(!process.env.VACDATA_INTEGRACION)("catálogo ampliado para la hoja de vida", () => {
  const supabase: Cliente = createClient<Database>(URL_SUPABASE, CLAVE, { auth: { persistSession: false } });
  /** Lo mismo que arma `GET /api/campo/catalogo`, para probar las consultas reales con RLS de trabajador. */
  const porAnimal = new Map<string, { animal: AnimalCatalogo; hoja: HojaVidaCatalogo }>();
  let hoy = "";

  beforeAll(async () => {
    const { error } = await supabase.auth.signInWithPassword({ email: "jhon@vacinfo.local", password: "vacinfo123" });
    if (error) throw error;
    hoy = new Date().toISOString().slice(0, 10);

    const [animales, estados, sanidad, parientes] = await Promise.all([
      supabase
        .from("animales")
        .select("id, codigo, chapeta, nombre, categoria, sexo, fecha_destete, fecha_nacimiento, madre_id, madre_nombre, madre_chapeta, padre_nombre, padre_chapeta")
        .eq("finca_id", TONELES)
        .eq("estado", "activo"),
      supabase.rpc("estado_reproductivo", { p_finca: TONELES, p_corte: CORTE }),
      consultaSanidad(supabase, TONELES, desdeSanidad(hoy)),
      consultaParientes(supabase, TONELES),
    ]);
    for (const consulta of [animales, estados, sanidad, parientes]) if (consulta.error) throw consulta.error;

    const estadoPorAnimal = new Map((estados.data ?? []).map((e) => [e.animal_id, e]));
    const sanidadPorAnimal = agruparSanidad(sanidad.data ?? []);
    const fichas = new Map<string, ParienteCatalogo>((parientes.data ?? []).map((p) => [p.id, { nombre: p.nombre, chapeta: p.chapeta }]));

    for (const a of animales.data ?? []) {
      const e = estadoPorAnimal.get(a.id);
      const hoja = hojaVidaDe(a, { mora_prenez: e?.mora_prenez ?? null, sanidad: sanidadPorAnimal.get(a.id), fichas });
      const animal: AnimalCatalogo = {
        id: a.id,
        codigo: a.codigo,
        chapeta: a.chapeta,
        nombre: a.nombre,
        categoria: a.categoria,
        sexo: a.sexo,
        fecha_destete: a.fecha_destete,
        en_ordeno: e?.en_ordeno ?? false,
        prenada: e?.prenada ?? null,
        dias_ordeno: e?.dias_ordeno ?? null,
        ultimo_parto: e?.ultimo_parto ?? null,
        ultimo_servicio: e?.ultimo_servicio ?? null,
        palpar_el: e?.palpar_el ?? null,
        secar_el: e?.secar_el ?? null,
        parto_esperado: e?.parto_esperado ?? null,
        litros_am: e?.litros_am ?? null,
        litros_pm: e?.litros_pm ?? null,
        ordenos_recientes: [],
        hoja_vida: hoja,
      };
      porAnimal.set(a.id, { animal, hoja });
    }
  });

  const traer = (id: string) => {
    const fila = porAnimal.get(id);
    if (!fila) throw new Error(`El animal ${id} no está en el catálogo de Toneles`);
    return fila;
  };

  it("el trabajador descarga toda la finca con la hoja de vida de cada animal", () => {
    expect(porAnimal.size).toBeGreaterThan(50);
    expect([...porAnimal.values()].every((f) => f.animal.hoja_vida != null)).toBe(true);
  });

  it("trae la mamá con la chapeta de su propia ficha, aunque el nombre esté escrito a mano", () => {
    const cria = [...porAnimal.values()].find((f) => f.animal.nombre === "Cría de Milagros");
    expect(cria).toBeDefined();
    expect(cria!.hoja.fecha_nacimiento).toBe("2025-11-11");
    expect(cria!.hoja.madre).toEqual({ nombre: "Milagros", chapeta: traer(MILAGROS).animal.chapeta });
    expect(cria!.hoja.padre).toBeNull();
  });

  it("trae las fechas del ciclo y la mora tal como las entrega estado_reproductivo", () => {
    const { animal, hoja } = traer(AYANA);
    expect(animal).toMatchObject({ nombre: "Ayana", prenada: true, ultimo_parto: "2025-06-21", ultimo_servicio: "2025-12-10" });
    expect(animal.secar_el).toBe("2026-07-08");
    // El parto esperado y la mora los calcula la base (servicio + 280, mora desde 45 días): aquí solo viajan.
    expect(animal.parto_esperado).toBe("2026-09-16");
    expect(typeof hoja.mora_prenez).toBe("number");

    const vista = armarHojaVida(animal, { hoy });
    expect(vista.ciclo.find((d) => d.etiqueta === "Fecha posible de secado")!.valor).toBe("08/07/2026");
    expect(vista.ciclo.find((d) => d.etiqueta === "Posible fecha de nacimiento de la cría")!.valor).toBe("16/09/2026");
    // Preñada: la mora es historia, no una alerta en rojo.
    expect(vista.ciclo.find((d) => d.etiqueta === "Mora de preñez")!.alerta).toBe(false);
  });

  it("trae las enfermedades y tratamientos registrados, con fecha, producto y días de retiro", () => {
    const { hoja, animal } = traer(JOSEFINA);
    expect(hoja.sanidad).toHaveLength(1);
    expect(hoja.sanidad[0]).toMatchObject({
      fecha: "2026-04-27",
      tipo: "mastitis",
      diagnostico: "Mastitis clínica",
      producto: "Antibiótico intramamario",
      cuartos: ["TDD"],
      dias_retiro: 5,
      estado: "en_tratamiento",
    });

    const vista = armarHojaVida(animal, { hoy, sanidadDesde: desdeSanidad(hoy) });
    expect(vista.sanidad).toHaveLength(1);
    // El retiro de esa mastitis ya venció hace meses: no se avisa de leche retenida.
    expect(vista.retiro).toBeNull();
  });

  it("solo trae los eventos sanitarios de la ventana pedida", async () => {
    const recientes = await consultaSanidad(supabase, TONELES, "2026-06-01");
    expect(recientes.error).toBeNull();
    expect((recientes.data ?? []).some((e) => e.animal_id === JOSEFINA)).toBe(false);
  });

  it("un catálogo descargado con la versión anterior no rompe la pantalla: pide descargar de nuevo", () => {
    const { animal } = traer(JOSEFINA);
    const sinHojaVida: AnimalCatalogo = { ...animal };
    delete sinHojaVida.hoja_vida; // un teléfono con la versión anterior en caché no trae la clave
    const vista = armarHojaVida(sinHojaVida, { hoy });
    expect(vista.faltanDatos).toBe(true);
    expect(vista.identificacion.find((d) => d.etiqueta === "Mamá")!.valor).toBe(FALTA_DESCARGAR);
    expect(vista.sanidad).toEqual([]);
    // Lo que el catálogo viejo sí traía se sigue viendo.
    expect(vista.ciclo.find((d) => d.etiqueta === "Fecha del último parto")!.valor).toBe("25/01/2026");
  });
});

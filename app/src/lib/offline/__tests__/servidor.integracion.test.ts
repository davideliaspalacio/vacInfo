// Prueba contra el Supabase local. Ejecutar con: VACDATA_INTEGRACION=1 pnpm exec vitest run src/lib/offline
// Registra como trabajador y al final borra todo lo que creó (con la cuenta del propietario, que puede borrar).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/database.types";
import { procesarRegistros } from "../servidor";

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:55321";
const CLAVE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const JOSEFINA = "00000000-0000-4000-8000-000000000016";
const UVA = "00000000-0000-4000-8000-000000000044"; // novilla sin destete
const SAIRA = "00000000-0000-4000-8000-000000000048"; // novilla activa
const TONELES = "00000000-0000-4000-8000-000000000101";
const FECHA = "2026-04-29";
const FECHA_PARTO = "2026-04-28";
const MARCA = "Prueba offline";
const GRUPO = "Grupo prueba offline";
const CHAPETA_CRIA = "OFF1";

type Cliente = SupabaseClient<Database>;
const nuevoCliente = (): Cliente => createClient<Database>(URL_SUPABASE, CLAVE, { auth: { persistSession: false } });
const id = () => crypto.randomUUID();
const cuenta = async (consulta: PromiseLike<{ count: number | null }>) => (await consulta).count ?? 0;

describe.skipIf(!process.env.VACDATA_INTEGRACION)("sincronización sin duplicados", () => {
  const supabase = nuevoCliente();
  const propietario = nuevoCliente();
  const reclamados: string[] = [];
  const pesajePrevio = { existia: true };
  let potreros: string[] = [];

  const registrar = async (registros: { cliente_id: string; accion: string; datos: unknown }[]) => {
    reclamados.push(...registros.map((r) => r.cliente_id));
    return procesarRegistros(supabase, registros);
  };

  beforeAll(async () => {
    const [yo, dueno] = await Promise.all([
      supabase.auth.signInWithPassword({ email: "jhon@vacinfo.local", password: "vacinfo123" }),
      propietario.auth.signInWithPassword({ email: "propietario@vacinfo.local", password: "vacinfo123" }),
    ]);
    if (yo.error) throw yo.error;
    if (dueno.error) throw dueno.error;
    const { data } = await supabase.from("potreros").select("id").eq("finca_id", TONELES).order("numero").limit(4);
    potreros = (data ?? []).map((p) => p.id);
    pesajePrevio.existia = (await cuenta(supabase.from("pesajes").select("*", { count: "exact", head: true }).eq("animal_id", JOSEFINA).eq("fecha", FECHA))) > 0;
  });

  afterAll(async () => {
    const p = propietario;
    const { data: partos } = await p.from("partos").select("id, cria_id").eq("animal_id", JOSEFINA).eq("fecha", FECHA_PARTO);
    await p.from("partos").delete().eq("animal_id", JOSEFINA).eq("fecha", FECHA_PARTO);
    const crias = (partos ?? []).flatMap((x) => (x.cria_id ? [x.cria_id] : []));
    if (crias.length) await p.from("animales").delete().in("id", crias);
    await p.from("animales").delete().eq("madre_id", JOSEFINA).eq("chapeta", CHAPETA_CRIA);

    await Promise.all([
      p.from("servicios").delete().eq("toro_nombre", MARCA),
      p.from("eventos_sanitarios").delete().eq("producto", MARCA),
      pesajePrevio.existia ? null : p.from("pesajes").delete().eq("animal_id", JOSEFINA).eq("fecha", FECHA),
      p.from("recolecciones_leche").delete().eq("placa", "OFF123"),
      p.from("bajas").delete().eq("causa", MARCA),
      p.from("mantenimientos").delete().eq("detalle", MARCA),
      p.from("aplicaciones_campo").delete().eq("producto", MARCA),
      p.from("controles_calidad").delete().eq("responsable", MARCA),
      p.from("movimientos_insumos").delete().eq("entrega", MARCA),
      p.from("visitas").delete().eq("nombre", MARCA),
      p.from("rotaciones_potrero").delete().eq("grupo", GRUPO),
      p.from("animales").update({ fecha_destete: null }).eq("id", UVA),
      p.from("animales").update({ estado: "activo" }).eq("id", SAIRA),
    ]);
    if (reclamados.length) await supabase.from("sincronizaciones").delete().in("cliente_id", reclamados);
  });

  describe("acciones originales", () => {
    const registros = [
      { cliente_id: id(), accion: "servicio", datos: { animal_id: JOSEFINA, fecha: FECHA, tipo: "inseminacion", toro_nombre: MARCA } },
      { cliente_id: id(), accion: "pesaje", datos: { animal_id: JOSEFINA, fecha: FECHA, peso_kg: "512,5" } },
      { cliente_id: id(), accion: "salud", datos: { animal_id: JOSEFINA, fecha: FECHA, tipo: "mastitis", cuartos: ["TDD"], producto: MARCA } },
      { cliente_id: id(), accion: "ordeno_lista", datos: { fecha: FECHA, jornada: "am", items: [{ animal_id: JOSEFINA, litros: 11 }] } },
      { cliente_id: id(), accion: "carro_tanque", datos: { finca_id: TONELES, fecha: FECHA, litros: 1234, placa: "OFF123" } },
      { cliente_id: id(), accion: "consumo_diario", datos: { finca_id: TONELES, fecha: FECHA, kg_sal_vacas: 2 } },
      { cliente_id: id(), accion: "ordeno", datos: { animal_id: JOSEFINA, fecha: FECHA, jornada: "pm", litros: "abc" } },
    ];

    async function contar() {
      return {
        ordenos: await cuenta(supabase.from("ordenos").select("*", { count: "exact", head: true }).eq("animal_id", JOSEFINA).eq("fecha", FECHA)),
        pesajes: await cuenta(supabase.from("pesajes").select("*", { count: "exact", head: true }).eq("animal_id", JOSEFINA).eq("fecha", FECHA)),
        servicios: await cuenta(supabase.from("servicios").select("*", { count: "exact", head: true }).eq("toro_nombre", MARCA)),
        salud: await cuenta(supabase.from("eventos_sanitarios").select("*", { count: "exact", head: true }).eq("producto", MARCA)),
        recolecciones: await cuenta(supabase.from("recolecciones_leche").select("*", { count: "exact", head: true }).eq("placa", "OFF123")),
        consumos: await cuenta(supabase.from("consumos_diarios").select("*", { count: "exact", head: true }).eq("finca_id", TONELES).eq("fecha", FECHA)),
        sincronizaciones: await cuenta(
          supabase
            .from("sincronizaciones")
            .select("*", { count: "exact", head: true })
            .in(
              "cliente_id",
              registros.map((r) => r.cliente_id),
            ),
        ),
      };
    }

    it("guarda una vez y la segunda pasada devuelve duplicado sin filas extra", async () => {
      const antes = await contar();

      const primera = await registrar(registros);
      console.log("primera pasada", primera);
      expect(primera.map((r) => r.estado)).toEqual(["ok", "ok", "ok", "ok", "ok", "ok", "error"]);
      const despues = await contar();
      expect(despues).toEqual({
        ...antes,
        pesajes: pesajePrevio.existia ? antes.pesajes : antes.pesajes + 1,
        servicios: antes.servicios + 1,
        salud: antes.salud + 1,
        recolecciones: antes.recolecciones + 1,
        sincronizaciones: 6,
      });

      const segunda = await registrar(registros);
      console.log("segunda pasada", segunda);
      expect(segunda.map((r) => r.estado)).toEqual(["duplicado", "duplicado", "duplicado", "duplicado", "duplicado", "duplicado", "error"]);
      expect(await contar()).toEqual(despues);
    });

    it("un reclamo sin evento guardado se recupera en lugar de marcarse duplicado", async () => {
      const clienteId = id();
      reclamados.push(clienteId);
      await supabase.from("sincronizaciones").insert({ cliente_id: clienteId, accion: "carro_tanque" });
      const [r] = await registrar([
        { cliente_id: clienteId, accion: "carro_tanque", datos: { finca_id: TONELES, fecha: FECHA, litros: 99, placa: "OFF123" } },
      ]);
      expect(r.estado).toBe("ok");
      const { data } = await supabase.from("recolecciones_leche").select("id").eq("id", clienteId);
      expect(data).toHaveLength(1);
    });

    it("otro registro del mismo evento (misma vaca y día) no crea filas", async () => {
      const antes = await contar();
      const [r] = await registrar([{ cliente_id: id(), accion: "servicio", datos: { animal_id: JOSEFINA, fecha: FECHA, tipo: "monta", toro_nombre: MARCA } }]);
      expect(r.estado).toBe("ok");
      expect(r.mensaje).toMatch(/se conservó el anterior/);
      expect((await contar()).servicios).toBe(antes.servicios);
    });

    it("un evento rechazado se reporta como error en cada intento", async () => {
      const registro = { cliente_id: id(), accion: "secado", datos: { animal_id: "00000000-0000-4000-8000-00000000ffff", fecha: FECHA } };
      const [r1] = await registrar([registro]);
      const [r2] = await registrar([registro]);
      expect(r1.estado).toBe("error");
      expect(r2.estado).toBe("error");
    });
  });

  describe("acciones nuevas", () => {
    const registros = () => [
      {
        cliente_id: id(),
        accion: "parto",
        datos: {
          animal_id: JOSEFINA,
          fecha: FECHA_PARTO,
          cria_sexo: "hembra",
          nacido_vivo: "si",
          en_la_noche: "no",
          observaciones: MARCA,
          registrar_cria: "on",
          cria_nombre: "Cría prueba offline",
          cria_chapeta: CHAPETA_CRIA,
        },
      },
      { cliente_id: id(), accion: "destete", datos: { animal_id: UVA, fecha: FECHA } },
      { cliente_id: id(), accion: "baja", datos: { animal_id: SAIRA, fecha: FECHA, tipo: "venta", causa: MARCA, valor: "1500000" } },
      { cliente_id: id(), accion: "mantenimiento", datos: { finca_id: TONELES, fecha: FECHA, tipo: "cercas", detalle: MARCA, bien_id: "" } },
      {
        cliente_id: id(),
        accion: "aplicacion",
        datos: { finca_id: TONELES, fecha: FECHA, tipo: "fumigacion", producto: MARCA, potrero_ids: potreros.slice(0, 2), potreros: "7", dias_retiro_pastoreo: "3" },
      },
      { cliente_id: id(), accion: "control_calidad", datos: { finca_id: TONELES, fecha: FECHA, tipo: "temperatura_tanque", jornada: "am", grados: "4,2", responsable: MARCA } },
      { cliente_id: id(), accion: "movimiento_insumo", datos: { finca_id: TONELES, fecha: FECHA, producto: "Premex", tipo: "salida", cantidad: "2", hora: "07:30", entrega: MARCA } },
      { cliente_id: id(), accion: "visita", datos: { finca_id: TONELES, fecha: FECHA, nombre: MARCA, hora_ingreso: "08:15", motivo: "Prueba" } },
      { cliente_id: id(), accion: "rotacion", datos: { finca_id: TONELES, fecha: FECHA, grupo: GRUPO, animales: "12", potrero_id: potreros[2] } },
      { cliente_id: id(), accion: "rotacion", datos: { finca_id: TONELES, fecha: FECHA, grupo: GRUPO, potrero_id: potreros[3] } },
      { cliente_id: id(), accion: "rotacion", datos: { finca_id: TONELES, fecha: FECHA, grupo: GRUPO, potrero_id: "" } },
    ];

    async function contar() {
      const [cria, uva, saira, aplicacion] = await Promise.all([
        supabase.from("animales").select("id, codigo, categoria, madre_id").eq("madre_id", JOSEFINA).eq("chapeta", CHAPETA_CRIA),
        supabase.from("animales").select("fecha_destete").eq("id", UVA).single(),
        supabase.from("animales").select("estado").eq("id", SAIRA).single(),
        supabase.from("aplicaciones_campo").select("potreros, potrero_ids").eq("producto", MARCA),
      ]);
      return {
        partos: await cuenta(supabase.from("partos").select("*", { count: "exact", head: true }).eq("animal_id", JOSEFINA).eq("fecha", FECHA_PARTO)),
        crias: cria.data?.length ?? 0,
        destete: uva.data?.fecha_destete ?? null,
        estadoSaira: saira.data?.estado,
        bajas: await cuenta(supabase.from("bajas").select("*", { count: "exact", head: true }).eq("causa", MARCA)),
        mantenimientos: await cuenta(supabase.from("mantenimientos").select("*", { count: "exact", head: true }).eq("detalle", MARCA)),
        aplicaciones: aplicacion.data?.map((a) => [a.potreros, a.potrero_ids?.length ?? 0]) ?? [],
        controles: await cuenta(supabase.from("controles_calidad").select("*", { count: "exact", head: true }).eq("responsable", MARCA)),
        movimientos: await cuenta(supabase.from("movimientos_insumos").select("*", { count: "exact", head: true }).eq("entrega", MARCA)),
        visitas: await cuenta(supabase.from("visitas").select("*", { count: "exact", head: true }).eq("nombre", MARCA)),
        rotaciones: await cuenta(supabase.from("rotaciones_potrero").select("*", { count: "exact", head: true }).eq("grupo", GRUPO)),
        rotacionesAbiertas: await cuenta(supabase.from("rotaciones_potrero").select("*", { count: "exact", head: true }).eq("grupo", GRUPO).is("fecha_salida", null)),
      };
    }

    it("parto con cría, destete, baja, registros de finca y rotación se guardan una sola vez", async () => {
      expect(potreros).toHaveLength(4);
      const antes = await contar();
      expect(antes).toMatchObject({ partos: 0, crias: 0, destete: null, estadoSaira: "activo", rotaciones: 0 });

      const lote = registros();
      const primera = await registrar(lote);
      console.log("nuevas · primera pasada", primera);
      expect(primera.map((r) => r.estado)).toEqual(Array(lote.length).fill("ok"));
      expect(primera.every((r) => !r.mensaje)).toBe(true);

      const despues = await contar();
      // El estado del animal lo cambia el disparador de `bajas`; con RLS del trabajador puede quedar "activo" (ver informe).
      console.log("estado del animal tras la baja:", despues.estadoSaira);
      expect(despues).toEqual({
        partos: 1,
        crias: 1,
        destete: FECHA,
        estadoSaira: despues.estadoSaira,
        bajas: 1,
        mantenimientos: 1,
        aplicaciones: [["1, 2, 7", 2]],
        controles: 1,
        movimientos: 1,
        visitas: 1,
        rotaciones: 2,
        rotacionesAbiertas: 0,
      });
      const { data: cria } = await supabase.from("animales").select("codigo, categoria, sexo").eq("madre_id", JOSEFINA).eq("chapeta", CHAPETA_CRIA).single();
      expect(cria).toMatchObject({ codigo: `TON-${CHAPETA_CRIA}`, categoria: "ternera", sexo: "hembra" });

      const segunda = await registrar(lote);
      console.log("nuevas · segunda pasada", segunda);
      expect(segunda.map((r) => r.estado)).toEqual(Array(lote.length).fill("duplicado"));
      expect(await contar()).toEqual(despues);
    });

    it("un evento que ya estaba registrado por otro envío se confirma con aviso y sin filas nuevas", async () => {
      const antes = await contar();
      const resultados = await registrar([
        { cliente_id: id(), accion: "parto", datos: { animal_id: JOSEFINA, fecha: FECHA_PARTO, cria_sexo: "macho", registrar_cria: true } },
        { cliente_id: id(), accion: "destete", datos: { animal_id: UVA, fecha: FECHA } },
        { cliente_id: id(), accion: "baja", datos: { animal_id: SAIRA, fecha: FECHA, tipo: "muerte", causa: MARCA } },
      ]);
      console.log("nuevas · repetidos", resultados);
      expect(resultados.map((r) => r.estado)).toEqual(["ok", "ok", "ok"]);
      expect(resultados.every((r) => r.mensaje)).toBe(true);
      expect(await contar()).toEqual(antes);
    });

    it("valida los datos de las acciones nuevas", async () => {
      const resultados = await registrar([
        { cliente_id: id(), accion: "parto", datos: { animal_id: JOSEFINA, fecha: FECHA_PARTO, registrar_cria: true } },
        { cliente_id: id(), accion: "mantenimiento", datos: { finca_id: TONELES, fecha: FECHA, tipo: "general" } },
        { cliente_id: id(), accion: "rotacion", datos: { finca_id: TONELES, fecha: FECHA, grupo: GRUPO, potrero_id: "00000000-0000-4000-8000-00000000ffff" } },
      ]);
      console.log("nuevas · inválidos", resultados);
      expect(resultados.map((r) => r.estado)).toEqual(["error", "error", "error"]);
      expect(resultados[0].mensaje).toMatch(/sexo de la cría/);
      expect(resultados[1].mensaje).toMatch(/detalle/);
      expect(resultados[2].mensaje).toMatch(/no es de esta finca/);
    });
  });
});

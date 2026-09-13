// Prueba contra el Supabase local. Ejecutar con: VACDATA_INTEGRACION=1 pnpm exec vitest run src/lib/offline
// Deja filas de prueba (marcadas con "Prueba offline" / placa OFF123) que hay que borrar después con psql.
import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/database.types";
import { procesarRegistros } from "../servidor";

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:55321";
const CLAVE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const JOSEFINA = "00000000-0000-4000-8000-000000000016";
const TONELES = "00000000-0000-4000-8000-000000000101";
const FECHA = "2026-04-29";
const MARCA = "Prueba offline";

describe.skipIf(!process.env.VACDATA_INTEGRACION)("sincronización sin duplicados", () => {
  const supabase = createClient<Database>(URL_SUPABASE, CLAVE, { auth: { persistSession: false } });
  const id = () => crypto.randomUUID();

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
    const n = async (consulta: PromiseLike<{ count: number | null }>) => (await consulta).count ?? 0;
    return {
      ordenos: await n(supabase.from("ordenos").select("*", { count: "exact", head: true }).eq("animal_id", JOSEFINA).eq("fecha", FECHA)),
      pesajes: await n(supabase.from("pesajes").select("*", { count: "exact", head: true }).eq("animal_id", JOSEFINA).eq("fecha", FECHA)),
      servicios: await n(supabase.from("servicios").select("*", { count: "exact", head: true }).eq("toro_nombre", MARCA)),
      salud: await n(supabase.from("eventos_sanitarios").select("*", { count: "exact", head: true }).eq("producto", MARCA)),
      recolecciones: await n(supabase.from("recolecciones_leche").select("*", { count: "exact", head: true }).eq("placa", "OFF123")),
      consumos: await n(supabase.from("consumos_diarios").select("*", { count: "exact", head: true }).eq("finca_id", TONELES).eq("fecha", FECHA)),
      sincronizaciones: await n(
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

  beforeAll(async () => {
    const { error } = await supabase.auth.signInWithPassword({ email: "jhon@vacinfo.local", password: "vacinfo123" });
    if (error) throw error;
  });

  it("guarda una vez y la segunda pasada devuelve duplicado sin filas extra", async () => {
    const antes = await contar();

    const primera = await procesarRegistros(supabase, registros);
    console.log("primera pasada", primera);
    expect(primera.map((r) => r.estado)).toEqual(["ok", "ok", "ok", "ok", "ok", "ok", "error"]);
    const despues = await contar();
    expect(despues).toEqual({
      ...antes,
      pesajes: antes.pesajes + 1,
      servicios: antes.servicios + 1,
      salud: antes.salud + 1,
      recolecciones: antes.recolecciones + 1,
      sincronizaciones: 6,
    });

    const segunda = await procesarRegistros(supabase, registros);
    console.log("segunda pasada", segunda);
    expect(segunda.map((r) => r.estado)).toEqual(["duplicado", "duplicado", "duplicado", "duplicado", "duplicado", "duplicado", "error"]);
    expect(await contar()).toEqual(despues);
  });

  it("un reclamo sin evento guardado se recupera en lugar de marcarse duplicado", async () => {
    const clienteId = id();
    await supabase.from("sincronizaciones").insert({ cliente_id: clienteId, accion: "carro_tanque" });
    const [r] = await procesarRegistros(supabase, [
      { cliente_id: clienteId, accion: "carro_tanque", datos: { finca_id: TONELES, fecha: FECHA, litros: 99, placa: "OFF123" } },
    ]);
    console.log("recuperado", r);
    expect(r.estado).toBe("ok");
    const { data } = await supabase.from("recolecciones_leche").select("id").eq("id", clienteId);
    expect(data).toHaveLength(1);
  });

  it("otro registro del mismo evento (misma vaca y día) no crea filas", async () => {
    const antes = await contar();
    const [r] = await procesarRegistros(supabase, [
      { cliente_id: id(), accion: "servicio", datos: { animal_id: JOSEFINA, fecha: FECHA, tipo: "monta", toro_nombre: MARCA } },
    ]);
    console.log("mismo evento", r);
    expect(r.estado).toBe("ok");
    expect(r.mensaje).toMatch(/se conservó el anterior/);
    expect((await contar()).servicios).toBe(antes.servicios);
  });

  it("un evento rechazado se reporta como error en cada intento", async () => {
    const registro = { cliente_id: id(), accion: "secado", datos: { animal_id: "00000000-0000-4000-8000-00000000ffff", fecha: FECHA } };
    const [r1] = await procesarRegistros(supabase, [registro]);
    const [r2] = await procesarRegistros(supabase, [registro]);
    console.log("rechazado", r1, r2);
    expect(r1.estado).toBe("error");
    expect(r2.estado).toBe("error");
  });
});

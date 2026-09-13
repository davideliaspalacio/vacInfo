import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { corteDeFinca } from "@/lib/datos";
import type { AnimalCatalogo, Catalogo, FincaResumen } from "@/lib/offline/tipos";

const SIN_CACHE = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Tu sesión se cerró. Vuelve a entrar." }, { status: 401, headers: SIN_CACHE });

  const { data: filasFincas, error: errorFincas } = await supabase.from("fincas").select("id, nombre, municipio, organizacion_id").order("nombre");
  if (errorFincas) return NextResponse.json({ error: errorFincas.message }, { status: 500, headers: SIN_CACHE });

  const fincas: FincaResumen[] = (filasFincas ?? []).map(({ id, nombre, municipio }) => ({ id, nombre, municipio }));
  const fincaId = new URL(request.url).searchParams.get("finca");
  if (!fincaId) return NextResponse.json({ fincas }, { headers: SIN_CACHE });

  const finca = filasFincas?.find((f) => f.id === fincaId);
  if (!finca) return NextResponse.json({ error: "No tienes acceso a esa finca." }, { status: 404, headers: SIN_CACHE });

  const corte = await corteDeFinca(supabase, finca.id);
  const [animales, estados, potreros, insumos] = await Promise.all([
    supabase.from("animales").select("id, codigo, chapeta, nombre, categoria, sexo").eq("finca_id", finca.id).eq("estado", "activo").order("nombre"),
    supabase.rpc("estado_reproductivo", { p_finca: finca.id, p_corte: corte }),
    supabase.from("potreros").select("id, numero, nombre").eq("finca_id", finca.id).order("numero"),
    supabase.from("insumos").select("nombre, categoria, unidad").eq("organizacion_id", finca.organizacion_id).order("nombre"),
  ]);
  const fallo = animales.error ?? estados.error ?? potreros.error ?? insumos.error;
  if (fallo) return NextResponse.json({ error: fallo.message }, { status: 500, headers: SIN_CACHE });

  const estadoPorAnimal = new Map((estados.data ?? []).map((e) => [e.animal_id, e]));
  const catalogo: Catalogo = {
    finca_id: finca.id,
    finca: { id: finca.id, nombre: finca.nombre, municipio: finca.municipio },
    corte,
    animales: (animales.data ?? []).map((a): AnimalCatalogo => {
      const e = estadoPorAnimal.get(a.id);
      return {
        ...a,
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
      };
    }),
    potreros: potreros.data ?? [],
    insumos: insumos.data ?? [],
    descargado_en: new Date().toISOString(),
  };

  return NextResponse.json({ fincas, catalogo }, { headers: SIN_CACHE });
}

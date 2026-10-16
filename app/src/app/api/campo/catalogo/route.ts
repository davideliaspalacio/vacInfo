import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { corteDeFinca } from "@/lib/datos";
import { hoyISO, sumarDias } from "@/lib/formato";
import { gruposDeFinca } from "@/components/potreros/rotacion";
import { leerBandeja } from "@/lib/offline/mensajes";
import { REGLAS, limitar, respuestaLimite } from "@/lib/limites";
import type { AnimalCatalogo, BandejaMensajes, Catalogo, FincaResumen, Jornada, OrdenoRegistrado } from "@/lib/offline/tipos";

const SIN_CACHE = { "Cache-Control": "no-store" };
/** Días hacia atrás (desde hoy y desde el corte) de los que se mandan los ordeños ya registrados. */
const DIAS_ORDENOS = 2;
const MAX_ORDENOS = 3000;

const normalizar = (s: string) => s.trim().replace(/\s+/g, " ");

/**
 * Fechas de las que se revisa si la vaca ya se ordeñó: hoy y los días anteriores, más el corte de la finca
 * (en los datos de demostración el último ordeño es anterior a hoy).
 */
function fechasDeOrdenos(hoy: string, corte: string) {
  const fechas = new Set<string>();
  for (const base of [hoy, corte]) for (let d = 0; d <= DIAS_ORDENOS; d++) fechas.add(sumarDias(base, -d));
  return [...fechas];
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Tu sesión se cerró. Vuelve a entrar." }, { status: 401, headers: SIN_CACHE });

  const limite = await limitar(supabase, user.id, REGLAS.catalogo);
  if (!limite.permitido) return respuestaLimite(limite, SIN_CACHE);

  const [{ data: filasFincas, error: errorFincas }, mensajes] = await Promise.all([
    supabase.from("fincas").select("id, nombre, municipio, organizacion_id, dias_descanso_objetivo").order("nombre"),
    // Los mensajes viajan con el catálogo para poder leerlos sin señal; si fallan, el catálogo igual sirve.
    leerBandeja(supabase, user.id).catch((): BandejaMensajes | null => null),
  ]);
  if (errorFincas) return NextResponse.json({ error: errorFincas.message }, { status: 500, headers: SIN_CACHE });

  const fincas: FincaResumen[] = (filasFincas ?? []).map(({ id, nombre, municipio }) => ({ id, nombre, municipio }));
  const fincaId = new URL(request.url).searchParams.get("finca");
  if (!fincaId) return NextResponse.json({ fincas, mensajes }, { headers: SIN_CACHE });

  const finca = filasFincas?.find((f) => f.id === fincaId);
  if (!finca) return NextResponse.json({ error: "No tienes acceso a esa finca." }, { status: 404, headers: SIN_CACHE });

  const corte = await corteDeFinca(supabase, finca.id);
  const [animales, estados, potreros, abiertas, grupos, bienes, insumos, servicios, ordenos] = await Promise.all([
    supabase
      .from("animales")
      .select("id, codigo, chapeta, nombre, categoria, sexo, fecha_destete")
      .eq("finca_id", finca.id)
      .eq("estado", "activo")
      .order("nombre"),
    supabase.rpc("estado_reproductivo", { p_finca: finca.id, p_corte: corte }),
    supabase.rpc("estado_potreros", { p_finca: finca.id, p_corte: hoyISO() }),
    supabase.from("rotaciones_potrero").select("grupo, potrero_id, fecha_entrada, animales").eq("finca_id", finca.id).is("fecha_salida", null),
    gruposDeFinca(supabase, finca.id),
    supabase.from("bienes").select("id, nombre, codigo").eq("finca_id", finca.id).order("nombre"),
    supabase.from("insumos").select("nombre, categoria, unidad").eq("organizacion_id", finca.organizacion_id).order("nombre"),
    supabase
      .from("servicios")
      .select("toro_nombre, animales!inner(finca_id)")
      .eq("animales.finca_id", finca.id)
      .not("toro_nombre", "is", null)
      .order("fecha", { ascending: false })
      .limit(1000),
    // Ordeños ya registrados de los últimos días: el teléfono los usa para no dejar registrar dos veces la misma jornada.
    supabase
      .from("ordenos")
      .select("animal_id, fecha, jornada, animales!inner(finca_id)")
      .eq("animales.finca_id", finca.id)
      .in("fecha", fechasDeOrdenos(hoyISO(), corte))
      .limit(MAX_ORDENOS),
  ]);
  const fallo =
    animales.error ?? estados.error ?? potreros.error ?? abiertas.error ?? bienes.error ?? insumos.error ?? servicios.error ?? ordenos.error;
  if (fallo) return NextResponse.json({ error: fallo.message }, { status: 500, headers: SIN_CACHE });

  // Toros conocidos: los usados en servicios (del más reciente al más viejo) y los toros de la finca.
  const toros = new Map<string, string>();
  const agregarToro = (nombre: string | null) => {
    const limpio = nombre ? normalizar(nombre) : "";
    if (limpio && !toros.has(limpio.toLowerCase())) toros.set(limpio.toLowerCase(), limpio);
  };
  (animales.data ?? []).filter((a) => a.categoria === "toro").forEach((a) => agregarToro(a.nombre));
  (servicios.data ?? []).forEach((s) => agregarToro(s.toro_nombre));

  const estadoPorAnimal = new Map((estados.data ?? []).map((e) => [e.animal_id, e]));
  const ordenosPorAnimal = new Map<string, OrdenoRegistrado[]>();
  for (const o of ordenos.data ?? []) {
    const lista = ordenosPorAnimal.get(o.animal_id) ?? [];
    lista.push({ fecha: o.fecha, jornada: o.jornada as Jornada });
    ordenosPorAnimal.set(o.animal_id, lista);
  }
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
        ordenos_recientes: (ordenosPorAnimal.get(a.id) ?? []).sort((x, y) => y.fecha.localeCompare(x.fecha) || y.jornada.localeCompare(x.jornada)),
      };
    }),
    potreros_estado: potreros.data ?? [],
    dias_descanso_objetivo: finca.dias_descanso_objetivo ?? 35,
    grupos,
    rotaciones_abiertas: abiertas.data ?? [],
    bienes: bienes.data ?? [],
    insumos: insumos.data ?? [],
    toros: [...toros.values()].slice(0, 60),
    descargado_en: new Date().toISOString(),
  };

  return NextResponse.json({ fincas, catalogo, mensajes }, { headers: SIN_CACHE });
}

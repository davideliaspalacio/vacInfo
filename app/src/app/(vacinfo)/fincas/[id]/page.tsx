import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Calculator, FilePlus2, MapPin, Pencil, Wrench } from "lucide-react";
import { puedeRegistrar } from "@/lib/permisos";
import { obtenerSesion, ROLES_GESTORES } from "@/lib/sesion";
import { corteDeFinca } from "@/lib/datos";
import { fecha, litros, num, pesos } from "@/lib/formato";
import type { Params } from "@/lib/paginacion";
import { atajosDias, completarRango, diasEntre, leerRangoPedido, textoRango, type Rango } from "@/lib/rango";
import { BotonVolver, Encabezado, Metrica, Tarjeta } from "@/components/ui";
import { RangoFechas } from "@/components/rango-fechas";
import { alertasDeFinca, resumenAlCorte } from "@/components/fincas/consultas";
import { Bloque, EsqueletoMetricas, EsqueletoTabla } from "@/components/fincas/esqueletos";
import { Pestanas } from "@/components/fincas/pestanas";
import { SeccionAnimales } from "@/components/fincas/seccion-animales";
import { SeccionAlertas } from "@/components/fincas/seccion-alertas";
import { SeccionBienes } from "@/components/fincas/seccion-bienes";
import { ArbolElementos } from "@/components/fincas/arbol-elementos";
import { HistorialServicios } from "@/components/fincas/historial-servicios";

const PESTANAS = [
  { valor: "animales", texto: "Animales" },
  { valor: "alertas", texto: "Alertas" },
  { valor: "bienes", texto: "Bienes" },
  { valor: "arbol", texto: "Árbol de elementos" },
  { valor: "historial", texto: "Historial de servicios" },
] as const;

/** El promedio de litros del rango usa indicadores_mensuales; en rangos muy largos no se calcula. */
const MAX_DIAS_PROMEDIO = 366;

type Pestana = (typeof PESTANAS)[number]["valor"];
type DatosCorte = ReturnType<typeof resumenAlCorte>;
type Promedio = { litrosDia: number | null; dias: number } | null;

export default async function FichaFinca({ params, searchParams }: PageProps<"/fincas/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const tab: Pestana = PESTANAS.some((p) => p.valor === sp.tab) ? (sp.tab as Pestana) : "animales";
  // ?desde=&hasta= (hasta = fecha de corte de los cálculos; ?corte= heredado equivale a hasta).
  const pedido = leerRangoPedido(sp);

  const { supabase, rol } = await obtenerSesion();
  const gestor = ROLES_GESTORES.includes(rol);

  // Lo lento (resumen, conteos, sección) arranca ya y se transmite por partes; el encabezado no lo espera.
  const datos = resumenAlCorte(supabase, id, pedido.hasta);
  const rango = datos.then((d) => completarRango(pedido, d.corte));
  const referencia = pedido.hasta ? corteDeFinca(supabase, id) : datos.then((d) => d.corte);
  const promedio: Promise<Promedio> = rango.then(async (r) => {
    if (diasEntre(r.desde, r.hasta) > MAX_DIAS_PROMEDIO) return null;
    const { data } = await supabase.rpc("indicadores_mensuales", { p_finca: id, p_desde: r.desde, p_hasta: r.hasta });
    const filas = data ?? [];
    const litrosTotales = filas.reduce((s, f) => s + Number(f.litros_totales ?? 0), 0);
    const dias = filas.reduce((s, f) => s + Number(f.dias_con_ordeno ?? 0), 0);
    return { litrosDia: dias ? Math.round((litrosTotales / dias) * 10) / 10 : null, dias };
  });
  const bienes = (async () => (await supabase.from("bienes").select("id", { count: "exact", head: true }).eq("finca_id", id)).count)();

  const { data: finca } = await supabase.from("fincas").select("*").eq("id", id).maybeSingle();
  if (!finca) notFound();

  const claveRango = `${pedido.desde ?? ""}|${pedido.hasta ?? ""}|${pedido.todo}`;
  const enlace = (t: string) => {
    const q = new URLSearchParams({ tab: t });
    for (const k of ["desde", "hasta", "corte"]) if (typeof sp[k] === "string") q.set(k, sp[k]);
    return `/fincas/${id}?${q}`;
  };
  const ubicacion = [finca.vereda, finca.municipio, finca.departamento].filter(Boolean).join(", ");
  const colanta = [
    finca.empresa_compradora,
    finca.codigo_asociado && `asociado ${finca.codigo_asociado}`,
    finca.tanque_numero && `tanque ${finca.tanque_numero}`,
    finca.ruta && `ruta ${finca.ruta}`,
  ].filter(Boolean);

  const cuentas: Partial<Record<Pestana, Promise<number | null | undefined>>> = {
    animales: datos.then((d) => d.resumen?.total_animales),
    alertas: datos.then((d) => alertasDeFinca(id, d.corte)).then((a) => a.length),
    bienes,
  };

  return (
    <div className="space-y-8">
      <BotonVolver href="/fincas">Fincas</BotonVolver>

      <Encabezado
        eyebrow="Hoja informativa finca"
        titulo={finca.nombre}
        descripcion={
          <span className="flex flex-col gap-1">
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4" aria-hidden />
              {ubicacion || "Ubicación sin registrar"}
              {finca.area_cuadras != null && ` · ${num(finca.area_cuadras)} cuadras`}
              {finca.tenencia && ` · ${finca.tenencia}`}
            </span>
            {colanta.length > 0 && <span className="text-sm">{colanta.join(" · ")}</span>}
            {(finca.precio_litro != null || finca.registro_ica) && (
              <span className="text-sm">
                {finca.precio_litro != null && `Precio litro ${pesos(finca.precio_litro)}`}
                {finca.precio_litro != null && finca.registro_ica && " · "}
                {finca.registro_ica && `Registro ICA ${finca.registro_ica}`}
              </span>
            )}
          </span>
        }
        acciones={
          <>
            {puedeRegistrar(rol) && (
              <>
                <Link href={`/animales/nuevo?finca=${id}`} className="boton-accion inline-flex items-center gap-2 rounded-xl bg-lima px-4 py-3 font-bold text-bosque">
                  <FilePlus2 className="h-5 w-5" aria-hidden />
                  Nueva ficha de ser vivo
                </Link>
                <Link href={`/bienes/nuevo?finca=${id}`} className="boton-accion inline-flex items-center gap-2 rounded-xl bg-lima-suave px-4 py-3 font-bold text-bosque">
                  <Wrench className="h-5 w-5" aria-hidden />
                  Nueva ficha de bien
                </Link>
              </>
            )}
            <Link href={`/fincas/${id}/costos`} className="boton-accion inline-flex items-center gap-2 rounded-xl bg-dorado px-4 py-3 font-bold text-bosque">
              <Calculator className="h-5 w-5" aria-hidden />
              Parámetros de costos
            </Link>
            {gestor && (
              <Link href={`/fincas/${id}/editar`} className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-4 py-3 font-bold text-leche hover:bg-white/10">
                <Pencil className="h-5 w-5" aria-hidden />
                Editar finca
              </Link>
            )}
          </>
        }
      />

      <Suspense key={claveRango} fallback={<EsqueletoResumen />}>
        <ResumenFinca fincaId={id} datos={datos} rango={rango} referencia={referencia} promedio={promedio} searchParams={sp} />
      </Suspense>

      <Pestanas activa={tab} fincaId={id} opciones={PESTANAS.map((p) => ({ ...p, href: enlace(p.valor), cuenta: cuentas[p.valor] }))} />

      <Suspense key={`${tab}-${claveRango}`} fallback={<EsqueletoTabla />}>
        <SeccionFinca tab={tab} fincaId={id} nombre={finca.nombre} datos={datos} rango={rango} searchParams={sp} />
      </Suspense>
    </div>
  );
}

async function ResumenFinca({
  fincaId,
  datos,
  rango,
  referencia,
  promedio,
  searchParams,
}: {
  fincaId: string;
  datos: DatosCorte;
  rango: Promise<Rango>;
  referencia: Promise<string>;
  promedio: Promise<Promedio>;
  searchParams: Params;
}) {
  const [{ corte, resumen }, r, ref, prom] = await Promise.all([datos, rango, referencia, promedio]);
  return (
    <Tarjeta>
      <RangoFechas
        ruta={`/fincas/${fincaId}`}
        searchParams={searchParams}
        desde={r.todo ? "" : r.desde}
        hasta={r.hasta}
        texto={textoRango(r)}
        atajos={atajosDias(ref, r)}
        referencia={ref}
        nota="El resumen, los animales y las alertas se calculan a la fecha «hasta»; el historial de servicios se filtra por el rango."
      />
      <p className="mt-4 border-t border-black/10 pt-4 text-sm text-tinta-suave">
        Datos al <strong className="text-bosque">{fecha(corte, true)}</strong>
        {resumen?.fecha_leche && resumen.fecha_leche !== corte && ` · último ordeño registrado ${fecha(resumen.fecha_leche, true)}`}
        {prom && (
          <>
            {" · "}
            {prom.litrosDia != null ? (
              <>
                promedio del rango <strong className="text-bosque">{litros(prom.litrosDia)}/día</strong> ({num(prom.dias)} {prom.dias === 1 ? "día" : "días"} con ordeño)
              </>
            ) : (
              "sin ordeños en el rango"
            )}
          </>
        )}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Metrica valor={num(resumen?.vacas_ordeno ?? 0)} etiqueta="Vacas en ordeño" />
        <Metrica valor={num(resumen?.vacas_horras ?? 0)} etiqueta="Vacas secas" />
        <Metrica valor={num(resumen?.novillas_vientre ?? 0)} etiqueta="Novillas" />
        <Metrica valor={num(resumen?.prenadas ?? 0)} etiqueta="Preñadas" />
        <Metrica valor={num(resumen?.servidas_sin_confirmar ?? 0)} etiqueta="Servidas sin confirmar" tono="crema" />
        <Metrica valor={num(resumen?.vacias ?? 0)} etiqueta="Vacías sin servicio" tono={resumen?.vacias ? "alerta" : "crema"} />
        <Metrica valor={litros(resumen?.litros_dia ?? 0)} etiqueta="Litros del día" />
        <Metrica valor={litros(resumen?.promedio_vaca ?? 0)} etiqueta="Promedio por vaca" />
      </div>
    </Tarjeta>
  );
}

function EsqueletoResumen() {
  return (
    <section className="papel rounded-3xl p-5 sm:p-6" aria-busy="true">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <Bloque className="h-5 w-56" />
        <Bloque className="h-10 w-96" />
      </div>
      <Bloque className="mt-3 h-7 w-full max-w-2xl" />
      <EsqueletoMetricas className="mt-5 xl:grid-cols-8" />
    </section>
  );
}

type PropsSeccion = { tab: Pestana; fincaId: string; nombre: string; datos: DatosCorte; rango: Promise<Rango>; searchParams: Params };

async function SeccionFinca({ tab, fincaId, nombre, datos, rango, searchParams }: PropsSeccion) {
  switch (tab) {
    case "bienes":
      return <SeccionBienes fincaId={fincaId} searchParams={searchParams} />;
    case "arbol":
      return <ArbolElementos fincaId={fincaId} nombre={nombre} />;
    case "historial":
      return <HistorialServicios fincaId={fincaId} searchParams={searchParams} rango={await rango} />;
  }
  const { corte } = await datos;
  if (tab === "alertas") return <SeccionAlertas alertas={await alertasDeFinca(fincaId, corte)} corte={corte} />;
  return <SeccionAnimales fincaId={fincaId} corte={corte} searchParams={searchParams} />;
}

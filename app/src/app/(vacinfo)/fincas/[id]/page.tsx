import Link from "next/link";
import { notFound } from "next/navigation";
import { Calculator, CalendarDays, FilePlus2, MapPin, Pencil, Wrench } from "lucide-react";
import { obtenerSesion, ROLES_GESTORES } from "@/lib/sesion";
import { corteDeFinca } from "@/lib/datos";
import { fecha, litros, num, pesos } from "@/lib/formato";
import { BotonVolver, Encabezado, Metrica, Tarjeta } from "@/components/ui";
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

type Pestana = (typeof PESTANAS)[number]["valor"];

export default async function FichaFinca({ params, searchParams }: PageProps<"/fincas/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const tab: Pestana = PESTANAS.some((p) => p.valor === sp.tab) ? (sp.tab as Pestana) : "animales";
  const pedido = typeof sp.corte === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.corte) ? sp.corte : null;

  const { supabase, rol } = await obtenerSesion();
  const gestor = ROLES_GESTORES.includes(rol);

  const { data: finca } = await supabase.from("fincas").select("*").eq("id", id).maybeSingle();
  if (!finca) notFound();

  const corte = await corteDeFinca(supabase, id, pedido);
  const [{ data: resumen }, { data: alertas }, { count: bienes }] = await Promise.all([
    supabase.rpc("resumen_finca", { p_finca: id, p_corte: corte }).single(),
    supabase.rpc("alertas_finca", { p_finca: id, p_corte: corte }),
    supabase.from("bienes").select("id", { count: "exact", head: true }).eq("finca_id", id),
  ]);

  const enlace = (t: string) => `/fincas/${id}?tab=${t}${pedido ? `&corte=${pedido}` : ""}`;
  const ubicacion = [finca.vereda, finca.municipio, finca.departamento].filter(Boolean).join(", ");
  const colanta = [
    finca.empresa_compradora,
    finca.codigo_asociado && `asociado ${finca.codigo_asociado}`,
    finca.tanque_numero && `tanque ${finca.tanque_numero}`,
    finca.ruta && `ruta ${finca.ruta}`,
  ].filter(Boolean);

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
            <Link href={`/animales/nuevo?finca=${id}`} className="boton-accion inline-flex items-center gap-2 rounded-xl bg-lima px-4 py-3 font-bold text-bosque">
              <FilePlus2 className="h-5 w-5" aria-hidden />
              Nueva ficha de ser vivo
            </Link>
            <Link href={`/bienes/nuevo?finca=${id}`} className="boton-accion inline-flex items-center gap-2 rounded-xl bg-lima-suave px-4 py-3 font-bold text-bosque">
              <Wrench className="h-5 w-5" aria-hidden />
              Nueva ficha de bien
            </Link>
            <Link href={`/fincas/${id}/costos`} className="boton-accion inline-flex items-center gap-2 rounded-xl bg-dorado px-4 py-3 font-bold text-bosque">
              <Calculator className="h-5 w-5" aria-hidden />
              Parámetros de costos
            </Link>            {gestor && (
              <Link href={`/fincas/${id}/editar`} className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-4 py-3 font-bold text-leche hover:bg-white/10">
                <Pencil className="h-5 w-5" aria-hidden />
                Editar finca
              </Link>
            )}
          </>
        }
      />

      <Tarjeta>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <p className="text-sm text-tinta-suave">
            Datos al <strong className="text-bosque">{fecha(corte, true)}</strong>
            {resumen?.fecha_leche && resumen.fecha_leche !== corte && ` · último ordeño registrado ${fecha(resumen.fecha_leche, true)}`}
          </p>
          <form className="flex items-center gap-2">
            <input type="hidden" name="tab" value={tab} />
            <label htmlFor="corte" className="flex items-center gap-1 text-sm font-bold text-bosque">
              <CalendarDays className="h-4 w-4" aria-hidden />
              Fecha de corte
            </label>
            <input id="corte" type="date" name="corte" defaultValue={corte} className="campo-control w-auto py-2" />
            <button className="rounded-xl bg-bosque px-4 py-2 text-sm font-bold text-leche">Ver</button>
          </form>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          <Metrica valor={num(resumen?.vacas_ordeno ?? 0)} etiqueta="Vacas en ordeño" />
          <Metrica valor={num(resumen?.vacas_horras ?? 0)} etiqueta="Vacas horras" />
          <Metrica valor={num(resumen?.novillas_vientre ?? 0)} etiqueta="Novillas" />
          <Metrica valor={num(resumen?.prenadas ?? 0)} etiqueta="Preñadas" />
          <Metrica valor={num(resumen?.servidas_sin_confirmar ?? 0)} etiqueta="Servidas sin confirmar" tono="crema" />
          <Metrica valor={num(resumen?.vacias ?? 0)} etiqueta="Vacías sin servicio" tono={resumen?.vacias ? "alerta" : "crema"} />
          <Metrica valor={litros(resumen?.litros_dia ?? 0)} etiqueta="Litros del día" />
          <Metrica valor={litros(resumen?.promedio_vaca ?? 0)} etiqueta="Promedio por vaca" />
        </div>
      </Tarjeta>

      <Pestanas
        activa={tab}
        fincaId={id}
        opciones={PESTANAS.map((p) => ({
          ...p,
          href: enlace(p.valor),
          cuenta:
            p.valor === "animales" ? resumen?.total_animales : p.valor === "alertas" ? (alertas?.length ?? 0) : p.valor === "bienes" ? (bienes ?? 0) : undefined,
        }))}
      />

      {tab === "animales" && <SeccionAnimales fincaId={id} corte={corte} />}
      {tab === "alertas" && <SeccionAlertas alertas={alertas ?? []} corte={corte} />}
      {tab === "bienes" && <SeccionBienes fincaId={id} />}
      {tab === "arbol" && <ArbolElementos fincaId={id} nombre={finca.nombre} />}
      {tab === "historial" && <HistorialServicios fincaId={id} />}
    </div>
  );
}

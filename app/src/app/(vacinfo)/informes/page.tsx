import { Suspense } from "react";
import { obtenerSesion } from "@/lib/sesion";
import { corteDeFinca } from "@/lib/datos";
import { fecha, sumarDias } from "@/lib/formato";
import { Encabezado, Tarjeta, Vacio } from "@/components/ui";
import { BotonImprimir } from "@/components/informes/boton-imprimir";
import { FiltrosInforme, PESTANAS, PestanasInforme, type Pestana } from "@/components/informes/filtros";
import { InformeOperativo } from "@/components/informes/operativo";
import { InformeAdministrativo } from "@/components/informes/administrativo";
import { InformeContable } from "@/components/informes/contable";
import { EsqueletoInforme } from "@/components/informes/esqueleto";

export const metadata = { title: "Informes" };

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

function uno(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

function fechaValida(v: string | undefined) {
  return v && FECHA_ISO.test(v) && !Number.isNaN(Date.parse(v)) ? v : undefined;
}

type Sesion = Awaited<ReturnType<typeof obtenerSesion>>;

/** Sin finca elegida, se abre la que más animales activos tiene (no una finca vacía por orden alfabético). */
async function fincaConMasAnimales(supabase: Sesion["supabase"], fincas: Sesion["fincas"]) {
  if (fincas.length === 1) return fincas[0];
  const conteos = await Promise.all(
    fincas.map((f) =>
      supabase.from("animales").select("id", { count: "exact", head: true }).eq("finca_id", f.id).eq("estado", "activo"),
    ),
  );
  let mejor = 0;
  conteos.forEach((c, i) => {
    if ((c.count ?? 0) > (conteos[mejor].count ?? 0)) mejor = i;
  });
  return fincas[mejor];
}

export default async function InformesPage(props: PageProps<"/informes">) {
  const sp = await props.searchParams;
  const { supabase, fincas } = await obtenerSesion();

  if (fincas.length === 0) {
    return (
      <div className="space-y-6">
        <Encabezado eyebrow="Informes" titulo="Ver informes" />
        <Tarjeta>
          <Vacio>Tu organización todavía no tiene fincas registradas.</Vacio>
        </Tarjeta>
      </div>
    );
  }

  const finca = fincas.find((f) => f.id === uno(sp.finca)) ?? (await fincaConMasAnimales(supabase, fincas));
  const pedida = uno(sp.tab);
  const pestana: Pestana = PESTANAS.some((p) => p.id === pedida) ? (pedida as Pestana) : "operativo";

  let hasta = fechaValida(uno(sp.hasta)) ?? (await corteDeFinca(supabase, finca.id));
  let desde = fechaValida(uno(sp.desde)) ?? sumarDias(hasta, -15);
  if (desde > hasta) [desde, hasta] = [hasta, desde];

  const rango = { fincaId: finca.id, desde, hasta };
  const titulo = PESTANAS.find((p) => p.id === pestana)!.etiqueta;

  return (
    <div className="space-y-6 print:space-y-3">
      {/* El encabezado y el fondo del layout no aportan nada en papel */}
      <style>{`@media print {
        body > div > header, .mancha { display: none !important; }
        .fondo-vacinfo { background: #fff !important; }
        .grano::before { display: none; }
        .papel { box-shadow: none !important; }
        main { max-width: none !important; padding: 0 !important; }
      }`}</style>

      <Encabezado
        eyebrow={`Informe ${titulo.toLowerCase()} · ${finca.nombre}`}
        titulo="Ver informes"
        descripcion={`Del ${fecha(desde, true)} al ${fecha(hasta, true)}. Los datos salen de lo registrado en VacDaTa, sin transcribir planillas.`}
        acciones={<BotonImprimir />}
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <PestanasInforme fincaId={finca.id} desde={desde} hasta={hasta} pestana={pestana} />
        <FiltrosInforme fincas={fincas} fincaId={finca.id} desde={desde} hasta={hasta} pestana={pestana} />
      </div>

      <Suspense key={`${pestana}-${finca.id}-${desde}-${hasta}`} fallback={<EsqueletoInforme />}>
        {pestana === "operativo" && <InformeOperativo supabase={supabase} rango={rango} finca={finca} />}
        {pestana === "administrativo" && <InformeAdministrativo supabase={supabase} rango={rango} finca={finca} />}
        {pestana === "contable" && <InformeContable supabase={supabase} rango={rango} finca={finca} />}
      </Suspense>
    </div>
  );
}

import Link from "next/link";
import { ArrowRight, Calculator, FileSpreadsheet, MapPin, Plus, Search } from "lucide-react";
import { obtenerSesion, ROLES_GESTORES } from "@/lib/sesion";
import { corteDeFinca } from "@/lib/datos";
import { litros, num, pct } from "@/lib/formato";
import { BotonVolver, Encabezado, Etiqueta, Metrica, Vacio } from "@/components/ui";

export default async function Fincas({ searchParams }: PageProps<"/fincas">) {
  const { q } = await searchParams;
  const busqueda = typeof q === "string" ? q.trim() : "";
  const { supabase, rol } = await obtenerSesion();
  const gestor = ROLES_GESTORES.includes(rol);

  let consulta = supabase.from("fincas").select("id, nombre, municipio, departamento, vereda, area_cuadras, empresa_compradora").order("nombre");
  if (busqueda) {
    const patron = `%${busqueda.replace(/[%,()]/g, " ")}%`;
    consulta = consulta.or(`nombre.ilike.${patron},municipio.ilike.${patron},vereda.ilike.${patron}`);
  }
  const { data: fincas } = await consulta;

  const tarjetas = await Promise.all(
    (fincas ?? []).map(async (f) => {
      const corte = await corteDeFinca(supabase, f.id);
      const { data: resumen } = await supabase.rpc("resumen_finca", { p_finca: f.id, p_corte: corte }).single();
      const vientres = (resumen?.vacas_ordeno ?? 0) + (resumen?.vacas_horras ?? 0);
      return { f, resumen, produciendo: vientres ? (resumen?.vacas_ordeno ?? 0) / vientres : null };
    }),
  );

  return (
    <div className="space-y-8">
      <BotonVolver href="/" />
      <Encabezado
        eyebrow="Gestionar fincas"
        titulo="Tus fincas"
        descripcion="Busca una finca para ver sus animales, bienes, alertas y parámetros de costos."
        acciones={
          <>
            <form role="search" className="papel flex w-full gap-2 rounded-2xl p-3 lg:w-96">
              <label htmlFor="buscar-finca" className="sr-only">
                Buscar finca
              </label>
              <input id="buscar-finca" name="q" type="search" defaultValue={busqueda} placeholder="Nombre, municipio o vereda" className="campo-control" />
              <button className="rounded-xl bg-bosque px-4 text-leche" aria-label="Buscar">
                <Search className="h-5 w-5" />
              </button>
            </form>
            {gestor && (
              <Link href="/fincas/nueva" className="boton-accion inline-flex items-center gap-2 self-center rounded-xl bg-lima px-5 py-3 font-bold text-bosque">
                <Plus className="h-5 w-5" aria-hidden />
                Nueva finca
              </Link>
            )}
            {gestor && (
              <Link
                href={fincas?.length === 1 ? `/importar?finca=${fincas[0].id}` : "/importar"}
                className="inline-flex items-center gap-2 self-center rounded-xl border border-white/30 bg-[rgba(8,26,16,0.42)] px-5 py-3 font-bold text-leche hover:bg-[rgba(8,26,16,0.7)]"
              >
                <FileSpreadsheet className="h-5 w-5" aria-hidden />
                Importar Excel
              </Link>
            )}
          </>
        }
      />

      {busqueda && (
        <p className="text-leche/80">
          {tarjetas.length} resultado{tarjetas.length === 1 ? "" : "s"} para “{busqueda}” ·{" "}
          <Link href="/fincas" className="font-bold text-lima underline">
            ver todas
          </Link>
        </p>
      )}

      {tarjetas.length === 0 ? (
        <div className="papel rounded-3xl p-6">
          <Vacio>{busqueda ? "Ninguna finca coincide con la búsqueda." : "Aún no hay fincas registradas."}</Vacio>
        </div>
      ) : (
        <div className="space-y-6">
          {tarjetas.map(({ f, resumen, produciendo }) => (
            <article
              key={f.id}
              className="relative overflow-hidden rounded-3xl border border-white/75 bg-leche p-6 shadow-[0_18px_44px_rgba(4,24,13,0.2)] sm:p-8"
            >
              <div aria-hidden className="mancha -right-5 -top-4 h-16 w-20 [border-radius:61%_39%_45%_55%/48%_58%_42%_52%]" />
              <div className="flex flex-col justify-between gap-7 lg:flex-row">
                <div>
                  <Etiqueta tono={resumen?.vacas_ordeno ? "verde" : "gris"}>{resumen?.vacas_ordeno ? "En producción" : "Sin ordeño registrado"}</Etiqueta>
                  <h2 className="font-display mt-4 text-3xl font-bold text-bosque">{f.nombre}</h2>
                  <p className="mt-1 flex items-center gap-1 text-tinta-suave">
                    <MapPin className="h-4 w-4" aria-hidden />
                    {[f.vereda, f.municipio, f.departamento].filter(Boolean).join(", ") || "Ubicación sin registrar"}
                  </p>
                  {f.empresa_compradora && <p className="mt-1 text-sm text-tinta-suave">Proveedora de {f.empresa_compradora}</p>}
                </div>
                <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4 lg:max-w-3xl">
                  <Metrica valor={num(resumen?.vacas_ordeno ?? 0)} etiqueta="Vacas en ordeño" />
                  <Metrica valor={litros(resumen?.litros_dia ?? 0)} etiqueta="Litros / día" />
                  <Metrica valor={produciendo == null ? "—" : pct(produciendo)} etiqueta="Vacas produciendo" />
                  <Metrica valor={f.area_cuadras != null ? num(f.area_cuadras) : "—"} etiqueta="Área (cuadras)" tono="crema" />
                </div>
              </div>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href={`/fincas/${f.id}`} className="boton-accion inline-flex items-center gap-2 rounded-xl bg-bosque px-5 py-3 font-bold text-leche">
                  Ver finca
                  <ArrowRight className="h-5 w-5" aria-hidden />
                </Link>
                <Link href={`/fincas/${f.id}?tab=arbol`} className="inline-flex items-center gap-2 rounded-xl border border-bosque/20 px-5 py-3 font-bold text-bosque hover:bg-lima-suave">
                  Árbol de elementos
                </Link>
                <Link href={`/fincas/${f.id}/costos`} className="inline-flex items-center gap-2 rounded-xl border border-bosque/20 px-5 py-3 font-bold text-bosque hover:bg-lima-suave">
                  <Calculator className="h-5 w-5" aria-hidden />
                  Parámetros de costos
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

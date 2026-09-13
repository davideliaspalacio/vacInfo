import Link from "next/link";
import { BarChart3, BellRing, Droplets, Milk, TriangleAlert, Warehouse } from "lucide-react";
import { obtenerSesion } from "@/lib/sesion";
import { corteDeFinca } from "@/lib/datos";
import { fecha, litros, num } from "@/lib/formato";

const ACCIONES = [
  { href: "/fincas", texto: "Gestionar fincas", ayuda: "Fichas, animales, bienes y costos", icono: Warehouse, clase: "bg-lima" },
  { href: "/informes", texto: "Ver informes", ayuda: "Operativo, administrativo y contable", icono: BarChart3, clase: "bg-lima-suave" },
  { href: "/mensajes", texto: "Mensajes y notificaciones", ayuda: "Alertas y comentarios del equipo", icono: BellRing, clase: "bg-dorado" },
];

export default async function Inicio() {
  const { supabase, fincas } = await obtenerSesion();

  const resumenes = await Promise.all(
    fincas.map(async (f) => {
      const corte = await corteDeFinca(supabase, f.id);
      const [{ data: resumen }, { data: alertas }] = await Promise.all([
        supabase.rpc("resumen_finca", { p_finca: f.id, p_corte: corte }).single(),
        supabase.rpc("alertas_finca", { p_finca: f.id, p_corte: corte }),
      ]);
      return { finca: f, corte, resumen, altas: (alertas ?? []).filter((a) => a.prioridad === "alta").length };
    }),
  );

  return (
    <div className="grid items-center gap-12 py-4 lg:grid-cols-[1.05fr_0.95fr] lg:py-10">
      <div>
        <p className="mb-4 text-sm font-bold uppercase tracking-[0.16em] text-lima">Gestión lechera</p>
        <h1 className="font-display text-6xl font-bold leading-[0.94] text-leche sm:text-7xl lg:text-8xl">VacInfo</h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-leche/85">
          Administra tu producción desde la comodidad de tu casa. Conoce tus fincas, organiza tu equipo.
        </p>
        <div className="divisor-campo my-8 max-w-md" />
        <nav aria-label="Accesos principales" className="grid gap-4 sm:grid-cols-3">
          {ACCIONES.map(({ href, texto, ayuda, icono: Icono, clase }) => (
            <Link key={href} href={href} className={`boton-accion rounded-2xl p-5 text-left text-bosque ${clase}`}>
              <Icono className="mb-7 h-7 w-7" aria-hidden />
              <span className="block font-bold">{texto}</span>
              <span className="mt-1 block text-sm text-tinta-suave">{ayuda}</span>
            </Link>
          ))}
        </nav>
      </div>

      <div className="relative px-1 sm:px-6">
        <div
          className="relative min-h-[420px] overflow-hidden rounded-[32px] border-[7px] border-leche/90 bg-white p-6 shadow-[12px_14px_0_rgba(9,24,15,0.7)] sm:p-9 lg:min-h-[520px] lg:rounded-[48%_18%_42%_22%/28%_35%_20%_44%] lg:shadow-[22px_24px_0_rgba(9,24,15,0.76)]"
        >
          <div aria-hidden className="mancha -left-10 -top-8 h-40 w-56 rotate-12" />
          <div aria-hidden className="mancha -right-12 top-1/3 h-56 w-40 -rotate-12 [border-radius:60%_40%_44%_56%/35%_61%_39%_65%]" />
          <div aria-hidden className="mancha -bottom-12 left-1/4 h-28 w-48 [border-radius:38%_62%_52%_48%/64%_35%_65%_36%]" />
          <div aria-hidden className="mancha right-1/3 top-6 h-12 w-16 rotate-45" />

          <div className="relative flex h-full flex-col justify-center gap-4 pt-16 lg:px-6 lg:pt-24">
            <p className="w-fit rounded-full bg-bosque px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-lima">Hoy en tus fincas</p>
            {resumenes.length === 0 && (
              <p className="rounded-2xl bg-leche/95 p-5 text-tinta-suave shadow-lg">Aún no tienes fincas registradas.</p>
            )}
            {resumenes.map(({ finca, corte, resumen, altas }) => (
              <Link
                key={finca.id}
                href={`/fincas/${finca.id}`}
                className="block rounded-2xl border border-black/10 bg-leche/95 p-4 shadow-[0_10px_30px_rgba(3,19,11,0.25)] backdrop-blur transition hover:-translate-y-0.5"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <strong className="font-display text-xl text-bosque">{finca.nombre}</strong>
                  <span className="text-xs text-tinta-suave">al {fecha(resumen?.fecha_leche ?? corte)}</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-lima-suave px-2 py-2">
                    <Droplets className="mx-auto h-4 w-4 text-pasto-oscuro" aria-hidden />
                    <span className="font-display block text-lg font-bold text-bosque">{litros(resumen?.litros_dia ?? 0)}</span>
                    <span className="text-[11px] text-tinta-suave">litros día</span>
                  </div>
                  <div className="rounded-xl bg-lima-suave px-2 py-2">
                    <Milk className="mx-auto h-4 w-4 text-pasto-oscuro" aria-hidden />
                    <span className="font-display block text-lg font-bold text-bosque">{num(resumen?.vacas_ordeno ?? 0)}</span>
                    <span className="text-[11px] text-tinta-suave">vacas en ordeño</span>
                  </div>
                  <div className={`rounded-xl px-2 py-2 ${altas ? "bg-[#fbe9e5]" : "bg-lima-suave"}`}>
                    <TriangleAlert className={`mx-auto h-4 w-4 ${altas ? "text-alerta" : "text-pasto-oscuro"}`} aria-hidden />
                    <span className={`font-display block text-lg font-bold ${altas ? "text-alerta" : "text-bosque"}`}>{altas}</span>
                    <span className="text-[11px] text-tinta-suave">alertas altas</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

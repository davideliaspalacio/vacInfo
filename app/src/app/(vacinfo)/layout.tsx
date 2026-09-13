import Link from "next/link";
import { BarChart3, BellRing, CalendarDays, LineChart, LogOut, Package, Smartphone, Users, Warehouse } from "lucide-react";
import { obtenerSesion, ETIQUETA_ROL } from "@/lib/sesion";
import { cerrarSesion } from "@/app/login/actions";

const NAV = [
  { href: "/fincas", etiqueta: "Fincas", icono: Warehouse, clase: "bg-lima-suave" },
  { href: "/informes", etiqueta: "Informes", icono: BarChart3, clase: "bg-lima" },
  { href: "/indicadores", etiqueta: "Indicadores", icono: LineChart, clase: "bg-lima-suave" },
  { href: "/calendario", etiqueta: "Calendario", icono: CalendarDays, clase: "bg-lima-suave" },
  { href: "/inventario", etiqueta: "Inventario", icono: Package, clase: "bg-lima-suave" },
  { href: "/equipo", etiqueta: "Equipo", icono: Users, clase: "bg-lima-suave" },
  { href: "/mensajes", etiqueta: "Mensajes", icono: BellRing, clase: "bg-dorado" },
];

export default async function VacInfoLayout({ children }: LayoutProps<"/">) {
  const sesion = await obtenerSesion();

  return (
    <div className="fondo-vacinfo grano relative min-h-screen overflow-x-hidden">
      <div className="mancha -left-24 top-[22%] h-44 w-64 rotate-12 opacity-70" aria-hidden />
      <div className="mancha -right-20 top-[55%] h-60 w-48 -rotate-12 opacity-70" aria-hidden />

      <header className="sticky top-0 z-30 border-b border-white/30 bg-leche/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-3 rounded-xl">
            <span
              aria-hidden
              className="h-10 w-10 rounded-[50%_42%_55%_45%] border-2 border-tinta bg-white shadow-[0_4px_0_rgba(23,63,42,0.18)]"
              style={{
                background:
                  "radial-gradient(circle at 68% 25%, #111 0 13%, transparent 14%), radial-gradient(circle at 28% 68%, #111 0 19%, transparent 20%), #fff",
              }}
            />
            <span>
              <strong className="font-display block text-xl leading-none text-bosque">VacInfo</strong>
              <span className="text-xs text-tinta-suave">{sesion.organizacion}</span>
            </span>
          </Link>

          <nav aria-label="Navegación principal" className="flex items-center gap-2">
            {NAV.map(({ href, etiqueta, icono: Icono, clase }) => (
              <Link
                key={href}
                href={href}
                title={etiqueta}
                className={`inline-flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-bold text-bosque ${clase}`}
              >
                <Icono className="h-4 w-4" aria-hidden />
                <span className="hidden xl:inline">{etiqueta}</span>
              </Link>
            ))}
            <Link
              href="/campo"
              className="inline-flex items-center gap-2 rounded-xl border border-campo/30 px-3 py-2 text-sm font-bold text-campo-oscuro"
              title="Abrir VacDaTa, la app de campo"
            >
              <Smartphone className="h-4 w-4" aria-hidden />
              <span className="hidden lg:inline">VacDaTa</span>
            </Link>
            <div className="ml-2 hidden text-right text-xs leading-tight sm:block">
              <div className="font-bold">{sesion.nombre}</div>
              <div className="text-tinta-suave">{ETIQUETA_ROL[sesion.rol]}</div>
            </div>
            <form action={cerrarSesion}>
              <button className="rounded-xl p-2 text-tinta-suave hover:bg-black/5" aria-label="Cerrar sesión" title="Cerrar sesión">
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </nav>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-7xl px-5 py-8 sm:px-8">{children}</main>
    </div>
  );
}

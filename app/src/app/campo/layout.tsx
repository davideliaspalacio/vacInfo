import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { ArrowLeft, House, LogOut } from "lucide-react";
import { obtenerSesion, type Rol } from "@/lib/sesion";
import { cerrarSesion } from "@/app/login/actions";
import { InsigniaPendientes } from "@/components/offline/insignia-pendientes";
import { RegistrarSW } from "@/components/offline/registrar-sw";

export const metadata: Metadata = { title: { absolute: "VacDaTa" } };
export const viewport: Viewport = { themeColor: "#2563eb" };

const ROLES_VACINFO: Rol[] = ["propietario", "administrador", "consultor", "veterinario"];

export default async function CampoLayout({ children }: LayoutProps<"/campo">) {
  const { nombre, rol } = await obtenerSesion();

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-slate-50 to-white px-3 pb-32 text-slate-800">
      <div className="mx-auto w-full max-w-[520px]">
        <header className="sticky top-0 z-20 pb-3 pt-3 backdrop-blur-md">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/90 px-4 py-2 shadow-sm">
            <Link href="/campo" className="flex min-h-11 items-center gap-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-campo" aria-hidden />
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-900">VacDaTa</span>
            </Link>
            <div className="flex min-w-0 items-center gap-1">
              <InsigniaPendientes />
              <span className="truncate text-sm font-semibold text-slate-600">{nombre}</span>
              <form action={cerrarSesion}>
                <button aria-label="Cerrar sesión" title="Cerrar sesión" className="grid h-11 w-11 place-items-center rounded-xl text-slate-500 hover:bg-slate-100">
                  <LogOut className="h-5 w-5" aria-hidden />
                </button>
              </form>
            </div>
          </div>
          {ROLES_VACINFO.includes(rol) && (
            <Link href="/" className="mt-2 inline-flex items-center gap-1.5 px-1 text-xs font-bold text-campo-oscuro">
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              Volver a VacInfo
            </Link>
          )}
        </header>

        <main>{children}</main>
      </div>
      <RegistrarSW />

      <nav aria-label="Navegación inferior" className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto max-w-[520px]">
          <Link
            href="/campo"
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-campo text-lg font-bold text-white shadow-lg shadow-campo/25 transition active:scale-[0.99]"
          >
            <House className="h-5 w-5" aria-hidden />
            Inicio
          </Link>
        </div>
      </nav>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Building2, KeyRound } from "lucide-react";
import { rutaSegura } from "@/components/registro/cuentas";
import { FormularioLogin } from "./formulario";

export const metadata: Metadata = { title: "Ingresar" };

const DEMOS = [
  { email: "gustavo@vacinfo.local", rol: "Administrador · VacInfo" },
  { email: "propietario@vacinfo.local", rol: "Propietario · VacInfo" },
  { email: "consultor@vacinfo.local", rol: "Consultor · informes" },
  { email: "nelson@vacinfo.local", rol: "Mayordomo · VacDaTa" },
  { email: "jhon@vacinfo.local", rol: "Trabajador · VacDaTa" },
];

// Las cuentas demo solo existen en la base local (semillas); en producción no se muestran.
const esBaseLocal = /127\.0\.0\.1|localhost/.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const siguiente = rutaSegura((await searchParams).siguiente) ?? undefined;

  return (
    <main className="fondo-vacinfo grano relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10">
      <div className="mancha -left-24 top-[18%] h-44 w-64 rotate-12 opacity-80" aria-hidden />
      <div className="mancha -right-20 top-[48%] h-60 w-48 -rotate-12 opacity-80" aria-hidden />
      <div className="relative z-10 grid w-full max-w-5xl items-center gap-10 lg:grid-cols-2">
        <div className="text-leche">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-lima">Gestión lechera</p>
          <h1 className="font-display mt-3 text-6xl font-extrabold leading-[0.95] sm:text-7xl">VacInfo</h1>
          <p className="mt-5 max-w-md text-lg text-leche/85">
            Administra tu producción desde la comodidad de tu casa. Conoce tus fincas, organiza tu equipo.
          </p>
          <div className="divisor-campo my-8 max-w-sm" />
          <p className="text-sm text-leche/70">
            Los trabajadores registran desde el celular con <strong className="text-lima">VacDaTa</strong>.
          </p>
        </div>

        <div className="papel rounded-3xl p-7">
          <h2 className="font-display text-2xl font-bold text-bosque">Ingresar</h2>
          <FormularioLogin siguiente={siguiente} />
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <Link
              href="/registro"
              className="flex items-center justify-center gap-2 rounded-xl border border-bosque/20 bg-lima-suave px-4 py-2.5 text-sm font-bold text-bosque hover:bg-lima"
            >
              <Building2 className="h-4 w-4" aria-hidden />
              Crear cuenta de empresa
            </Link>
            <Link
              href="/unirse"
              className="flex items-center justify-center gap-2 rounded-xl border border-bosque/20 px-4 py-2.5 text-sm font-bold text-bosque hover:bg-lima-suave"
            >
              <KeyRound className="h-4 w-4" aria-hidden />
              Tengo un código de invitación
            </Link>
          </div>
          {esBaseLocal && (
          <div className="mt-7 border-t border-tinta/10 pt-5">
            <p className="text-xs font-bold uppercase tracking-wider text-tinta-suave">Cuentas de demostración · contraseña vacinfo123</p>
            <ul className="mt-3 space-y-1.5 text-sm">
              {DEMOS.map((d) => (
                <li key={d.email} className="flex justify-between gap-3">
                  <code className="text-bosque">{d.email}</code>
                  <span className="text-tinta-suave">{d.rol}</span>
                </li>
              ))}
            </ul>
          </div>
          )}
        </div>
      </div>
    </main>
  );
}

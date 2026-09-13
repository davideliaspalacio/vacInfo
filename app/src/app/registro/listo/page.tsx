import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, FileSpreadsheet, UserPlus, Warehouse } from "lucide-react";
import { MarcoRegistro } from "@/components/registro/marco";
import { MensajeError } from "@/components/fincas/campo";
import { estadoRegistro, rutaPaso } from "@/components/registro/servidor";
import { diasHasta, fechaLarga } from "@/components/registro/cuentas";
import { hoyISO } from "@/lib/formato";

export const metadata: Metadata = { title: "¡Listo!" };

export default async function RegistroListoPage({ searchParams }: PageProps<"/registro/listo">) {
  const { finca, aviso } = await searchParams;
  const estado = await estadoRegistro();
  const ruta = rutaPaso(estado);
  if (ruta !== "/registro/listo" || !estado.membresia) redirect(ruta);

  let fincaId = estado.fincaId!;
  if (typeof finca === "string" && /^[0-9a-f-]{36}$/i.test(finca)) {
    const { data } = await estado.supabase
      .from("fincas")
      .select("id")
      .eq("id", finca)
      .eq("organizacion_id", estado.membresia.organizacion_id)
      .maybeSingle();
    if (data) fincaId = data.id;
  }

  const organizacion = estado.membresia.organizaciones;
  const pruebaHasta = organizacion?.prueba_hasta;
  const dias = pruebaHasta ? diasHasta(pruebaHasta, hoyISO()) : null;

  const pasos = [
    {
      href: `/importar?finca=${fincaId}`,
      titulo: "Importar tu Excel",
      texto: "Sube las planillas quincenales y carga vacas, partos, servicios y secados.",
      icono: FileSpreadsheet,
    },
    {
      href: "/equipo",
      titulo: "Invitar a tu equipo",
      texto: "Genera un código para que mayordomos y trabajadores entren sin correo.",
      icono: UserPlus,
    },
    {
      href: `/fincas/${fincaId}`,
      titulo: "Ver tu finca",
      texto: "Completa la hoja de la finca, animales, potreros y bienes.",
      icono: Warehouse,
    },
  ];

  return (
    <MarcoRegistro
      paso={4}
      titulo={`¡Listo, ${organizacion?.nombre ?? "tu empresa"} ya está en VacInfo!`}
      descripcion="Tu empresa y tu primera finca quedaron creadas. Estos son los siguientes pasos recomendados."
    >
      <h2 className="font-display text-2xl font-bold text-bosque">¡Listo!</h2>

      {aviso === "potreros" && (
        <div className="mt-4">
          <MensajeError>La finca quedó creada, pero no pudimos crear los potreros. Agrégalos desde la hoja de la finca.</MensajeError>
        </div>
      )}

      {pruebaHasta && (
        <div className="mt-4 rounded-2xl border border-[#cadba8] bg-lima-suave p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-pasto-oscuro">Prueba gratis</p>
          <p className="font-display mt-1 text-xl font-bold text-bosque">Hasta el {fechaLarga(pruebaHasta)}</p>
          {dias !== null && dias >= 0 && (
            <p className="text-sm text-tinta-suave">
              {dias === 0 ? "Termina hoy." : `Te quedan ${dias} ${dias === 1 ? "día" : "días"}.`} No se hace ningún cobro.
            </p>
          )}
        </div>
      )}

      <ul className="mt-6 space-y-3">
        {pasos.map(({ href, titulo, texto, icono: Icono }) => (
          <li key={titulo}>
            <Link
              href={href}
              className="group flex items-center gap-4 rounded-2xl border border-tinta/10 bg-white/80 p-4 transition hover:border-pasto hover:bg-white"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-lima text-bosque">
                <Icono className="h-6 w-6" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="font-display block text-lg text-bosque">{titulo}</strong>
                <span className="text-sm text-tinta-suave">{texto}</span>
              </span>
              <ArrowRight className="h-5 w-5 shrink-0 text-pasto-oscuro transition group-hover:translate-x-1" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>

      <Link href="/" className="boton-accion mt-6 flex w-full items-center justify-center rounded-xl bg-bosque px-5 py-3 font-bold text-leche">
        Ir al panel de VacInfo
      </Link>
    </MarcoRegistro>
  );
}

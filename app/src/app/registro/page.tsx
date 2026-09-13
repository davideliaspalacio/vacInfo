import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MarcoRegistro } from "@/components/registro/marco";
import { FormularioCuenta } from "@/components/registro/formularios";
import { estadoRegistro, rutaPaso } from "@/components/registro/servidor";

export const metadata: Metadata = { title: "Crear cuenta de empresa" };

export default async function RegistroPage() {
  const estado = await estadoRegistro();
  if (estado.user) redirect(rutaPaso(estado));

  return (
    <MarcoRegistro
      paso={1}
      titulo="Tu lechería, organizada desde hoy"
      descripcion="En cuatro pasos dejas lista tu empresa y tu primera finca. Tienes 30 días de prueba gratis, sin tarjeta."
    >
      <h2 className="font-display text-2xl font-bold text-bosque">Tu cuenta</h2>
      <p className="mt-1 text-sm text-tinta-suave">Con este correo y contraseña ingresarás a VacInfo.</p>
      <FormularioCuenta />
      <div className="mt-6 space-y-1 border-t border-tinta/10 pt-4 text-sm text-tinta-suave">
        <p>
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-bold text-bosque underline">
            Ingresa
          </Link>
        </p>
        <p>
          ¿Trabajas en una finca que ya usa VacInfo?{" "}
          <Link href="/unirse" className="font-bold text-bosque underline">
            Usa tu código de invitación
          </Link>
        </p>
      </div>
    </MarcoRegistro>
  );
}

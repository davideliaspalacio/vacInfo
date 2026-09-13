import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cerrarSesion } from "@/app/login/actions";
import { MarcoRegistro } from "@/components/registro/marco";
import { FormularioEmpresa } from "@/components/registro/formularios";
import { estadoRegistro, rutaPaso } from "@/components/registro/servidor";

export const metadata: Metadata = { title: "Tu empresa" };

export default async function RegistroEmpresaPage() {
  const estado = await estadoRegistro();
  if (!estado.user) redirect("/registro");
  if (estado.membresia) redirect(rutaPaso(estado));

  const nombre = String(estado.user.user_metadata?.nombre_completo ?? "").split(" ")[0];

  return (
    <MarcoRegistro
      paso={2}
      titulo={nombre ? `Hola, ${nombre}` : "Tu empresa"}
      descripcion="Ahora cuéntanos de tu empresa: bajo ella quedan tus fincas, informes y equipo."
    >
      <h2 className="font-display text-2xl font-bold text-bosque">Tu empresa</h2>
      <p className="mt-1 text-sm text-tinta-suave">Quedarás como propietario. Tu prueba gratis de 30 días empieza hoy.</p>
      <FormularioEmpresa />
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-tinta/10 pt-4 text-sm text-tinta-suave">
        <p>
          ¿Te invitaron a una empresa?{" "}
          <Link href="/unirse" className="font-bold text-bosque underline">
            Usa tu código
          </Link>
        </p>
        <form action={cerrarSesion}>
          <button className="font-bold text-tinta-suave underline">Cerrar sesión</button>
        </form>
      </div>
    </MarcoRegistro>
  );
}

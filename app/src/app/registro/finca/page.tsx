import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MarcoRegistro } from "@/components/registro/marco";
import { FormularioPrimeraFinca } from "@/components/registro/formularios";
import { estadoRegistro, rutaPaso } from "@/components/registro/servidor";

export const metadata: Metadata = { title: "Tu primera finca" };

export default async function RegistroFincaPage() {
  const estado = await estadoRegistro();
  const ruta = rutaPaso(estado);
  if (ruta !== "/registro/finca") redirect(ruta);

  return (
    <MarcoRegistro
      paso={3}
      titulo={estado.membresia?.organizaciones?.nombre ?? "Tu primera finca"}
      descripcion="Registra la finca con lo básico. Los datos de producción los puedes traer después desde tu Excel."
    >
      <h2 className="font-display text-2xl font-bold text-bosque">Tu primera finca</h2>
      <p className="mt-1 text-sm text-tinta-suave">Solo el nombre es obligatorio.</p>
      <FormularioPrimeraFinca />
    </MarcoRegistro>
  );
}

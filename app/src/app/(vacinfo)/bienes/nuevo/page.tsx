import { redirect } from "next/navigation";
import { soloLectura } from "@/lib/permisos";
import { obtenerSesion } from "@/lib/sesion";
import { BotonVolver, Encabezado, Tarjeta, Vacio } from "@/components/ui";
import { FormularioBien } from "@/components/fincas/formulario-bien";
import { fincasConCodigos } from "@/components/fincas/consultas";
import { guardarBien } from "../actions";

export default async function NuevoBien({ searchParams }: PageProps<"/bienes/nuevo">) {
  const { finca } = await searchParams;
  const sesion = await obtenerSesion();
  const fincaInicial = typeof finca === "string" && sesion.fincas.some((f) => f.id === finca) ? finca : undefined;
  const volver = fincaInicial ? `/fincas/${fincaInicial}?tab=bienes` : "/fincas";
  if (soloLectura(sesion.rol)) redirect(volver);
  const fincas = await fincasConCodigos(sesion);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <BotonVolver href={volver} />
      <Encabezado eyebrow="Hoja informativa bien o servicio" titulo="Nueva ficha de bien" descripcion="Equipos, vehículos, herramientas e infraestructura de la finca." />
      <Tarjeta>
        {fincas.length === 0 ? (
          <Vacio>Primero crea una finca.</Vacio>
        ) : (
          <FormularioBien accion={guardarBien.bind(null, null)} fincas={fincas} fincaInicial={fincaInicial} cancelar={volver} />
        )}
      </Tarjeta>
    </div>
  );
}

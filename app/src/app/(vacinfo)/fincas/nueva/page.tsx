import { redirect } from "next/navigation";
import { obtenerSesion, ROLES_GESTORES } from "@/lib/sesion";
import { BotonVolver, Encabezado, Tarjeta } from "@/components/ui";
import { FormularioFinca } from "@/components/fincas/formulario-finca";
import { guardarFinca } from "../actions";

export default async function NuevaFinca() {
  const { rol } = await obtenerSesion();
  if (!ROLES_GESTORES.includes(rol)) redirect("/fincas");

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <BotonVolver href="/fincas" />
      <Encabezado eyebrow="Hoja informativa finca" titulo="Nueva finca" descripcion="Registra los datos generales y de venta de leche." />
      <Tarjeta>
        <FormularioFinca accion={guardarFinca.bind(null, null)} cancelar="/fincas" />
      </Tarjeta>
    </div>
  );
}

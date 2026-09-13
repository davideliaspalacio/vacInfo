import { notFound, redirect } from "next/navigation";
import { obtenerSesion, ROLES_GESTORES } from "@/lib/sesion";
import { BotonVolver, Encabezado, Tarjeta } from "@/components/ui";
import { FormularioFinca } from "@/components/fincas/formulario-finca";
import { guardarFinca } from "../../actions";

export default async function EditarFinca({ params }: PageProps<"/fincas/[id]/editar">) {
  const { id } = await params;
  const { supabase, rol } = await obtenerSesion();
  if (!ROLES_GESTORES.includes(rol)) redirect(`/fincas/${id}`);

  const { data: finca } = await supabase.from("fincas").select("*").eq("id", id).maybeSingle();
  if (!finca) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <BotonVolver href={`/fincas/${id}`} />
      <Encabezado eyebrow="Hoja informativa finca" titulo={`Editar ${finca.nombre}`} />
      <Tarjeta>
        <FormularioFinca accion={guardarFinca.bind(null, id)} finca={finca} cancelar={`/fincas/${id}`} />
      </Tarjeta>
    </div>
  );
}

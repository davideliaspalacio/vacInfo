import { notFound, redirect } from "next/navigation";
import { urlFirmadaFoto } from "@/lib/fotos";
import { obtenerSesion, ROLES_GESTORES } from "@/lib/sesion";
import { Encabezado, Tarjeta } from "@/components/ui";
import { FormularioFinca } from "@/components/fincas/formulario-finca";
import { guardarFinca } from "../../actions";

export default async function EditarFinca({ params }: PageProps<"/fincas/[id]/editar">) {
  const { id } = await params;
  const { supabase, rol, organizacionId } = await obtenerSesion();
  if (!ROLES_GESTORES.includes(rol)) redirect(`/fincas/${id}`);

  const { data: finca } = await supabase.from("fincas").select("*").eq("id", id).maybeSingle();
  if (!finca) notFound();
  const fotoUrl = await urlFirmadaFoto(supabase, finca.foto_url);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <Encabezado eyebrow="Hoja informativa finca" titulo={`Editar ${finca.nombre}`} />
      <Tarjeta>
        <FormularioFinca accion={guardarFinca.bind(null, id)} finca={finca} cancelar={`/fincas/${id}`} organizacionId={organizacionId} fotoUrl={fotoUrl} />
      </Tarjeta>
    </div>
  );
}

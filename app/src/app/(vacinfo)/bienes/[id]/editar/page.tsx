import { notFound, redirect } from "next/navigation";
import { obtenerSesion, ROLES_GESTORES } from "@/lib/sesion";
import { BotonVolver, Encabezado, Tarjeta } from "@/components/ui";
import { FormularioBien } from "@/components/fincas/formulario-bien";
import { fincasConCodigos } from "@/components/fincas/consultas";
import { guardarBien } from "../../actions";

export default async function EditarBien({ params }: PageProps<"/bienes/[id]/editar">) {
  const { id } = await params;
  const sesion = await obtenerSesion();
  if (!ROLES_GESTORES.includes(sesion.rol)) redirect(`/bienes/${id}`);

  const [{ data: bien }, fincas] = await Promise.all([sesion.supabase.from("bienes").select("*").eq("id", id).maybeSingle(), fincasConCodigos(sesion)]);
  if (!bien) notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <BotonVolver href={`/bienes/${id}`} />
      <Encabezado eyebrow="Hoja informativa bien o servicio" titulo={`Editar ${bien.nombre}`} />
      <Tarjeta>
        <FormularioBien accion={guardarBien.bind(null, id)} fincas={fincas} bien={bien} cancelar={`/bienes/${id}`} />
      </Tarjeta>
    </div>
  );
}

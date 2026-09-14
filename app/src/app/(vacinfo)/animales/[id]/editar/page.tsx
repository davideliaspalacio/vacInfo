import { notFound, redirect } from "next/navigation";
import { obtenerSesion, ROLES_GESTORES } from "@/lib/sesion";
import { BotonVolver, Encabezado, Tarjeta } from "@/components/ui";
import { FormularioAnimal } from "@/components/fincas/formulario-animal";
import { candidatosParientes, fincasConCodigos, torosDeServicios } from "@/components/fincas/consultas";
import { guardarAnimal } from "../../actions";

export default async function EditarAnimal({ params }: PageProps<"/animales/[id]/editar">) {
  const { id } = await params;
  const sesion = await obtenerSesion();
  if (!ROLES_GESTORES.includes(sesion.rol)) redirect(`/animales/${id}`);

  const [{ data: animal }, fincas, candidatos, torosServicios] = await Promise.all([
    sesion.supabase.from("animales").select("*").eq("id", id).maybeSingle(),
    fincasConCodigos(sesion),
    candidatosParientes(sesion),
    torosDeServicios(sesion),
  ]);
  if (!animal) notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <BotonVolver href={`/animales/${id}`} />
      <Encabezado eyebrow="Hoja informativa ser vivo" titulo={`Editar ${animal.nombre}`} />
      <Tarjeta>
        <FormularioAnimal
          accion={guardarAnimal.bind(null, id)}
          fincas={fincas}
          candidatos={candidatos}
          torosServicios={torosServicios}
          animal={animal}
          cancelar={`/animales/${id}`}
        />
      </Tarjeta>
    </div>
  );
}

import { notFound, redirect } from "next/navigation";
import { urlFirmadaFoto } from "@/lib/fotos";
import { obtenerSesion, ROLES_GESTORES } from "@/lib/sesion";
import { Encabezado, Tarjeta } from "@/components/ui";
import { FormularioAnimal } from "@/components/fincas/formulario-animal";
import { candidatosParientes, fincasConCodigos, torosDeServicios } from "@/components/fincas/consultas";
import { guardarAnimal } from "../../actions";

export default async function EditarAnimal({ params }: PageProps<"/animales/[id]/editar">) {
  const { id } = await params;
  const sesion = await obtenerSesion();
  if (!ROLES_GESTORES.includes(sesion.rol)) redirect(`/animales/${id}`);

  // El último parto y la última fecha servida llenan la sección «Datos de vacas productivas» para
  // que al editar una vaca no aparezca vacía (y para no volver a crear lo que ya está registrado).
  const [{ data: animal }, fincas, candidatos, torosServicios, { data: parto }, { data: servicio }] = await Promise.all([
    sesion.supabase.from("animales").select("*").eq("id", id).maybeSingle(),
    fincasConCodigos(sesion),
    candidatosParientes(sesion),
    torosDeServicios(sesion),
    sesion.supabase.from("partos").select("fecha").eq("animal_id", id).order("fecha", { ascending: false }).limit(1).maybeSingle(),
    sesion.supabase.from("servicios").select("fecha").eq("animal_id", id).order("fecha", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!animal) notFound();
  const fotoUrl = await urlFirmadaFoto(sesion.supabase, animal.foto_url);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <Encabezado eyebrow="Hoja informativa animal" titulo={`Editar ${animal.nombre}`} />
      <Tarjeta>
        <FormularioAnimal
          accion={guardarAnimal.bind(null, id)}
          fincas={fincas}
          candidatos={candidatos}
          torosServicios={torosServicios}
          animal={animal}
          datosProductivos={{ ultimoParto: parto?.fecha ?? null, fechaServida: servicio?.fecha ?? null }}
          cancelar={`/animales/${id}`}
          organizacionId={sesion.organizacionId}
          fotoUrl={fotoUrl}
          puedeFoto
        />
      </Tarjeta>
    </div>
  );
}

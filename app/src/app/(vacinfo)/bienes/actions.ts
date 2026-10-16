"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Constants } from "@/lib/database.types";
import { borrarFoto } from "@/lib/fotos";
import { MENSAJE_SOLO_LECTURA, soloLectura } from "@/lib/permisos";
import { obtenerSesion, ROLES_GESTORES } from "@/lib/sesion";
import type { EstadoFormulario } from "@/components/fincas/campo";
import { datosDe, fechaOpcional, fotoOpcional, mensajeErrorBD, textoOpcional, textoRequerido } from "@/components/fincas/validacion";

const esquemaBien = z.object({
  finca_id: z.uuid("Elige una finca"),
  codigo: textoRequerido("Escribe el código del bien"),
  nombre: textoRequerido("Escribe el nombre"),
  tipo: z.enum(Constants.public.Enums.tipo_bien, "Elige el tipo"),
  marca: textoOpcional,
  metodo_adquisicion: textoOpcional,
  fecha_adquisicion: fechaOpcional,
  garantia_hasta: fechaOpcional,
  estado: z.enum(Constants.public.Enums.estado_bien, "Elige el estado"),
  descripcion: textoOpcional,
  recordatorio: textoOpcional,
});

export async function guardarBien(id: string | null, _: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const { supabase, rol, fincas, organizacionId } = await obtenerSesion();
  if (soloLectura(rol)) return { mensaje: MENSAJE_SOLO_LECTURA };
  if (id &&!ROLES_GESTORES.includes(rol)) return { mensaje: "Solo propietarios y administradores pueden editar fichas." };

  const resultado = esquemaBien.safeParse(datosDe(formData));
  if (!resultado.success) return { errores: z.flattenError(resultado.error).fieldErrors, mensaje: "Revisa los campos marcados." };

  // La foto llega como ruta del bucket privado; se comprueba que sea de esta empresa y de este tipo.
  const foto = fotoOpcional(organizacionId, "bienes").safeParse(formData.get("foto_url"));
  if (!foto.success) return { errores: { foto_url: ["Vuelve a subir la foto"] }, mensaje: "Revisa los campos marcados." };
  if (foto.data && !ROLES_GESTORES.includes(rol)) return { mensaje: "Solo propietarios y administradores pueden poner la foto." };

  const datos = { ...resultado.data, foto_url: foto.data };
  if (!fincas.some((f) => f.id === datos.finca_id)) return { errores: { finca_id: ["Finca no disponible"] } };
  if (datos.fecha_adquisicion && datos.garantia_hasta && datos.garantia_hasta < datos.fecha_adquisicion) {
    return { errores: { garantia_hasta: ["La garantía no puede terminar antes de la adquisición"] } };
  }

  const fotoAnterior = id ? (await supabase.from("bienes").select("foto_url").eq("id", id).maybeSingle()).data?.foto_url : null;

  const consulta = id
    ? supabase.from("bienes").update(datos).eq("id", id).select("id").single()
    : supabase.from("bienes").insert(datos).select("id").single();
  const { data, error } = await consulta;
  if (error || !data) {
    const mensaje = error ? mensajeErrorBD(error, `Ya existe un bien con el código ${datos.codigo} en esta finca.`) : "No se encontró el bien.";
    return error?.code === "23505" ? { mensaje, errores: { codigo: ["Código repetido"] } } : { mensaje };
  }

  // Al cambiar o quitar la foto, la anterior se borra del bucket para no acumular archivos sueltos.
  if (fotoAnterior && fotoAnterior !== foto.data) await borrarFoto(supabase, fotoAnterior);

  revalidatePath(`/fincas/${datos.finca_id}`);
  revalidatePath(`/bienes/${data.id}`);
  redirect(`/bienes/${data.id}`);
}

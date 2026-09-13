"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Constants } from "@/lib/database.types";
import { obtenerSesion, ROLES_GESTORES } from "@/lib/sesion";
import type { EstadoFormulario } from "@/components/fincas/campo";
import { datosDe, fechaOpcional, mensajeErrorBD, numeroOpcional, textoOpcional, textoRequerido } from "@/components/fincas/validacion";

const enums = Constants.public.Enums;

const esquemaAnimal = z.object({
  finca_id: z.uuid("Elige una finca"),
  codigo: textoRequerido("Escribe el código del animal"),
  chapeta: textoOpcional,
  nombre: textoRequerido("Escribe el nombre"),
  especie: z.enum(enums.especie, "Elige la especie"),
  categoria: z.enum(enums.categoria_animal, "Elige la categoría"),
  sexo: z.enum(enums.sexo, "Elige el sexo"),
  raza: textoOpcional,
  color: textoOpcional,
  fecha_nacimiento: fechaOpcional,
  peso_kg: numeroOpcional,
  metodo_adquisicion: textoOpcional,
  padre_nombre: textoOpcional,
  madre_id: z
    .string()
    .nullish()
    .transform((v) => v || null)
    .pipe(z.uuid().nullable()),
  madre_nombre: textoOpcional,
  notas: textoOpcional,
});

export async function guardarAnimal(id: string | null, _: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const { supabase, rol, fincas } = await obtenerSesion();
  if (id && !ROLES_GESTORES.includes(rol)) return { mensaje: "Solo propietarios y administradores pueden editar fichas." };

  const resultado = esquemaAnimal.safeParse(datosDe(formData));
  if (!resultado.success) return { errores: z.flattenError(resultado.error).fieldErrors, mensaje: "Revisa los campos marcados." };

  const datos = resultado.data;
  if (!fincas.some((f) => f.id === datos.finca_id)) return { errores: { finca_id: ["Finca no disponible"] } };
  if (id && datos.madre_id === id) return { errores: { madre_id: ["Un animal no puede ser su propia madre"] } };

  if (datos.madre_id && !datos.madre_nombre) {
    const { data: madre } = await supabase.from("animales").select("nombre").eq("id", datos.madre_id).single();
    datos.madre_nombre = madre?.nombre ?? null;
  }

  const consulta = id
    ? supabase.from("animales").update(datos).eq("id", id).select("id").single()
    : supabase.from("animales").insert(datos).select("id").single();
  const { data, error } = await consulta;
  if (error || !data) {
    const mensaje = error ? mensajeErrorBD(error, `Ya existe un animal con el código ${datos.codigo} en esta finca.`) : "No se encontró el animal.";
    return error?.code === "23505" ? { mensaje, errores: { codigo: ["Código repetido"] } } : { mensaje };
  }

  revalidatePath(`/fincas/${datos.finca_id}`);
  revalidatePath(`/animales/${data.id}`);
  redirect(`/animales/${data.id}`);
}

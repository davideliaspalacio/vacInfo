"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Constants } from "@/lib/database.types";
import { MENSAJE_SOLO_LECTURA, soloLectura } from "@/lib/permisos";
import { obtenerSesion, ROLES_GESTORES } from "@/lib/sesion";
import type { EstadoFormulario } from "@/components/fincas/campo";
import { ESPECIE_DE_CATEGORIA } from "@/components/fincas/etiquetas";
import { datosDe, fechaOpcional, mensajeErrorBD, numeroOpcional, textoOpcional, textoRequerido } from "@/components/fincas/validacion";

const enums = Constants.public.Enums;
const PADRE_OTRO = "__otro__";

const esquemaAnimal = z
  .object({
    finca_id: z.uuid("Elige una finca"),
    codigo: textoRequerido("Escribe el código del animal"),
    chapeta: textoOpcional,
    nombre: textoRequerido("Escribe el nombre"),
    categoria: z.enum(enums.categoria_animal, "Elige la categoría"),
    sexo: z.enum(enums.sexo, "Elige el sexo"),
    raza: textoOpcional,
    color: textoOpcional,
    fecha_nacimiento: fechaOpcional,
    peso_kg: numeroOpcional,
    metodo_adquisicion: textoOpcional,
    padre_nombre: textoOpcional,
    padre_otro: textoOpcional,
    madre_id: z
      .string()
      .nullish()
      .transform((v) => v || null)
      .pipe(z.uuid().nullable()),
    notas: textoOpcional,
  })
  .refine((d) => d.padre_nombre !== PADRE_OTRO || d.padre_otro, { path: ["padre_otro"], message: "Escribe el nombre del toro" })
  .transform(({ padre_otro, ...d }) => ({
    ...d,
    especie: ESPECIE_DE_CATEGORIA[d.categoria],
    padre_nombre: d.padre_nombre === PADRE_OTRO ? padre_otro : d.padre_nombre,
  }));

export async function guardarAnimal(id: string | null, _: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const { supabase, rol, fincas } = await obtenerSesion();
  if (soloLectura(rol)) return { mensaje: MENSAJE_SOLO_LECTURA };
  if (id && !ROLES_GESTORES.includes(rol)) return { mensaje: "Solo propietarios y administradores pueden editar fichas." };

  const resultado = esquemaAnimal.safeParse(datosDe(formData));
  if (!resultado.success) return { errores: z.flattenError(resultado.error).fieldErrors, mensaje: "Revisa los campos marcados." };

  const base = resultado.data;
  if (!fincas.some((f) => f.id === base.finca_id)) return { errores: { finca_id: ["Finca no disponible"] } };
  if (id && base.madre_id === id) return { errores: { madre_id: ["Un animal no puede ser su propia madre"] } };

  let madre_nombre: string | null = null;
  if (base.madre_id) {
    const { data: madre } = await supabase.from("animales").select("nombre, finca_id").eq("id", base.madre_id).maybeSingle();
    if (!madre || madre.finca_id !== base.finca_id) return { errores: { madre_id: ["La madre debe ser de la misma finca"] } };
    madre_nombre = madre.nombre;
  }
  const datos = { ...base, madre_nombre };

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

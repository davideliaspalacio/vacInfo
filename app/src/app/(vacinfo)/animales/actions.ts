"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { MENSAJE_SOLO_LECTURA, soloLectura } from "@/lib/permisos";
import { CATEGORIAS_FORMULARIO, errorMadre, especieDeCategoria, sexoDeCategoria } from "@/lib/parientes";
import { obtenerSesion, ROLES_GESTORES } from "@/lib/sesion";
import type { EstadoFormulario } from "@/components/fincas/campo";
import { datosDe, fechaOpcional, mensajeErrorBD, numeroOpcional, textoOpcional, textoRequerido } from "@/components/fincas/validacion";

const PADRE_OTRO = "__otro__";

const esquemaAnimal = z
  .object({
    finca_id: z.uuid("Elige una finca"),
    codigo: textoRequerido("Escribe el código del animal"),
    chapeta: textoOpcional,
    nombre: textoRequerido("Escribe el nombre"),
    categoria: z.enum(CATEGORIAS_FORMULARIO, "Elige la categoría"),
    sexo: z.enum(["hembra", "macho"], "Elige el sexo").optional(),
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
  .refine((d) => d.padre_nombre !== PADRE_OTRO || d.padre_otro, { path: ["padre_otro"], message: "Escribe el nombre del padre" })
  .refine((d) => sexoDeCategoria(d.categoria) || d.sexo, { path: ["sexo"], message: "Elige el sexo" })
  .transform(({ padre_otro, sexo, ...d }) => ({
    ...d,
    // En bovinos el sexo lo define la categoría (ternera/novilla/vaca hembra; ternero/novillo/toro macho).
    sexo: sexoDeCategoria(d.categoria) ?? sexo!,
    especie: especieDeCategoria(d.categoria),
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

  let madre_nombre: string | null = null;
  if (base.madre_id) {
    const { data: madre } = await supabase.from("animales").select("id, nombre, finca_id, sexo, especie").eq("id", base.madre_id).maybeSingle();
    const error = errorMadre(madre, { fincaId: base.finca_id, categoria: base.categoria, excluirId: id });
    if (error) return { errores: { madre_id: [error] }, mensaje: "Revisa los campos marcados." };
    madre_nombre = madre!.nombre;
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

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { MENSAJE_SOLO_LECTURA, soloLectura } from "@/lib/permisos";
import { obtenerSesion, ROLES_GESTORES } from "@/lib/sesion";
import type { EstadoFormulario } from "@/components/fincas/campo";
import type { EstadoAccion } from "@/components/fincas/formulario-accion";
import { datosDe, mensajeErrorBD, numeroOpcional, textoOpcional, textoRequerido } from "@/components/fincas/validacion";

/** Regla numérica de la finca: vacía → se conserva el valor actual (o el predeterminado al crear). */
const reglaOpcional = numeroOpcional.transform((v) => v ?? undefined);

const esquemaReglas = z.object({
  dias_destete: reglaOpcional,
  edad_servicio_meses: reglaOpcional,
  peso_servicio_kg: reglaOpcional,
  dias_descanso_objetivo: reglaOpcional,
});

/** Edición rápida de las reglas de levante y potreros desde sus propias pantallas. */
export async function guardarReglasFinca(id: string, _: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  const { supabase, rol } = await obtenerSesion();
  if (soloLectura(rol)) return { error: MENSAJE_SOLO_LECTURA };
  if (!ROLES_GESTORES.includes(rol)) return { error: "Solo propietarios y administradores pueden cambiar las reglas." };

  const resultado = esquemaReglas.safeParse(datosDe(formData));
  if (!resultado.success) return { error: "Escribe números válidos." };
  const cambios: Partial<Record<keyof typeof resultado.data, number>> = {};
  for (const [clave, valor] of Object.entries(resultado.data) as [keyof typeof resultado.data, number | undefined][]) {
    if (valor !== undefined) cambios[clave] = valor;
  }
  if (!Object.keys(cambios).length) return { error: "No hay cambios." };

  const { error } = await supabase.from("fincas").update(cambios).eq("id", id);
  if (error) return { error: mensajeErrorBD(error) };

  revalidatePath(`/fincas/${id}`, "layout");
  return { ok: "Reglas guardadas" };
}

const esquemaFinca = z.object({
  nombre: textoRequerido("Escribe el nombre de la finca"),
  departamento: textoOpcional,
  municipio: textoOpcional,
  vereda: textoOpcional,
  direccion: textoOpcional,
  area_cuadras: numeroOpcional,
  tenencia: z
    .string()
    .nullish()
    .transform((v) => (v === "propia" || v === "arrendada" ? v : null)),
  registro_ica: textoOpcional,
  empresa_compradora: textoOpcional,
  codigo_asociado: textoOpcional,
  tanque_numero: textoOpcional,
  ruta: textoOpcional,
  contrato_energia: textoOpcional,
  precio_litro: numeroOpcional,
  dias_destete: reglaOpcional,
  edad_servicio_meses: reglaOpcional,
  peso_servicio_kg: reglaOpcional,
  dias_descanso_objetivo: reglaOpcional,
});

export async function guardarFinca(id: string | null, _: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const { supabase, rol, organizacionId } = await obtenerSesion();
  if (soloLectura(rol)) return { mensaje: MENSAJE_SOLO_LECTURA };
  if (!ROLES_GESTORES.includes(rol)) return { mensaje: "Solo propietarios y administradores pueden editar fincas." };

  const resultado = esquemaFinca.safeParse(datosDe(formData));
  if (!resultado.success) return { errores: z.flattenError(resultado.error).fieldErrors, mensaje: "Revisa los campos marcados." };

  const consulta = id
    ? supabase.from("fincas").update(resultado.data).eq("id", id).select("id").single()
    : supabase
        .from("fincas")
        .insert({ ...resultado.data, organizacion_id: organizacionId })
        .select("id")
        .single();

  const { data, error } = await consulta;
  if (error || !data) return { mensaje: error ? mensajeErrorBD(error) : "No se encontró la finca." };

  revalidatePath("/", "layout");
  redirect(`/fincas/${data.id}`);
}

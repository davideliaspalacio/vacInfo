"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { obtenerSesion, ROLES_GESTORES } from "@/lib/sesion";
import { MENSAJE_SOLO_LECTURA, soloLectura } from "@/lib/permisos";
import { fecha } from "@/lib/formato";
import { datosDe, mensajeErrorBD } from "@/components/fincas/validacion";
import type { EstadoAccion } from "@/components/inventario/opciones";
import { ESTADOS_PROGRAMADO, TIPOS_PROGRAMABLES } from "@/components/calendario/programados";

const esquemaEvento = z.object({
  finca_id: z.uuid("Finca inválida"),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige la fecha"),
  hora: z
    .string()
    .nullish()
    .transform((v) => v?.trim() || null)
    .refine((v) => v === null || /^\d{2}:\d{2}(:\d{2})?$/.test(v), "Hora inválida"),
  tipo: z.enum(TIPOS_PROGRAMABLES, { error: "Elige el tipo de evento" }),
  titulo: z.string().trim().min(1, "Escribe un título").max(120, "Título muy largo"),
  animal_id: z
    .string()
    .nullish()
    .transform((v) => v || null)
    .pipe(z.uuid("Animal inválido").nullable()),
  descripcion: z
    .string()
    .nullish()
    .transform((v) => v?.trim() || null)
    .refine((v) => v === null || v.length <= 1000, "La descripción es muy larga (máximo 1.000 caracteres)"),
  recordar_dias: z.coerce.number({ error: "Escribe un número" }).int("Escribe un número entero").min(0, "Mínimo 0").max(60, "Máximo 60 días"),
});

export async function programarEvento(_: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  const { supabase, rol, fincas } = await obtenerSesion();
  if (soloLectura(rol)) return { error: MENSAJE_SOLO_LECTURA };

  const resultado = esquemaEvento.safeParse(datosDe(formData));
  if (!resultado.success) return { error: resultado.error.issues[0]?.message ?? "Revisa el formulario." };
  const datos = resultado.data;
  if (!fincas.some((f) => f.id === datos.finca_id)) return { error: "No tienes acceso a esa finca." };

  const { error } = await supabase.from("eventos_programados").insert(datos);
  if (error) return { error: mensajeErrorBD(error) };

  revalidatePath("/calendario");
  return { ok: true, mensaje: `«${datos.titulo}» quedó programado para el ${fecha(datos.fecha, true)}.` };
}

/** Solo se vuelve a una ruta del calendario. */
const destino = (v: FormDataEntryValue | null) => (typeof v === "string" && v.startsWith("/calendario") ? v : "/calendario");

export async function cambiarEstadoEvento(formData: FormData) {
  const { supabase, rol } = await obtenerSesion();
  const datos = z
    .object({ id: z.uuid(), estado: z.enum(ESTADOS_PROGRAMADO) })
    .safeParse({ id: formData.get("id"), estado: formData.get("estado") });

  if (datos.success && !soloLectura(rol)) {
    await supabase.from("eventos_programados").update({ estado: datos.data.estado }).eq("id", datos.data.id);
    revalidatePath("/calendario");
  }
  redirect(destino(formData.get("volver")));
}

export async function eliminarEvento(formData: FormData) {
  const { supabase, rol } = await obtenerSesion();
  const id = z.uuid().safeParse(formData.get("id"));

  if (id.success && ROLES_GESTORES.includes(rol)) {
    await supabase.from("eventos_programados").delete().eq("id", id.data);
    revalidatePath("/calendario");
  }
  redirect(destino(formData.get("volver")));
}

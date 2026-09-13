"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenerSesion, ROLES_GESTORES } from "@/lib/sesion";

export type EstadoMensaje = { ok?: boolean; error?: string };

const esquemaMensaje = z.object({
  destinatario: z.union([z.literal(""), z.string().uuid()]),
  texto: z.string().trim().min(1, "Escribe el mensaje.").max(2000, "El mensaje es muy largo (máximo 2.000 caracteres)."),
});

export async function enviarMensaje(_: EstadoMensaje, formData: FormData): Promise<EstadoMensaje> {
  const datos = esquemaMensaje.safeParse({
    destinatario: formData.get("destinatario") ?? "",
    texto: formData.get("texto") ?? "",
  });
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa el formulario." };

  const { supabase, user, organizacionId } = await obtenerSesion();
  const { destinatario, texto } = datos.data;

  if (destinatario) {
    const { data: miembro } = await supabase
      .from("miembros")
      .select("usuario_id")
      .eq("organizacion_id", organizacionId)
      .eq("usuario_id", destinatario)
      .maybeSingle();
    if (!miembro) return { error: "El destinatario no pertenece a tu organización." };
  }

  const { error } = await supabase.from("mensajes").insert({
    organizacion_id: organizacionId,
    remitente_id: user.id,
    destinatario_id: destinatario || null,
    texto,
  });
  if (error) return { error: "No se pudo enviar el mensaje. Intenta de nuevo." };

  revalidatePath("/mensajes");
  return { ok: true };
}

const esquemaEstado = z.object({
  id: z.string().uuid(),
  estado: z.enum(["leido", "resuelto"]),
});

export async function cambiarEstadoComentario(formData: FormData) {
  const datos = esquemaEstado.safeParse({ id: formData.get("id"), estado: formData.get("estado") });
  if (!datos.success) return;

  const { supabase, rol } = await obtenerSesion();
  if (!ROLES_GESTORES.includes(rol)) return;

  await supabase.from("comentarios").update({ estado: datos.data.estado }).eq("id", datos.data.id);
  revalidatePath("/mensajes");
}

export async function marcarMensajeLeido(formData: FormData) {
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;

  const { supabase, user } = await obtenerSesion();
  await supabase.from("mensajes").update({ leido: true }).eq("id", id.data).eq("destinatario_id", user.id);
  revalidatePath("/mensajes");
}

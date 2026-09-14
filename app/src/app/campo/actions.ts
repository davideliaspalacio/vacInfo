"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { obtenerSesion } from "@/lib/sesion";

// Los registros de animales y de la finca se guardan en el teléfono y se envían por /api/campo/sincronizar.

const limpiar = (v: unknown) => (typeof v === "string" ? (v.trim() === "" ? undefined : v.trim()) : v);
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

const esquemaComentario = z.object({
  finca_id: z.preprocess(limpiar, uuid.optional()),
  mensaje: z.preprocess(limpiar, z.string().min(1).max(2000)),
  urgencia: z.enum(["baja", "media", "alta"]),
});

const VOLVER = "/campo/comentario";
const volverCon = (parametros: Record<string, string>) => `${VOLVER}?${new URLSearchParams(parametros)}`;

export async function enviarComentario(formData: FormData) {
  const { organizacionId } = await obtenerSesion();

  const leido = esquemaComentario.safeParse(Object.fromEntries(formData));
  if (!leido.success) redirect(volverCon({ error: "Escribe el mensaje y elige la urgencia." }));

  const supabase = await createClient();
  const { error } = await supabase.from("comentarios").insert({ ...leido.data, organizacion_id: organizacionId });
  if (error) {
    const permiso = error.code === "42501" || /row-level security/i.test(error.message);
    redirect(volverCon({ error: permiso ? "No tienes permiso para enviar comentarios." : `No se pudo enviar: ${error.message}` }));
  }

  revalidatePath("/", "layout");
  redirect(volverCon({ ok: "Tu comentario llegó al administrador" }));
}

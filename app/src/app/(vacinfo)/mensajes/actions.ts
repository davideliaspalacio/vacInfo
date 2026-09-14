"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenerSesion, ROLES_GESTORES } from "@/lib/sesion";
import { MENSAJE_SOLO_LECTURA, soloLectura } from "@/lib/permisos";
import { claveAlerta, visibleDesde } from "./alertas";

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

  const { supabase, user, organizacionId, rol } = await obtenerSesion();
  if (soloLectura(rol)) return { error: MENSAJE_SOLO_LECTURA };
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

// Descartar notificaciones: preferencia personal de cada usuario (también del consultor, porque no
// cambia datos de la finca). La clave se vuelve a calcular aquí; no se confía en la del navegador.
const esquemaAlerta = z.object({
  finca_id: z.string().uuid(),
  tipo: z.string().min(1).max(40),
  animal_id: z.string().uuid().nullable(),
  nombre: z.string().max(300),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function descartarAlertas(formData: FormData) {
  let crudo: unknown;
  try {
    crudo = JSON.parse(String(formData.get("alertas") ?? "[]"));
  } catch {
    return;
  }
  const datos = z.array(esquemaAlerta).min(1).max(500).safeParse(crudo);
  if (!datos.success) return;

  const { supabase, user, fincas } = await obtenerSesion();
  const permitidas = new Set(fincas.map((f) => f.id));
  const filas = new Map(
    datos.data
      .filter((a) => permitidas.has(a.finca_id))
      .map((a) => {
        const fila = {
          usuario_id: user.id,
          finca_id: a.finca_id,
          clave: claveAlerta(a),
          fecha_alerta: a.fecha,
          visible_desde: visibleDesde(a.tipo),
          descartada_en: new Date().toISOString(),
        };
        return [`${fila.finca_id}|${fila.clave}`, fila] as const;
      }),
  );
  if (filas.size === 0) return;

  await supabase.from("alertas_descartadas").upsert([...filas.values()], { onConflict: "usuario_id,finca_id,clave" });
  revalidatePath("/mensajes");
  revalidatePath("/");
}

export async function restaurarAlerta(formData: FormData) {
  const datos = z
    .object({ finca_id: z.string().uuid(), clave: z.string().min(3).max(500) })
    .safeParse({ finca_id: formData.get("finca_id"), clave: formData.get("clave") });
  if (!datos.success) return;

  const { supabase, user } = await obtenerSesion();
  await supabase.from("alertas_descartadas").delete().eq("usuario_id", user.id).eq("finca_id", datos.data.finca_id).eq("clave", datos.data.clave);
  revalidatePath("/mensajes");
  revalidatePath("/");
}

export async function marcarMensajeLeido(formData: FormData) {
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;

  const { supabase, user } = await obtenerSesion();
  await supabase.from("mensajes").update({ leido: true }).eq("id", id.data).eq("destinatario_id", user.id);
  revalidatePath("/mensajes");
}

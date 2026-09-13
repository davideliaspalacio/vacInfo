"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { obtenerSesion, ROLES_GESTORES, type Sesion } from "@/lib/sesion";
import { ROLES, ETIQUETA_ROL } from "@/components/equipo/roles";
import { datosCodigo, origenActual, textoVence } from "@/components/equipo/enlace";
import { datosDe, mensajeErrorBD } from "@/components/fincas/validacion";

export type ResultadoEquipo = { error?: string };

export type EstadoInvitacion = {
  error?: string;
  errores?: Record<string, string[] | undefined>;
  creada?: { codigo: string; enlace: string; svg: string; detalle: string };
};

const SIN_PERMISO = "Solo propietarios y administradores pueden gestionar el equipo.";

async function sesionGestora() {
  const sesion = await obtenerSesion();
  return ROLES_GESTORES.includes(sesion.rol) ? sesion : null;
}

async function miembroDe(sesion: Sesion, usuarioId: string) {
  const { data } = await sesion.supabase
    .from("miembros")
    .select("rol, fincas")
    .eq("organizacion_id", sesion.organizacionId)
    .eq("usuario_id", usuarioId)
    .maybeSingle();
  return data;
}

async function cuantosPropietarios(sesion: Sesion) {
  const { count } = await sesion.supabase
    .from("miembros")
    .select("usuario_id", { count: "exact", head: true })
    .eq("organizacion_id", sesion.organizacionId)
    .eq("rol", "propietario");
  return count ?? 0;
}

export async function cambiarRol(usuarioId: string, rolNuevo: string): Promise<ResultadoEquipo> {
  const sesion = await sesionGestora();
  if (!sesion) return { error: SIN_PERMISO };
  const datos = z.object({ usuarioId: z.uuid(), rol: z.enum(ROLES as [string, ...string[]]) }).safeParse({ usuarioId, rol: rolNuevo });
  if (!datos.success) return { error: "Datos inválidos." };
  const { rol } = datos.data;

  const actual = await miembroDe(sesion, usuarioId);
  if (!actual) return { error: "Esa persona ya no está en el equipo." };
  if (actual.rol === rol) return {};
  if (sesion.rol !== "propietario" && (actual.rol === "propietario" || rol === "propietario")) {
    return { error: "Solo un propietario puede nombrar o cambiar propietarios." };
  }
  if (actual.rol === "propietario" && (await cuantosPropietarios(sesion)) <= 1) {
    return { error: "La empresa necesita al menos un propietario. Nombra otro antes de cambiar este rol." };
  }

  const { error } = await sesion.supabase
    .from("miembros")
    .update(rol === "propietario" ? { rol, fincas: null } : { rol: rol as (typeof ROLES)[number] })
    .eq("organizacion_id", sesion.organizacionId)
    .eq("usuario_id", usuarioId);
  if (error) return { error: mensajeErrorBD(error) };

  revalidatePath("/equipo");
  return {};
}

export async function limitarFincas(usuarioId: string, fincas: string[] | null): Promise<ResultadoEquipo> {
  const sesion = await sesionGestora();
  if (!sesion) return { error: SIN_PERMISO };
  const datos = z.object({ usuarioId: z.uuid(), fincas: z.array(z.uuid()).max(500).nullable() }).safeParse({ usuarioId, fincas });
  if (!datos.success) return { error: "Datos inválidos." };
  const lista = datos.data.fincas ? [...new Set(datos.data.fincas)] : null;

  const actual = await miembroDe(sesion, usuarioId);
  if (!actual) return { error: "Esa persona ya no está en el equipo." };
  if (actual.rol === "propietario" && lista) return { error: "Los propietarios siempre tienen acceso a todas las fincas." };
  if (lista && lista.length === 0) return { error: "Elige al menos una finca o marca «Todas las fincas»." };

  if (lista) {
    const { data } = await sesion.supabase.from("fincas").select("id").eq("organizacion_id", sesion.organizacionId).in("id", lista);
    if ((data?.length ?? 0) !== lista.length) return { error: "Alguna de las fincas elegidas no pertenece a la empresa." };
  }

  const { error } = await sesion.supabase
    .from("miembros")
    .update({ fincas: lista })
    .eq("organizacion_id", sesion.organizacionId)
    .eq("usuario_id", usuarioId);
  if (error) return { error: mensajeErrorBD(error) };

  revalidatePath("/equipo");
  return {};
}

export async function quitarMiembro(usuarioId: string): Promise<ResultadoEquipo> {
  const sesion = await sesionGestora();
  if (!sesion) return { error: SIN_PERMISO };
  if (!z.uuid().safeParse(usuarioId).success) return { error: "Datos inválidos." };

  const actual = await miembroDe(sesion, usuarioId);
  if (!actual) return { error: "Esa persona ya no está en el equipo." };
  if (actual.rol === "propietario") {
    if (sesion.rol !== "propietario") return { error: "Solo un propietario puede quitar a otro propietario." };
    if ((await cuantosPropietarios(sesion)) <= 1) return { error: "No puedes quitar al único propietario de la empresa." };
  }

  const { error } = await sesion.supabase
    .from("miembros")
    .delete()
    .eq("organizacion_id", sesion.organizacionId)
    .eq("usuario_id", usuarioId);
  if (error) return { error: mensajeErrorBD(error) };

  if (usuarioId === sesion.user.id) {
    revalidatePath("/", "layout");
    redirect("/registro/empresa");
  }
  revalidatePath("/equipo");
  return {};
}

const esquemaInvitacion = z.object({
  rol: z.enum(["administrador", "mayordomo", "trabajador", "veterinario", "consultor"], { error: "Elige un rol" }),
  finca_id: z
    .string()
    .optional()
    .transform((v) => v || null)
    .pipe(z.uuid("Finca inválida").nullable()),
  usos_max: z.coerce.number({ error: "Escribe un número" }).int("Escribe un número entero").min(1, "Mínimo 1").max(100, "Máximo 100"),
  dias: z.coerce.number({ error: "Escribe un número" }).int("Escribe un número entero").min(1, "Mínimo 1 día").max(90, "Máximo 90 días"),
});

export async function crearInvitacion(_: EstadoInvitacion, formData: FormData): Promise<EstadoInvitacion> {
  const sesion = await sesionGestora();
  if (!sesion) return { error: SIN_PERMISO };

  const resultado = esquemaInvitacion.safeParse(datosDe(formData));
  if (!resultado.success) return { errores: z.flattenError(resultado.error).fieldErrors, error: "Revisa los campos marcados." };
  const { rol, finca_id, usos_max, dias } = resultado.data;

  const finca = finca_id ? sesion.fincas.find((f) => f.id === finca_id) : null;
  if (finca_id && !finca) return { error: "Esa finca no pertenece a la empresa." };

  const expira_en = new Date(Date.now() + dias * 86_400_000).toISOString();
  let creada: { codigo: string; expira_en: string } | null = null;
  for (let intento = 0; intento < 3 && !creada; intento++) {
    const { data, error } = await sesion.supabase
      .from("invitaciones")
      .insert({ organizacion_id: sesion.organizacionId, rol, finca_id, usos_max, expira_en })
      .select("codigo, expira_en")
      .single();
    if (data) creada = data;
    else if (error?.code !== "23505") return { error: error ? mensajeErrorBD(error) : "No se pudo crear la invitación." };
  }
  if (!creada) return { error: "No se pudo generar un código único. Intenta de nuevo." };

  revalidatePath("/equipo");
  const detalle = `${ETIQUETA_ROL[rol]} · ${finca?.nombre ?? "Todas las fincas"} · hasta ${usos_max} ${usos_max === 1 ? "persona" : "personas"} · vence ${textoVence(creada.expira_en)}`;
  return { creada: { ...(await datosCodigo(creada.codigo, await origenActual())), detalle } };
}

export async function desactivarInvitacion(id: string): Promise<ResultadoEquipo> {
  const sesion = await sesionGestora();
  if (!sesion) return { error: SIN_PERMISO };
  if (!z.uuid().safeParse(id).success) return { error: "Datos inválidos." };

  const { error } = await sesion.supabase
    .from("invitaciones")
    .update({ activa: false })
    .eq("id", id)
    .eq("organizacion_id", sesion.organizacionId);
  if (error) return { error: mensajeErrorBD(error) };

  revalidatePath("/equipo");
  return {};
}

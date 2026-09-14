"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MENSAJE_SOLO_LECTURA, soloLectura } from "@/lib/permisos";
import { obtenerSesion, ROLES_GESTORES } from "@/lib/sesion";
import type { EstadoAccion } from "@/components/fincas/formulario-accion";
import { datosDe, numeroOpcional } from "@/components/fincas/validacion";
import { moverGrupo as mover, sacarGrupo as sacar, type ResultadoRotacion } from "@/components/potreros/rotacion";

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");
const grupo = z.string().trim().min(1, "Escribe el grupo").max(80);

function resultado({ error }: ResultadoRotacion, fincaId: string, ok: string): EstadoAccion {
  if (error) {
    if (error.code === "AVISO") return { error: error.message };
    if (error.code === "42501" || /row-level security/i.test(error.message)) return { error: "No tienes permiso para registrar en esta finca." };
    return { error: `No se pudo guardar: ${error.message}` };
  }
  revalidatePath(`/fincas/${fincaId}/potreros`);
  return { ok };
}

export async function moverGrupo(fincaId: string, _: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  const leido = z
    .object({
      grupo,
      potrero_id: z.string().regex(/^[0-9a-f-]{36}$/i, "Elige el potrero destino"),
      fecha,
      animales: numeroOpcional,
      observaciones: z.string().nullish(),
    })
    .safeParse(datosDe(formData));
  if (!leido.success) return { error: leido.error.issues[0]?.message ?? "Revisa los datos." };

  const { supabase, rol } = await obtenerSesion();
  if (soloLectura(rol)) return { error: MENSAJE_SOLO_LECTURA };
  const d = leido.data;
  const r = await mover(supabase, {
    finca_id: fincaId,
    grupo: d.grupo,
    potrero_id: d.potrero_id,
    fecha: d.fecha,
    animales: d.animales == null ? undefined : Math.round(d.animales),
    observaciones: d.observaciones?.trim() || undefined,
  });
  return resultado(r, fincaId, `«${d.grupo}» movido`);
}

export async function sacarGrupo(fincaId: string, _: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  const leido = z.object({ grupo, fecha }).safeParse(datosDe(formData));
  if (!leido.success) return { error: leido.error.issues[0]?.message ?? "Revisa los datos." };

  const { supabase, rol } = await obtenerSesion();
  if (soloLectura(rol)) return { error: MENSAJE_SOLO_LECTURA };
  const r = await sacar(supabase, { finca_id: fincaId, ...leido.data });
  return resultado(r, fincaId, `«${leido.data.grupo}» salió del potrero`);
}

async function soloGestor() {
  const sesion = await obtenerSesion();
  return ROLES_GESTORES.includes(sesion.rol) ? sesion : null;
}

export async function guardarPotrero(fincaId: string, potreroId: string | null, _: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  const sesion = await soloGestor();
  if (!sesion) return { error: "Solo propietarios y administradores pueden administrar potreros." };

  const leido = z
    .object({
      numero: numeroOpcional.refine((v) => v != null && Number.isInteger(v) && v > 0, "Número de potrero inválido"),
      nombre: z
        .string()
        .nullish()
        .transform((v) => v?.trim() || null),
      area_cuadras: numeroOpcional,
    })
    .safeParse(datosDe(formData));
  if (!leido.success) return { error: leido.error.issues[0]?.message ?? "Revisa los datos." };

  const datos = { ...leido.data, numero: leido.data.numero! };
  const { error } = potreroId
    ? await sesion.supabase.from("potreros").update(datos).eq("id", potreroId).eq("finca_id", fincaId)
    : await sesion.supabase.from("potreros").insert({ ...datos, finca_id: fincaId });
  if (error) return { error: error.code === "23505" ? `Ya existe el potrero ${datos.numero}.` : `No se pudo guardar: ${error.message}` };

  revalidatePath(`/fincas/${fincaId}/potreros`);
  return { ok: potreroId ? "Guardado" : `Potrero ${datos.numero} creado` };
}

export async function crearPotreros(fincaId: string, _: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  const sesion = await soloGestor();
  if (!sesion) return { error: "Solo propietarios y administradores pueden administrar potreros." };

  const total = Number(formData.get("total"));
  if (!Number.isInteger(total) || total < 1 || total > 300) return { error: "Escribe cuántos potreros tiene la finca (1 a 300)." };

  const filas = Array.from({ length: total }, (_, i) => ({ finca_id: fincaId, numero: i + 1 }));
  const { data, error } = await sesion.supabase
    .from("potreros")
    .upsert(filas, { onConflict: "finca_id,numero", ignoreDuplicates: true })
    .select("id");
  if (error) return { error: `No se pudo guardar: ${error.message}` };

  revalidatePath(`/fincas/${fincaId}/potreros`);
  return { ok: data?.length ? `${data.length} potreros creados` : "Ya existían todos" };
}

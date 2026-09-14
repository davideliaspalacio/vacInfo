"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MENSAJE_SOLO_LECTURA, soloLectura } from "@/lib/permisos";
import { obtenerSesion } from "@/lib/sesion";
import type { EstadoAccion } from "@/components/fincas/formulario-accion";
import { datosDe, numeroOpcional } from "@/components/fincas/validacion";

const uuid = z.string().regex(/^[0-9a-f-]{36}$/i, "Elige el animal");
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");

const esquemaPesaje = z.object({
  animal_id: uuid,
  fecha,
  peso_kg: numeroOpcional.refine((v) => v != null && v > 0, "Escribe el peso en kg"),
  altura_cm: numeroOpcional,
  condicion_corporal: numeroOpcional.refine((v) => v == null || (v >= 1 && v <= 5), "La condición corporal va de 1 a 5"),
  observaciones: z
    .string()
    .nullish()
    .transform((v) => v?.trim() || null),
});

async function animalDeFinca(fincaId: string, animalId: string) {
  const { supabase } = await obtenerSesion();
  const { data } = await supabase.from("animales").select("id, nombre").eq("id", animalId).eq("finca_id", fincaId).maybeSingle();
  return { supabase, animal: data };
}

async function esConsultor() {
  const { rol } = await obtenerSesion();
  return soloLectura(rol);
}

export async function registrarPesaje(fincaId: string, _: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  if (await esConsultor()) return { error: MENSAJE_SOLO_LECTURA };
  const leido = esquemaPesaje.safeParse(datosDe(formData));
  if (!leido.success) return { error: leido.error.issues[0]?.message ?? "Revisa los datos del pesaje." };

  const { supabase, animal } = await animalDeFinca(fincaId, leido.data.animal_id);
  if (!animal) return { error: "El animal no es de esta finca." };

  const { error } = await supabase.from("pesajes").upsert({ ...leido.data, peso_kg: leido.data.peso_kg! }, { onConflict: "animal_id,fecha" });
  if (error) {
    if (error.code === "42501" || /row-level security/i.test(error.message))
      return { error: "Ya hay un pesaje de ese día; solo un administrador puede corregirlo." };
    return { error: `No se pudo guardar: ${error.message}` };
  }

  revalidatePath(`/fincas/${fincaId}/levante`);
  revalidatePath(`/animales/${animal.id}`);
  return { ok: `Pesaje de ${animal.nombre} guardado` };
}

export async function registrarDestete(fincaId: string, _: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  if (await esConsultor()) return { error: MENSAJE_SOLO_LECTURA };
  const leido = z.object({ animal_id: uuid, fecha }).safeParse(datosDe(formData));
  if (!leido.success) return { error: leido.error.issues[0]?.message ?? "Revisa los datos del destete." };

  const { supabase, animal } = await animalDeFinca(fincaId, leido.data.animal_id);
  if (!animal) return { error: "El animal no es de esta finca." };

  const { error } = await supabase.rpc("registrar_destete", { p_animal: animal.id, p_fecha: leido.data.fecha });
  if (error) return { error: `No se pudo guardar: ${error.message}` };

  revalidatePath(`/fincas/${fincaId}`, "layout");
  revalidatePath(`/animales/${animal.id}`);
  return { ok: `Destete de ${animal.nombre} registrado` };
}

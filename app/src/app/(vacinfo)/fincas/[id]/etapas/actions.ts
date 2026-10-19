"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MENSAJE_SOLO_LECTURA, soloLectura } from "@/lib/permisos";
import { obtenerSesion, ROLES_GESTORES } from "@/lib/sesion";
import type { EstadoAccion } from "@/components/fincas/formulario-accion";

const uuid = z.string().regex(/^[0-9a-f-]{36}$/i);

/**
 * Animales sobre los que actúa el formulario: `solo` (el botón de una fila) manda sobre las
 * casillas, y `todos` quiere decir «toda la finca» (la base decide a cuáles les toca cambio).
 */
function pedido(formData: FormData) {
  const solo = formData.get("solo");
  if (typeof solo === "string" && solo) return { animales: [solo], uno: true, todos: false };
  if (formData.get("todos") === "1") return { animales: [], uno: false, todos: true };
  return { animales: formData.getAll("animales").filter((v): v is string => typeof v === "string"), uno: false, todos: false };
}

/** Un animal: «Se actualizó 1 animal»; varios: «Se actualizaron 7 animales». */
function contados(n: number) {
  return n === 1 ? "1 animal" : `${n} animales`;
}

async function gestorDeFinca(fincaId: string) {
  const sesion = await obtenerSesion();
  if (soloLectura(sesion.rol)) return { error: MENSAJE_SOLO_LECTURA } as const;
  if (!ROLES_GESTORES.includes(sesion.rol)) return { error: "Solo el propietario y el administrador pueden corregir etapas." } as const;
  const { data } = await sesion.supabase.from("fincas").select("id").eq("id", fincaId).maybeSingle();
  if (!data) return { error: "No tienes acceso a esta finca." } as const;
  return { sesion } as const;
}

function refrescar(fincaId: string, animales: string[]) {
  revalidatePath(`/fincas/${fincaId}/etapas`);
  revalidatePath(`/fincas/${fincaId}`);
  for (const a of animales) revalidatePath(`/animales/${a}`);
}

/** Aplica la regla de etapa (la de la base) a los animales elegidos o a toda la finca. */
export async function aplicarEtapas(fincaId: string, _: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  const permiso = await gestorDeFinca(fincaId);
  if ("error" in permiso) return permiso;

  const { animales, todos } = pedido(formData);
  if (!todos && !animales.length) return { error: "Marca al menos un animal." };
  if (!todos && !z.array(uuid).safeParse(animales).success) return { error: "Hay un animal mal identificado; recarga la pantalla." };

  const { data, error } = await permiso.sesion.supabase.rpc("aplicar_etapas_finca", {
    p_finca: fincaId,
    ...(todos ? {} : { p_animales: animales }),
  });
  if (error) return { error: `No se pudo aplicar: ${error.message}` };

  const n = data ?? 0;
  refrescar(fincaId, animales);
  return { ok: n ? `Se ${n === 1 ? "actualizó" : "actualizaron"} ${contados(n)}` : "No había nada que cambiar" };
}

/**
 * Baja a mano la etapa de los animales elegidos (la única excepción a «la etapa nunca baja»).
 * La base rechaza la baja que su propia regla desharía y deja el rastro con motivo «cambio manual».
 */
export async function bajarEtapas(fincaId: string, _: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  const permiso = await gestorDeFinca(fincaId);
  if ("error" in permiso) return permiso;

  const leido = z
    .object({ etapa: z.enum(["ternera", "novilla", "ternero", "novillo"]), animales: z.array(uuid).min(1, "Marca al menos un animal.") })
    .safeParse({ etapa: formData.get("etapa"), animales: pedido(formData).animales });
  if (!leido.success) return { error: leido.error.issues[0]?.message ?? "Revisa los animales marcados." };

  let hechos = 0;
  let fallo: string | undefined;
  for (const animal of leido.data.animales) {
    const { error } = await permiso.sesion.supabase.rpc("bajar_etapa_animal", { p_animal: animal, p_etapa: leido.data.etapa });
    if (error) fallo ??= error.message;
    else hechos += 1;
  }

  refrescar(fincaId, leido.data.animales);
  if (!hechos) return { error: `No se pudo bajar la etapa: ${fallo ?? "intenta de nuevo"}` };
  const aviso = fallo ? ` · ${contados(leido.data.animales.length - hechos)} sin cambiar: ${fallo}` : "";
  return { ok: `Se ${hechos === 1 ? "bajó" : "bajaron"} a ${leido.data.etapa} ${contados(hechos)}${aviso}` };
}

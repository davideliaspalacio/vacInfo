"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Json } from "@/lib/database.types";
import { MENSAJE_SOLO_LECTURA, soloLectura } from "@/lib/permisos";
import { obtenerSesion, ROLES_GESTORES } from "@/lib/sesion";
import {
  calcularItem,
  GRUPOS_COSTO,
  MODOS_COSTO,
  PERIODOS_COSTO,
  UNIDADES_COSTO,
  type ConteoAnimales,
  type ItemCosto,
  type ParametrosCostos,
} from "@/lib/finanzas";
import type { EstadoFormulario } from "@/components/fincas/campo";
import { mensajeErrorBD } from "@/components/fincas/validacion";
import { conteoCostosPeriodo } from "@/components/fincas/conteo-animales";

const valor = z.coerce.number({ error: "Número inválido" }).finite("Número inválido").min(0, "No puede ser negativo");

// Sin `animales`: la cantidad no se edita aquí. Zod descarta lo que llegue en esa llave y el
// servidor guarda el conteo real de la finca (fichas, partos, secados y bajas).
// Un ítem se escribe como valor al mes (datos de siempre) o como gasto por animal, y entonces
// hacen falta la cantidad, la unidad, el precio por unidad, el grupo de animales y si es por día o mes.
const esquemaItem = z
  .object({
    nombre: z.string().trim().min(1, "Hay un ítem de costo sin nombre"),
    mes: valor,
    caja: z.boolean().optional(),
    modo: z.enum(MODOS_COSTO, { error: "Forma de cálculo inválida" }).optional(),
    cantidad: valor.optional(),
    unidad: z.enum(UNIDADES_COSTO, { error: "Unidad inválida" }).optional(),
    precio_unitario: valor.optional(),
    grupo: z.enum(GRUPOS_COSTO, { error: "Grupo de animales inválido" }).optional(),
    periodo: z.enum(PERIODOS_COSTO, { error: "Indica si la cantidad es por día o por mes" }).optional(),
  })
  .superRefine((i, ctx) => {
    if (i.modo !== "por_animal") return;
    const falta = [
      i.cantidad === undefined && "la cantidad por animal",
      i.unidad === undefined && "la unidad",
      i.precio_unitario === undefined && "el precio por unidad",
      i.grupo === undefined && "el grupo de animales",
      i.periodo === undefined && "si es por día o por mes",
    ].filter((t): t is string => typeof t === "string");
    if (falta.length) ctx.addIssue({ code: "custom", message: `En "${i.nombre}" falta ${falta.join(", ")}.` });
  });

const esquemaParametros = z.object({
  precio_litro: valor,
  valorizacion_mensual_por_animal: valor,
  litros_dia: z.object({ venta: valor, terneras: valor, consumo_humano: valor }),
  costos: z.array(
    z.object({
      categoria: z.string().trim().min(1, "Categoría sin nombre"),
      items: z.array(esquemaItem),
    }),
  ),
}) satisfies z.ZodType<Omit<ParametrosCostos, "animales">>;

type ItemValidado = z.infer<typeof esquemaItem>;

/** Deja el ítem como se guarda: los mensuales con la forma de siempre y los por animal con `mes` ya calculado. */
function itemGuardado(i: ItemValidado, animales: ConteoAnimales): ItemCosto {
  if (i.modo !== "por_animal") {
    const { nombre, mes, caja } = i;
    return caja === false ? { nombre, mes, caja } : { nombre, mes };
  }
  const item: ItemCosto = {
    nombre: i.nombre,
    mes: 0,
    modo: "por_animal",
    cantidad: i.cantidad ?? 0,
    unidad: i.unidad ?? "unidad",
    precio_unitario: i.precio_unitario ?? 0,
    grupo: i.grupo ?? "todos",
    periodo: i.periodo ?? "mes",
    ...(i.caja === false ? { caja: false as const } : {}),
  };
  return { ...item, mes: calcularItem(item, animales).mes };
}

export async function guardarCostos(fincaId: string, periodo: string, _: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const { supabase, rol, user } = await obtenerSesion();
  if (soloLectura(rol)) return { mensaje: MENSAJE_SOLO_LECTURA };
  if (!ROLES_GESTORES.includes(rol)) return { mensaje: "Solo propietarios y administradores pueden cambiar el ingreso de costos." };
  if (!/^\d{4}-\d{2}-01$/.test(periodo)) return { mensaje: "Periodo inválido." };

  let crudo: unknown;
  try {
    crudo = JSON.parse(String(formData.get("datos") ?? ""));
  } catch {
    return { mensaje: "No se pudieron leer los costos." };
  }

  const resultado = esquemaParametros.safeParse(crudo);
  if (!resultado.success) return { mensaje: resultado.error.issues[0]?.message ?? "Revisa los valores." };

  const { animales } = await conteoCostosPeriodo(supabase, fincaId, periodo);

  const datos: ParametrosCostos = {
    precio_litro: resultado.data.precio_litro,
    valorizacion_mensual_por_animal: resultado.data.valorizacion_mensual_por_animal,
    animales,
    litros_dia: resultado.data.litros_dia,
    costos: resultado.data.costos.map((c) => ({
      categoria: c.categoria,
      items: c.items.map((i) => itemGuardado(i, animales)),
    })),
  };

  const { error } = await supabase.from("parametros_costos").upsert(
    {
      finca_id: fincaId,
      periodo,
      datos: datos as unknown as Json,
      registrado_por: user.id,
      registrado_en: new Date().toISOString(),
    },
    { onConflict: "finca_id,periodo" },
  );
  if (error) return { mensaje: mensajeErrorBD(error) };

  revalidatePath(`/fincas/${fincaId}/costos`);
  revalidatePath("/informes", "layout");
  redirect(`/fincas/${fincaId}/costos?periodo=${periodo}&guardado=1`);
}

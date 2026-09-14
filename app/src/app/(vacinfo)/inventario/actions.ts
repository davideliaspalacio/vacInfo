"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenerSesion, ROLES_GESTORES } from "@/lib/sesion";
import { MENSAJE_SOLO_LECTURA, soloLectura } from "@/lib/permisos";
import { hoyISO } from "@/lib/formato";
import { datosDe, mensajeErrorBD } from "@/components/fincas/validacion";
import { CATEGORIAS_INSUMO, ETIQUETA_FUENTE, FUENTES_CONSUMO, type EstadoAccion } from "@/components/inventario/opciones";
import { GRUPOS_CONSUMO, MODOS_CONSUMO, PERIODOS_CONSUMO } from "@/components/inventario/consumo";

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

const numero = (mensaje: string) =>
  z
    .string()
    .trim()
    .transform((v) => Number(v.replace(",", ".")))
    .refine((v) => Number.isFinite(v) && v > 0, mensaje);

const numeroOpcional = z
  .string()
  .nullish()
  .transform((v) => (v?.trim() ? Number(v.trim().replace(",", ".")) : null))
  .refine((v) => v === null || (Number.isFinite(v) && v >= 0), "Escribe un número válido");

const textoOpcional = z
  .string()
  .nullish()
  .transform((v) => v?.trim() || null);

const esquemaMovimiento = z.object({
  finca_id: z.string().uuid("Finca inválida"),
  tipo: z.enum(["ingreso", "salida"], { error: "Elige ingreso o salida" }),
  producto: z.string().trim().min(1, "Escribe el producto").max(120, "Nombre muy largo"),
  cantidad: numero("La cantidad debe ser mayor que cero"),
  fecha: z.string().regex(FECHA_ISO, "Fecha inválida"),
  hora: z
    .string()
    .nullish()
    .transform((v) => v?.trim() || null)
    .refine((v) => v === null || /^\d{2}:\d{2}(:\d{2})?$/.test(v), "Hora inválida"),
  entrega: textoOpcional,
  recibe: textoOpcional,
});

export async function registrarMovimiento(_: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  const resultado = esquemaMovimiento.safeParse(datosDe(formData));
  if (!resultado.success) return { error: resultado.error.issues[0]?.message ?? "Revisa el formulario." };

  const { supabase, fincas, organizacionId, rol } = await obtenerSesion();
  if (soloLectura(rol)) return { error: MENSAJE_SOLO_LECTURA };
  const datos = resultado.data;
  if (!fincas.some((f) => f.id === datos.finca_id)) return { error: "No tienes acceso a esa finca." };

  const { data: catalogo } = await supabase.from("insumos").select("id, nombre").eq("organizacion_id", organizacionId);
  const insumo = catalogo?.find((i) => i.nombre.toLowerCase() === datos.producto.toLowerCase());

  const { error } = await supabase.from("movimientos_insumos").insert({
    ...datos,
    producto: insumo?.nombre ?? datos.producto,
    insumo_id: insumo?.id ?? null,
  });
  if (error) return { error: mensajeErrorBD(error) };

  revalidatePath("/inventario");
  return {
    ok: true,
    mensaje: insumo
      ? `Movimiento de ${insumo.nombre} registrado.`
      : `Movimiento registrado. "${datos.producto}" no está en el catálogo: se lleva su saldo por nombre.`,
  };
}

const esquemaInsumo = z.object({
  id: z.union([z.literal(""), z.string().uuid()]).optional(),
  nombre: z.string().trim().min(1, "Escribe el nombre del insumo").max(120, "Nombre muy largo"),
  categoria: z.enum(CATEGORIAS_INSUMO, { error: "Elige una categoría" }),
  unidad: z.string().trim().min(1, "Escribe la unidad (bulto, litro…)").max(30, "Unidad muy larga"),
  contenido: numeroOpcional,
  precio: numeroOpcional,
  stock_minimo: numeroOpcional,
  consumo_diario_fuente: z.union([z.literal(""), z.enum(FUENTES_CONSUMO)]).optional(),
  reemplazar_fuente: z.string().optional(),
});

export async function guardarInsumo(_: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  const resultado = esquemaInsumo.safeParse(datosDe(formData));
  if (!resultado.success) return { error: resultado.error.issues[0]?.message ?? "Revisa el formulario." };

  const { supabase, rol, organizacionId } = await obtenerSesion();
  if (!ROLES_GESTORES.includes(rol)) return { error: "Solo propietarios y administradores pueden cambiar el catálogo." };

  const { id, reemplazar_fuente, consumo_diario_fuente, ...campos } = resultado.data;
  const fuente = consumo_diario_fuente || null;

  if (fuente && !campos.contenido) {
    return { error: "Para descontar del consumo diario hay que indicar cuántos kg trae cada unidad (contenido)." };
  }

  if (fuente) {
    const { data: otros } = await supabase
      .from("insumos")
      .select("id, nombre")
      .eq("organizacion_id", organizacionId)
      .eq("consumo_diario_fuente", fuente);
    const otro = otros?.find((o) => o.id !== id);
    if (otro) {
      if (reemplazar_fuente !== "1") {
        return { error: `El consumo diario de ${ETIQUETA_FUENTE[fuente].toLowerCase()} ya se descuenta de "${otro.nombre}". Marca la casilla para pasarlo a este insumo.` };
      }
      const { error } = await supabase.from("insumos").update({ consumo_diario_fuente: null }).eq("id", otro.id);
      if (error) return { error: mensajeErrorBD(error) };
    }
  }

  const fila = { ...campos, consumo_diario_fuente: fuente };
  const { error } = id
    ? await supabase.from("insumos").update(fila).eq("id", id).eq("organizacion_id", organizacionId)
    : await supabase.from("insumos").insert({ ...fila, organizacion_id: organizacionId });
  if (error) return { error: mensajeErrorBD(error, "Ya existe un insumo con ese nombre.") };

  revalidatePath("/inventario");
  return { ok: true, mensaje: id ? `${campos.nombre} actualizado.` : `${campos.nombre} agregado al catálogo.` };
}

// ─────────────── Consumo automático ───────────────

const esquemaConsumo = z
  .object({
    id: z.union([z.literal(""), z.uuid()]).optional(),
    finca_id: z.uuid("Finca inválida"),
    insumo_id: z.uuid("Elige el insumo"),
    modo: z.enum(MODOS_CONSUMO, { error: "Elige cómo se calcula" }),
    cantidad: numero("La cantidad debe ser mayor que cero"),
    medida: z.enum(["unidad", "kg"]).default("unidad"),
    periodo: z.enum(PERIODOS_CONSUMO, { error: "Elige el periodo" }),
    grupo: z.union([z.literal(""), z.enum(GRUPOS_CONSUMO)]).nullish(),
    desde: z.string().regex(FECHA_ISO, "Elige desde cuándo aplica"),
    hasta: z
      .string()
      .nullish()
      .transform((v) => v?.trim() || null)
      .refine((v) => v === null || FECHA_ISO.test(v), "Fecha final inválida"),
    notas: textoOpcional,
  })
  .refine((d) => d.modo === "fijo" || !!d.grupo, { message: "Elige el grupo de animales", path: ["grupo"] })
  .refine((d) => !d.hasta || d.hasta >= d.desde, { message: "La fecha final no puede ser anterior al inicio", path: ["hasta"] });

export async function guardarConsumoProgramado(_: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  const { supabase, rol, fincas, organizacionId } = await obtenerSesion();
  if (soloLectura(rol)) return { error: MENSAJE_SOLO_LECTURA };

  const resultado = esquemaConsumo.safeParse(datosDe(formData));
  if (!resultado.success) return { error: resultado.error.issues[0]?.message ?? "Revisa el formulario." };
  const { id, medida, grupo, ...campos } = resultado.data;
  if (!fincas.some((f) => f.id === campos.finca_id)) return { error: "No tienes acceso a esa finca." };

  const { data: insumo } = await supabase
    .from("insumos")
    .select("nombre, unidad, contenido")
    .eq("id", campos.insumo_id)
    .eq("organizacion_id", organizacionId)
    .maybeSingle();
  if (!insumo) return { error: "Ese insumo no está en el catálogo." };
  if (medida === "kg" && !insumo.contenido) {
    return { error: `Para usar kg, indica en el catálogo cuántos kg trae cada ${insumo.unidad} de ${insumo.nombre}.` };
  }

  const fila = { ...campos, en_kg: medida === "kg", grupo: campos.modo === "por_animal" ? grupo || null : null };
  const { error } = id
    ? await supabase.from("consumos_programados").update(fila).eq("id", id).eq("finca_id", campos.finca_id)
    : await supabase.from("consumos_programados").insert(fila);
  if (error) return { error: mensajeErrorBD(error) };

  revalidatePath("/inventario");
  return { ok: true, mensaje: `Consumo automático de ${insumo.nombre} ${id ? "actualizado" : "creado"}.` };
}

export type AccionRegla = "terminar" | "anular" | "reactivar" | "eliminar";

export async function cambiarConsumoProgramado(id: string, accion: AccionRegla): Promise<{ error?: string }> {
  const { supabase, rol } = await obtenerSesion();
  if (soloLectura(rol)) return { error: MENSAJE_SOLO_LECTURA };
  if (!z.uuid().safeParse(id).success) return { error: "Datos inválidos." };

  const tabla = supabase.from("consumos_programados");
  let consulta;
  if (accion === "eliminar") {
    if (!ROLES_GESTORES.includes(rol)) return { error: "Solo propietarios y administradores pueden eliminar reglas." };
    consulta = tabla.delete().eq("id", id).select("id");
  } else if (accion === "terminar") {
    const hoy = hoyISO();
    const { data: regla } = await supabase.from("consumos_programados").select("desde").eq("id", id).maybeSingle();
    if (regla && regla.desde > hoy) return { error: "La regla todavía no empieza: usa «Desactivar» o edita sus fechas." };
    consulta = tabla.update({ hasta: hoy }).eq("id", id).select("id");
  } else {
    consulta = tabla.update({ activo: accion === "reactivar" }).eq("id", id).select("id");
  }

  const { data, error } = await consulta;
  if (error) return { error: mensajeErrorBD(error) };
  if (!data?.length) return { error: "No se pudo cambiar la regla." };

  revalidatePath("/inventario");
  return {};
}

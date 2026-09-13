"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenerSesion, ROLES_GESTORES } from "@/lib/sesion";
import { datosDe, mensajeErrorBD } from "@/components/fincas/validacion";
import { CATEGORIAS_INSUMO, ETIQUETA_FUENTE, FUENTES_CONSUMO, type EstadoAccion } from "@/components/inventario/opciones";

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
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
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

  const { supabase, fincas, organizacionId } = await obtenerSesion();
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

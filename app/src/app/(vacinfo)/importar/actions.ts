"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenerSesion, ROLES_GESTORES } from "@/lib/sesion";
import { leerLibro } from "@/lib/importador/leer";
import { combinarHojas } from "@/lib/importador/combinar";
import { aplicarPlan, previsualizar, type ResultadoImportacion, type VistaPrevia } from "@/lib/importador/aplicar";
import { REGLAS, limitar, mensajeLimite, type Regla } from "@/lib/limites";

const MAX_BYTES = 15 * 1024 * 1024;

const esquema = z.object({
  finca: z.guid("Elige una finca"),
  archivo: z
    .instanceof(File, { message: "Sube el archivo de Excel" })
    .refine((f) => f.size > 0, "El archivo está vacío")
    .refine((f) => f.size <= MAX_BYTES, "El archivo supera los 15 MB")
    .refine((f) => /\.xlsx$/i.test(f.name), "El archivo debe ser .xlsx"),
});

export type Respuesta<T> = { ok: true; datos: T } | { ok: false; mensaje: string };

async function prepararPlan(formData: FormData, regla: Regla) {
  const sesion = await obtenerSesion();
  if (!ROLES_GESTORES.includes(sesion.rol)) throw new Error("Solo propietarios y administradores pueden importar planillas.");

  // Leer un libro de Excel es la operación más pesada de la app.
  const limite = await limitar(sesion.supabase, sesion.user.id, regla);
  if (!limite.permitido) throw new Error(mensajeLimite(limite.reintentarEn));

  const r = esquema.safeParse({ finca: formData.get("finca"), archivo: formData.get("archivo") });
  if (!r.success) throw new Error(r.error.issues[0]?.message ?? "Datos inválidos");
  if (!sesion.fincas.some((f) => f.id === r.data.finca)) throw new Error("No tienes acceso a esa finca.");

  let libro;
  try {
    libro = await leerLibro(await r.data.archivo.arrayBuffer());
  } catch {
    throw new Error("No se pudo leer el archivo. Verifica que sea un libro de Excel (.xlsx).");
  }
  if (!libro.hojas.length) throw new Error("El archivo no tiene planillas quincenales (hojas con nombre de fecha como 30426).");

  return { sesion, fincaId: r.data.finca, archivo: r.data.archivo.name, plan: combinarHojas(libro) };
}

const mensaje = (e: unknown) => (e instanceof Error ? e.message : "Ocurrió un error inesperado.");

export async function analizarExcel(formData: FormData): Promise<Respuesta<VistaPrevia>> {
  try {
    const { sesion, fincaId, plan } = await prepararPlan(formData, REGLAS.analizarExcel);
    return { ok: true, datos: await previsualizar(sesion.supabase, fincaId, plan) };
  } catch (e) {
    return { ok: false, mensaje: mensaje(e) };
  }
}

export async function importarExcel(formData: FormData): Promise<Respuesta<ResultadoImportacion>> {
  try {
    const { sesion, fincaId, archivo, plan } = await prepararPlan(formData, REGLAS.importarExcel);
    const resultado = await aplicarPlan(sesion.supabase, fincaId, plan, archivo);
    revalidatePath("/", "layout");
    return { ok: true, datos: resultado };
  } catch (e) {
    return { ok: false, mensaje: mensaje(e) };
  }
}

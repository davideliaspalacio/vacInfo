import { z } from "zod";

/** Texto opcional de formulario: vacío → null. */
export const textoOpcional = z
  .string()
  .nullish()
  .transform((v) => v?.trim() || null);

export const textoRequerido = (mensaje: string) => z.string({ error: mensaje }).trim().min(1, mensaje);

export const numeroOpcional = z
  .string()
  .nullish()
  .transform((v) => (v?.trim() ? Number(v.trim().replace(",", ".")) : null))
  .refine((v) => v === null || (Number.isFinite(v) && v >= 0), "Escribe un número válido");

export const fechaOpcional = z
  .string()
  .nullish()
  .transform((v) => v?.trim() || null)
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Fecha inválida");

export function datosDe(formData: FormData) {
  return Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
}

export function mensajeErrorBD(error: { code?: string; message: string }, duplicado = "Ya existe un registro con ese código.") {
  if (error.code === "23505") return duplicado;
  if (error.code === "42501") return "No tienes permiso para hacer este cambio.";
  return `No se pudo guardar: ${error.message}`;
}

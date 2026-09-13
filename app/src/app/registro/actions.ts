"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { EstadoFormulario } from "@/components/fincas/campo";
import { datosDe, mensajeErrorBD, numeroOpcional, textoOpcional, textoRequerido } from "@/components/fincas/validacion";
import { ROLES_GESTORES, type Rol } from "@/components/equipo/roles";
import { estadoRegistro, mensajeErrorCuenta } from "@/components/registro/servidor";

const esquemaCuenta = z
  .object({
    nombre: textoRequerido("Escribe tu nombre completo"),
    correo: z.string({ error: "Escribe tu correo" }).trim().toLowerCase().pipe(z.email("Escribe un correo válido")),
    password: z.string().min(8, "Usa al menos 8 caracteres"),
    confirmar: z.string(),
  })
  .refine((d) => d.password === d.confirmar, { path: ["confirmar"], message: "Las contraseñas no coinciden" });

export async function crearCuenta(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const resultado = esquemaCuenta.safeParse(datosDe(formData));
  if (!resultado.success) return { errores: z.flattenError(resultado.error).fieldErrors, mensaje: "Revisa los campos marcados." };
  const { nombre, correo, password } = resultado.data;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email: correo, password, options: { data: { nombre_completo: nombre } } });
  if (error) return { mensaje: mensajeErrorCuenta(error, "correo") };
  if (!data.session) return { mensaje: "Te enviamos un correo para confirmar la cuenta. Confírmala e ingresa para continuar." };

  redirect("/registro/empresa");
}

const esquemaEmpresa = z.object({
  nombre: textoRequerido("Escribe el nombre de la empresa").pipe(z.string().max(120, "Máximo 120 caracteres")),
  nit: textoOpcional,
});

export async function crearEmpresa(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const resultado = esquemaEmpresa.safeParse(datosDe(formData));
  if (!resultado.success) return { errores: z.flattenError(resultado.error).fieldErrors, mensaje: "Revisa los campos marcados." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("crear_organizacion", { p_nombre: resultado.data.nombre, p_nit: resultado.data.nit ?? undefined });
  if (error) {
    if (error.message.includes("ya pertenece")) redirect("/registro/finca");
    return { mensaje: error.code === "P0001" ? error.message : "No pudimos crear la empresa. Intenta de nuevo." };
  }

  revalidatePath("/", "layout");
  redirect("/registro/finca");
}

const esquemaFinca = z.object({
  nombre: textoRequerido("Escribe el nombre de la finca"),
  departamento: textoOpcional,
  municipio: textoOpcional,
  vereda: textoOpcional,
  area_cuadras: numeroOpcional,
  tenencia: z
    .string()
    .nullish()
    .transform((v) => (v === "propia" || v === "arrendada" ? v : null)),
  empresa_compradora: textoOpcional,
  precio_litro: numeroOpcional,
  potreros: numeroOpcional.refine((v) => v === null || (Number.isInteger(v) && v <= 300), "Escribe un número entero entre 0 y 300"),
});

export async function crearPrimeraFinca(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const { supabase, user, membresia } = await estadoRegistro();
  if (!user) redirect("/registro");
  if (!membresia) redirect("/registro/empresa");
  if (!ROLES_GESTORES.includes(membresia.rol as Rol)) return { mensaje: "Solo propietarios y administradores pueden crear fincas." };

  const resultado = esquemaFinca.safeParse(datosDe(formData));
  if (!resultado.success) return { errores: z.flattenError(resultado.error).fieldErrors, mensaje: "Revisa los campos marcados." };
  const { potreros, ...finca } = resultado.data;

  const { data, error } = await supabase
    .from("fincas")
    .insert({ ...finca, organizacion_id: membresia.organizacion_id })
    .select("id")
    .single();
  if (error || !data) return { mensaje: error ? mensajeErrorBD(error, "Ya existe una finca con ese nombre.") : "No se pudo crear la finca." };

  let aviso = "";
  if (potreros) {
    const filas = Array.from({ length: potreros }, (_, i) => ({ finca_id: data.id, numero: i + 1 }));
    const { error: errorPotreros } = await supabase.from("potreros").insert(filas);
    if (errorPotreros) aviso = "&aviso=potreros";
  }

  revalidatePath("/", "layout");
  redirect(`/registro/listo?finca=${data.id}${aviso}`);
}

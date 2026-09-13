"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { EstadoFormulario } from "@/components/fincas/campo";
import { datosDe, textoRequerido } from "@/components/fincas/validacion";
import { correoDeUsuario, errorUsuario, rutaInicio } from "@/components/registro/cuentas";
import { clienteConToken, mensajeErrorCuenta } from "@/components/registro/servidor";

const limpiarCodigo = (codigo: string) => codigo.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);

const esquemaUnirse = z
  .object({
    codigo: z.string().transform(limpiarCodigo).pipe(z.string().min(1, "Falta el código")),
    nombre: textoRequerido("Escribe tu nombre completo"),
    modo: z.enum(["usuario", "correo"]),
    usuario: z.string().optional(),
    correo: z.string().optional(),
    clave: z.string(),
    confirmar: z.string(),
  })
  .superRefine((d, ctx) => {
    if (d.modo === "usuario") {
      const error = errorUsuario(d.usuario ?? "");
      if (error) ctx.addIssue({ code: "custom", path: ["usuario"], message: error });
      if (!/^\d{6,}$/.test(d.clave)) ctx.addIssue({ code: "custom", path: ["clave"], message: "El PIN debe tener al menos 6 números" });
    } else {
      if (!z.email().safeParse((d.correo ?? "").trim().toLowerCase()).success) {
        ctx.addIssue({ code: "custom", path: ["correo"], message: "Escribe un correo válido" });
      }
      if (d.clave.length < 6) ctx.addIssue({ code: "custom", path: ["clave"], message: "Usa al menos 6 caracteres" });
    }
    if (d.clave !== d.confirmar) ctx.addIssue({ code: "custom", path: ["confirmar"], message: "No coincide: escríbelo igual las dos veces" });
  });

export async function unirseConCuentaNueva(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const resultado = esquemaUnirse.safeParse(datosDe(formData));
  if (!resultado.success) return { errores: z.flattenError(resultado.error).fieldErrors, mensaje: "Revisa los campos marcados." };
  const { codigo, nombre, modo, usuario, correo, clave } = resultado.data;

  const supabase = await createClient();
  const { data: invitaciones } = await supabase.rpc("ver_invitacion", { p_codigo: codigo });
  const invitacion = invitaciones?.[0];
  if (!invitacion?.valida) return { mensaje: "El código ya venció o no es válido. Pide uno nuevo al administrador de la finca." };

  const email = modo === "usuario" ? correoDeUsuario(usuario ?? "") : (correo ?? "").trim().toLowerCase();
  const { data, error } = await supabase.auth.signUp({ email, password: clave, options: { data: { nombre_completo: nombre } } });
  if (error) {
    const mensaje = mensajeErrorCuenta(error, modo);
    const campo = error.code === "weak_password" ? "clave" : modo;
    return { mensaje, errores: { [campo]: [mensaje] } };
  }
  if (!data.session) return { mensaje: "Revisa tu correo para confirmar la cuenta y vuelve a abrir el enlace de invitación." };

  const { error: errorUnion } = await clienteConToken(data.session.access_token).rpc("aceptar_invitacion", { p_codigo: codigo });
  if (errorUnion) {
    return { mensaje: `Tu cuenta quedó creada, pero no pudimos unirte: ${errorUnion.message}. Pide un código nuevo y vuelve a intentarlo.` };
  }

  revalidatePath("/", "layout");
  redirect(rutaInicio(invitacion.rol));
}

export type EstadoAceptar = { error?: string };

export async function aceptarInvitacion(codigoCrudo: string): Promise<EstadoAceptar> {
  const codigo = limpiarCodigo(codigoCrudo);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/unirse?codigo=${codigo}`);

  const { error } = await supabase.rpc("aceptar_invitacion", { p_codigo: codigo });
  if (error) return { error: error.code === "P0001" ? error.message : "No pudimos unirte al equipo. Intenta de nuevo." };

  const { data: miembro } = await supabase.from("miembros").select("rol").eq("usuario_id", user.id).limit(1).maybeSingle();
  revalidatePath("/", "layout");
  redirect(rutaInicio(miembro?.rol ?? "trabajador"));
}

export async function salirParaUnirme(codigoCrudo: string) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/unirse?codigo=${limpiarCodigo(codigoCrudo)}`);
}

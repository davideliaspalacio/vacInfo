"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { correoParaIngresar, rutaInicio, rutaSegura } from "@/components/registro/cuentas";

export type EstadoLogin = { error?: string };

export async function iniciarSesion(_: EstadoLogin, formData: FormData): Promise<EstadoLogin> {
  const identificador = String(formData.get("identificador") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!identificador || !password) return { error: "Escribe tu correo o usuario y tu contraseña." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: correoParaIngresar(identificador), password });
  if (error || !data.user) return { error: "Usuario, correo o contraseña incorrectos." };

  const siguiente = rutaSegura(formData.get("siguiente"));
  if (siguiente) redirect(siguiente);

  const { data: miembro } = await supabase.from("miembros").select("rol").eq("usuario_id", data.user.id).limit(1).maybeSingle();
  redirect(miembro ? rutaInicio(miembro.rol) : "/registro/empresa");
}

export async function cerrarSesion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

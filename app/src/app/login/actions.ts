"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { correoParaIngresar, rutaInicio, rutaSegura } from "@/components/registro/cuentas";
import { REGLAS, bloqueado, ipCliente, limitar, mensajeLimite, reiniciarLimiteCuenta } from "@/lib/limites";

export type EstadoLogin = { error?: string };

export async function iniciarSesion(_: EstadoLogin, formData: FormData): Promise<EstadoLogin> {
  const identificador = String(formData.get("identificador") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!identificador || !password) return { error: "Escribe tu correo o usuario y tu contraseña." };

  const supabase = await createClient();
  const email = correoParaIngresar(identificador);
  // La IP cuenta cada intento; la cuenta solo los fallidos. El bloqueo aplica exista o no la cuenta.
  const espera = bloqueado(
    ...(await Promise.all([
      limitar(supabase, await ipCliente(), REGLAS.loginIp),
      limitar(supabase, email, REGLAS.loginCuenta, { consumir: false }),
    ])),
  );
  if (espera) return { error: mensajeLimite(espera.reintentarEn) };

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    await limitar(supabase, email, REGLAS.loginCuenta);
    return { error: "Usuario, correo o contraseña incorrectos." };
  }
  await reiniciarLimiteCuenta(supabase, email);

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

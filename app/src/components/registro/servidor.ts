import { createClient as crearClienteSupabase } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import { ROLES_GESTORES, type Rol } from "@/components/equipo/roles";
import { rutaInicio, type ModoCuenta } from "./cuentas";

/** Cliente con el token recién emitido por signUp, sin depender de que las cookies ya estén escritas. */
export function clienteConToken(token: string) {
  return crearClienteSupabase<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function mensajeErrorCuenta(error: { code?: string; message: string }, modo: ModoCuenta = "correo") {
  const codigo = error.code ?? "";
  if (codigo === "user_already_exists" || codigo === "email_exists" || /already registered/i.test(error.message)) {
    return modo === "usuario"
      ? "Ese usuario ya existe. Elige otro, por ejemplo con tu apellido o un número."
      : "Ya hay una cuenta con ese correo. Ingresa con tu contraseña.";
  }
  if (codigo === "weak_password") {
    return modo === "usuario" ? "El PIN es muy corto: usa al menos 6 números." : "La contraseña es muy débil: usa al menos 8 caracteres.";
  }
  if (codigo === "email_address_invalid" || codigo === "validation_failed") {
    return modo === "usuario" ? "Ese usuario tiene caracteres no permitidos." : "Ese correo no es válido.";
  }
  if (codigo === "signup_disabled") return "La creación de cuentas está deshabilitada por ahora.";
  if (codigo.startsWith("over_")) return "Demasiados intentos seguidos. Espera un momento y vuelve a intentar.";
  return "No pudimos crear la cuenta. Intenta de nuevo en un momento.";
}

/** Dónde va cada quien en el asistente de registro, según lo que ya existe. */
export async function estadoRegistro() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user, membresia: null, fincaId: null };

  const { data: membresia } = await supabase
    .from("miembros")
    .select("rol, organizacion_id, organizaciones(nombre, plan, prueba_hasta)")
    .eq("usuario_id", user.id)
    .limit(1)
    .maybeSingle();

  let fincaId: string | null = null;
  if (membresia) {
    const { data } = await supabase
      .from("fincas")
      .select("id")
      .eq("organizacion_id", membresia.organizacion_id)
      .order("creado_en")
      .limit(1)
      .maybeSingle();
    fincaId = data?.id ?? null;
  }

  return { supabase, user, membresia, fincaId };
}

export type EstadoRegistro = Awaited<ReturnType<typeof estadoRegistro>>;

export function rutaPaso({ user, membresia, fincaId }: EstadoRegistro) {
  if (!user) return "/registro";
  if (!membresia) return "/registro/empresa";
  if (!ROLES_GESTORES.includes(membresia.rol as Rol)) return rutaInicio(membresia.rol);
  return fincaId ? "/registro/listo" : "/registro/finca";
}

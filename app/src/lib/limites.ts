import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type Regla = {
  /** Prefijo de la clave, p. ej. "login:ip". */
  ambito: string;
  maximo: number;
  ventanaSegundos: number;
  /** Tiempo de bloqueo al llegar al máximo (0 = hasta que termine la ventana). */
  bloqueoSegundos?: number;
};

const MINUTO = 60;
const HORA = 60 * MINUTO;

/** Límites por endpoint. Ver supabase/migrations/20260914000010_rate_limit.sql. */
export const REGLAS = {
  // 30 y no 20: varias personas de una misma finca o de la misma red móvil pueden compartir IP.
  loginIp: { ambito: "login:ip", maximo: 30, ventanaSegundos: 15 * MINUTO },
  loginCuenta: { ambito: "login:cuenta", maximo: 5, ventanaSegundos: 15 * MINUTO, bloqueoSegundos: 15 * MINUTO },
  registroIp: { ambito: "registro:ip", maximo: 5, ventanaSegundos: HORA },
  invitacionIp: { ambito: "invitacion-ver:ip", maximo: 20, ventanaSegundos: 15 * MINUTO },
  aceptarIp: { ambito: "invitacion-aceptar:ip", maximo: 10, ventanaSegundos: HORA },
  aceptarUsuario: { ambito: "invitacion-aceptar:usuario", maximo: 10, ventanaSegundos: HORA },
  organizacionUsuario: { ambito: "organizacion:usuario", maximo: 3, ventanaSegundos: 24 * HORA },
  sincronizar: { ambito: "campo-sincronizar:usuario", maximo: 60, ventanaSegundos: MINUTO },
  catalogo: { ambito: "campo-catalogo:usuario", maximo: 20, ventanaSegundos: MINUTO },
  mensajes: { ambito: "campo-mensajes:usuario", maximo: 60, ventanaSegundos: MINUTO },
  analizarExcel: { ambito: "importar-analizar:usuario", maximo: 10, ventanaSegundos: HORA },
  importarExcel: { ambito: "importar-aplicar:usuario", maximo: 10, ventanaSegundos: HORA },
} satisfies Record<string, Regla>;

export type ResultadoLimite = { permitido: boolean; reintentarEn: number };

type Cliente = SupabaseClient<Database>;

/** IP del cliente según el proxy (en Vercel, x-forwarded-for la escribe la plataforma). */
export async function ipCliente() {
  const h = await headers();
  const reenviada = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return reenviada || h.get("x-real-ip")?.trim() || "desconocida";
}

export const claveLimite = (regla: Regla, sujeto: string) => `${regla.ambito}:${sujeto}`.slice(0, 300);

/**
 * Consume un uso de la regla para el sujeto (IP, correo o id de usuario).
 * Con `consumir: false` solo consulta. Si el limitador falla se deja pasar: una caída no debe bloquear a todos.
 */
export async function limitar(supabase: Cliente, sujeto: string, regla: Regla, { consumir = true } = {}): Promise<ResultadoLimite> {
  const { data, error } = await supabase.rpc("consumir_limite", {
    p_clave: claveLimite(regla, sujeto),
    p_maximo: regla.maximo,
    p_ventana_segundos: regla.ventanaSegundos,
    p_bloqueo_segundos: regla.bloqueoSegundos ?? 0,
    p_consumir: consumir,
  });
  const fila = data?.[0];
  if (error || !fila) {
    console.error(`[limites] no se pudo consultar ${regla.ambito}:`, error?.message ?? "sin respuesta");
    return { permitido: true, reintentarEn: 0 };
  }
  return { permitido: fila.permitido, reintentarEn: fila.reintentar_en };
}

/** Borra el contador de intentos fallidos de la cuenta que acaba de iniciar sesión. */
export async function reiniciarLimiteCuenta(supabase: Cliente, correo: string) {
  const { error } = await supabase.rpc("reiniciar_limite", { p_clave: claveLimite(REGLAS.loginCuenta, correo) });
  if (error) console.error("[limites] no se pudo reiniciar el límite de la cuenta:", error.message);
}

/** Primer resultado bloqueado de la lista (con la espera más larga), o null si todos pasan. */
export function bloqueado(...resultados: ResultadoLimite[]) {
  const negados = resultados.filter((r) => !r.permitido);
  return negados.length ? negados.reduce((a, b) => (b.reintentarEn > a.reintentarEn ? b : a)) : null;
}

export function mensajeLimite(segundos: number) {
  const minutos = Math.max(1, Math.ceil(segundos / MINUTO));
  if (minutos < 90) return `Demasiados intentos. Intenta de nuevo en ${minutos} ${minutos === 1 ? "minuto" : "minutos"}.`;
  const horas = Math.ceil(minutos / 60);
  return `Demasiados intentos. Intenta de nuevo en ${horas} horas.`;
}

/** Respuesta 429 para las rutas de la API. */
export function respuestaLimite({ reintentarEn }: ResultadoLimite, extra: Record<string, string> = {}) {
  const segundos = Math.max(1, reintentarEn);
  return NextResponse.json(
    { error: mensajeLimite(segundos) },
    { status: 429, headers: { ...extra, "Retry-After": String(segundos) } },
  );
}

import type { Rol } from "@/components/equipo/roles";

/** Dominio ficticio para las cuentas de campo que ingresan con usuario + PIN (sin correo). */
export const DOMINIO_CAMPO = "campo.vacinfo.app";

export type ModoCuenta = "usuario" | "correo";

export function normalizarUsuario(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ".");
}

/** Mensaje de error del usuario, o null si es válido. */
export function errorUsuario(valor: string) {
  const usuario = normalizarUsuario(valor);
  if (usuario.length < 3) return "El usuario debe tener al menos 3 caracteres";
  if (usuario.length > 30) return "El usuario puede tener máximo 30 caracteres";
  if (!/^[a-z0-9._-]+$/.test(usuario)) return "Usa solo letras sin tildes, números, punto, guion o guion bajo";
  if (!/^[a-z0-9](.*[a-z0-9])?$/.test(usuario) || usuario.includes("..")) return "Debe empezar y terminar con letra o número";
  return null;
}

export const correoDeUsuario = (usuario: string) => `${normalizarUsuario(usuario)}@${DOMINIO_CAMPO}`;

/** "juan.perez" → correo sintético; un correo real se deja igual. */
export function correoParaIngresar(identificador: string) {
  const valor = identificador.trim();
  return valor.includes("@") ? valor.toLowerCase() : correoDeUsuario(valor);
}

export function usuarioDeCorreo(email?: string | null) {
  return email?.endsWith(`@${DOMINIO_CAMPO}`) ? email.slice(0, -(DOMINIO_CAMPO.length + 1)) : null;
}

export const rutaInicio = (rol: Rol | string) => (rol === "mayordomo" || rol === "trabajador" ? "/campo" : "/");

/** Solo rutas internas ("/algo"), nunca "//otro-sitio". */
export function rutaSegura(valor: unknown) {
  return typeof valor === "string" && /^\/(?![/\\])/.test(valor) ? valor : null;
}

const formatoFechaLarga = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export const fechaLarga = (iso: string) => formatoFechaLarga.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));

export function diasHasta(iso: string, hoy: string) {
  return Math.round((Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) - Date.parse(`${hoy}T00:00:00Z`)) / 86_400_000);
}

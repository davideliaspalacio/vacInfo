import type { Rol } from "@/components/equipo/roles";

/** El consultor solo visualiza: no crea, corrige ni borra información. */
export function soloLectura(rol: Rol) {
  return rol === "consultor";
}

export function puedeRegistrar(rol: Rol) {
  return !soloLectura(rol);
}

export const MENSAJE_SOLO_LECTURA = "Tu rol de consultor es de solo lectura: puedes ver la información, pero no modificarla.";

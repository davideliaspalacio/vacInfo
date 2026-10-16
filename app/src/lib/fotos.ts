import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/** Bucket privado de Storage donde viven las fotos de animales, bienes y fincas. */
export const BUCKET_FOTOS = "fotos";

/** Carpetas permitidas dentro del bucket: {organizacion_id}/{tipo}/{archivo}. */
export const TIPOS_FOTO = ["animales", "bienes", "fincas"] as const;
export type TipoFoto = (typeof TIPOS_FOTO)[number];

/** Igual que el límite del bucket (5 MB). */
export const MAX_BYTES_FOTO = 5 * 1024 * 1024;

/** Tipos que acepta el bucket. */
export const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/webp"];

/** Lado mayor al que se redimensiona en el navegador antes de subir, para no gastar datos del celular. */
export const LADO_MAXIMO_FOTO = 1600;

/** Calidad del JPEG que produce el navegador. */
export const CALIDAD_FOTO = 0.8;

/** Duración del enlace firmado con que se muestran las fotos (una hora). */
export const SEGUNDOS_URL_FIRMADA = 3600;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Cliente = SupabaseClient<Database>;

/** Ruta de una foto nueva: {organizacion_id}/{tipo}/{uuid}.jpg (la misma forma que validan las políticas RLS). */
export function rutaFoto(organizacionId: string, tipo: TipoFoto, archivo: string) {
  return `${organizacionId}/${tipo}/${archivo}`;
}

/** Nombre de archivo para una foto nueva. */
export function nombreArchivoFoto(uuid: string) {
  return `${uuid}.jpg`;
}

/**
 * ¿La ruta que mandó el navegador es una foto de esta organización y de este tipo?
 * Nunca se confía en el valor del formulario: tiene que ser exactamente {organizacion_id}/{tipo}/{uuid}.jpg.
 */
export function rutaFotoValida(ruta: string, organizacionId: string, tipo: TipoFoto) {
  if (!UUID.test(organizacionId) || !TIPOS_FOTO.includes(tipo)) return false;
  const partes = ruta.split("/");
  if (partes.length !== 3) return false;
  const [org, carpeta, archivo] = partes;
  if (org !== organizacionId || carpeta !== tipo) return false;
  return archivo.endsWith(".jpg") && UUID.test(archivo.slice(0, -4));
}

/**
 * Tamaño al que se encoge una imagen conservando la proporción: el lado mayor queda en `lado` como
 * máximo. Nunca agranda una foto pequeña (no mejora nada y pesa más).
 */
export function tamanoRedimensionado(ancho: number, alto: number, lado = LADO_MAXIMO_FOTO) {
  if (!(ancho > 0) || !(alto > 0)) return { ancho: 0, alto: 0 };
  const mayor = Math.max(ancho, alto);
  if (mayor <= lado) return { ancho: Math.round(ancho), alto: Math.round(alto) };
  const factor = lado / mayor;
  return { ancho: Math.max(1, Math.round(ancho * factor)), alto: Math.max(1, Math.round(alto * factor)) };
}

/** Enlace firmado (una hora) para mostrar una foto del bucket privado. */
export async function urlFirmadaFoto(supabase: Cliente, ruta: string | null | undefined) {
  if (!ruta) return null;
  const { data } = await supabase.storage.from(BUCKET_FOTOS).createSignedUrl(ruta, SEGUNDOS_URL_FIRMADA);
  return data?.signedUrl ?? null;
}

/** Enlaces firmados de varias fotos en una sola llamada (listados con miniatura). */
export async function urlesFirmadasFotos(supabase: Cliente, rutas: (string | null | undefined)[]) {
  const limpias = [...new Set(rutas.filter((r): r is string => Boolean(r)))];
  const urles = new Map<string, string>();
  if (!limpias.length) return urles;

  const { data } = await supabase.storage.from(BUCKET_FOTOS).createSignedUrls(limpias, SEGUNDOS_URL_FIRMADA);
  for (const fila of data ?? []) if (fila.path && fila.signedUrl) urles.set(fila.path, fila.signedUrl);
  return urles;
}

/** Borra del bucket la foto que se reemplazó o se quitó. Un fallo aquí no debe tumbar el guardado. */
export async function borrarFoto(supabase: Cliente, ruta: string | null | undefined) {
  if (!ruta) return;
  await supabase.storage.from(BUCKET_FOTOS).remove([ruta]);
}

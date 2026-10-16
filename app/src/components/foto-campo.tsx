"use client";

import { useId, useRef, useState } from "react";
import { Camera, ImageOff, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  BUCKET_FOTOS,
  CALIDAD_FOTO,
  MAX_BYTES_FOTO,
  nombreArchivoFoto,
  rutaFoto,
  tamanoRedimensionado,
  TIPOS_IMAGEN,
  type TipoFoto,
} from "@/lib/fotos";

const MB = 1024 * 1024;

/** Abre la imagen elegida sin pasar por la red. `createImageBitmap` falta en navegadores viejos. */
async function abrirImagen(archivo: File) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(archivo);
    } catch {
      // Formato que el navegador no decodifica por esa vía: se intenta con <img>.
    }
  }
  const url = URL.createObjectURL(archivo);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Encoge la foto en el celular antes de subirla: lado mayor 1600 px y JPEG de calidad 0,8. */
async function redimensionar(archivo: File) {
  const imagen = await abrirImagen(archivo);
  const { ancho, alto } = tamanoRedimensionado(imagen.width, imagen.height);
  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext("2d");
  if (!ctx) throw new Error("Este navegador no puede preparar la foto.");
  ctx.drawImage(imagen, 0, 0, ancho, alto);
  if ("close" in imagen) imagen.close();

  const blob = await new Promise<Blob | null>((listo) => lienzo.toBlob(listo, "image/jpeg", CALIDAD_FOTO));
  if (!blob) throw new Error("No se pudo preparar la foto.");
  return blob;
}

/**
 * Campo de foto reutilizable (animal, bien o finca).
 *
 * Sube la imagen al bucket privado `fotos` con el cliente de navegador y deja en el formulario la
 * RUTA del archivo (nunca una URL firmada, que vence). El servidor valida que esa ruta sea de la
 * organización del usuario antes de guardarla en `foto_url`.
 */
export function FotoCampo({
  tipo,
  organizacionId,
  nombre = "foto_url",
  etiqueta = "Foto",
  ayuda = "Tómala con el celular o elige una imagen. Se guarda reducida para no gastar datos.",
  valor,
  url,
  alt,
  deshabilitado = false,
  motivo,
  error,
}: {
  tipo: TipoFoto;
  organizacionId: string;
  nombre?: string;
  etiqueta?: string;
  ayuda?: string;
  /** Ruta guardada hoy en `foto_url`. */
  valor?: string | null;
  /** Enlace firmado de la foto guardada, para la vista previa al editar. */
  url?: string | null;
  alt?: string;
  deshabilitado?: boolean;
  motivo?: string;
  error?: string[];
}) {
  const id = useId();
  const [ruta, setRuta] = useState(valor ?? "");
  const [vista, setVista] = useState<string | null>(url ?? null);
  const [subiendo, setSubiendo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);
  // Fotos subidas en este formulario que todavía no se guardaron: si se reemplazan, se borran del bucket.
  const sinGuardar = useRef<string | null>(null);

  const limpiarHuerfana = async () => {
    const pendiente = sinGuardar.current;
    sinGuardar.current = null;
    if (!pendiente) return;
    try {
      await createClient().storage.from(BUCKET_FOTOS).remove([pendiente]);
    } catch {
      // Si no se puede borrar queda un archivo suelto; no vale la pena molestar al usuario.
    }
  };

  const elegir = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = ev.target.files?.[0];
    if (entrada.current) entrada.current.value = "";
    if (!archivo) return;
    setAviso(null);

    if (!archivo.type.startsWith("image/") || (archivo.type && !TIPOS_IMAGEN.includes(archivo.type))) {
      setAviso("Elige una imagen JPG, PNG o WebP.");
      return;
    }
    if (archivo.size > MAX_BYTES_FOTO) {
      setAviso(`La foto pesa ${(archivo.size / MB).toFixed(1)} MB y el máximo es 5 MB. Tómala con menos resolución.`);
      return;
    }

    setSubiendo(true);
    try {
      const blob = await redimensionar(archivo);
      const destino = rutaFoto(organizacionId, tipo, nombreArchivoFoto(crypto.randomUUID()));
      const { error: fallo } = await createClient().storage.from(BUCKET_FOTOS).upload(destino, blob, { contentType: "image/jpeg" });
      if (fallo) throw fallo;

      await limpiarHuerfana();
      sinGuardar.current = destino;
      setRuta(destino);
      setVista((anterior) => {
        if (anterior?.startsWith("blob:")) URL.revokeObjectURL(anterior);
        return URL.createObjectURL(blob);
      });
    } catch (fallo) {
      setAviso(fallo instanceof Error ? `No se pudo subir la foto: ${fallo.message}` : "No se pudo subir la foto. Revisa la señal e inténtalo otra vez.");
    } finally {
      setSubiendo(false);
    }
  };

  const quitar = async () => {
    setAviso(null);
    setVista((anterior) => {
      if (anterior?.startsWith("blob:")) URL.revokeObjectURL(anterior);
      return null;
    });
    setRuta("");
    await limpiarHuerfana();
  };

  const mensaje = aviso ?? error?.[0];

  return (
    <div className="block">
      <span className="mb-1.5 block text-sm font-bold text-bosque">{etiqueta}</span>
      <input type="hidden" name={nombre} value={ruta} />

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#bdc8b7] bg-[#fffef9]">
          {vista ? (
            // Enlace firmado del bucket privado: no pasa por el optimizador de imágenes de Next.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={vista} alt={alt ?? `Vista previa de la foto${etiqueta ? ` · ${etiqueta.toLowerCase()}` : ""}`} className="h-full w-full object-cover" />
          ) : (
            <ImageOff className="h-8 w-8 text-tinta-suave" aria-hidden />
          )}
        </div>

        <div className="space-y-2">
          {deshabilitado ? (
            <p className="text-sm text-tinta-suave">{motivo ?? "No tienes permiso para cambiar la foto."}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={entrada}
                  id={id}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={elegir}
                  disabled={subiendo}
                  className="peer sr-only"
                />
                <label
                  htmlFor={id}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-bosque/20 bg-lima-suave px-4 py-2.5 font-bold text-bosque hover:bg-lima peer-focus-visible:ring-4 peer-focus-visible:ring-pasto-oscuro/30 peer-disabled:cursor-progress peer-disabled:opacity-60"
                >
                  <Camera className="h-5 w-5" aria-hidden />
                  {ruta ? "Cambiar foto" : "Agregar foto"}
                </label>
                {ruta && (
                  <button
                    type="button"
                    onClick={quitar}
                    disabled={subiendo}
                    className="rounded-xl border border-bosque/20 px-4 py-2.5 font-bold text-bosque hover:bg-crema focus-visible:ring-4 focus-visible:ring-pasto-oscuro/30 disabled:opacity-60"
                  >
                    Quitar foto
                  </button>
                )}
              </div>
              <p aria-live="polite" className="text-xs text-tinta-suave">
                {subiendo ? (
                  <span className="inline-flex items-center gap-1.5 font-bold text-bosque">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Subiendo…
                  </span>
                ) : (
                  ayuda
                )}
              </p>
            </>
          )}
          {mensaje && (
            <p role="alert" className="text-xs font-bold text-alerta">
              {mensaje}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

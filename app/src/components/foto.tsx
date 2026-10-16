/**
 * Fotos del bucket privado `fotos`: se pintan con un enlace firmado que vence en una hora
 * (`urlFirmadaFoto` / `urlesFirmadasFotos`). Sin foto no se dibuja nada, para no dejar huecos.
 *
 * Se usa <img> y no `next/image` a propósito: el enlace firmado cambia en cada carga y el
 * optimizador de Next no debe cachearlo ni volver a pedirlo cuando ya venció.
 */

/** Foto de la ficha (animal, bien o finca). */
export function FotoFicha({ url, alt, className }: { url: string | null; alt: string; className?: string }) {
  if (!url) return null;
  return (
    <figure className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={alt} className="aspect-4/3 w-full rounded-2xl border border-black/10 bg-crema object-cover" />
    </figure>
  );
}

/** Miniatura para los listados. */
export function MiniaturaFoto({ url, alt, className }: { url: string | null; alt: string; className?: string }) {
  if (!url) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={alt} className={className ?? "h-10 w-10 rounded-lg border border-black/10 object-cover"} />
  );
}

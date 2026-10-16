"use client";

import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import clsx from "clsx";

/**
 * Botón «Atrás» de VacInfo. Vive en el layout de `(vacinfo)`, así que aparece
 * arriba a la izquierda en todas las páginas menos la de inicio.
 *
 * Usa el historial del navegador; cuando no hay historial (se abrió el enlace
 * directo desde un QR, un correo o una pestaña nueva) navega a `fallback`.
 */
export function BotonAtras({ fallback = "/", className }: { fallback?: string; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();

  // La página de inicio no necesita botón «Atrás».
  if (pathname === "/") return null;

  function volver() {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push(fallback);
  }

  return (
    <button
      type="button"
      onClick={volver}
      title="Volver a la página anterior"
      className={clsx(
        "mb-6 inline-flex items-center gap-2 rounded-xl border border-white/30 bg-[rgba(8,26,16,0.42)] px-4 py-2 font-bold text-leche backdrop-blur transition hover:bg-[rgba(8,26,16,0.7)] print:hidden",
        className,
      )}
    >
      <ArrowLeft className="h-5 w-5" aria-hidden />
      Atrás
    </button>
  );
}

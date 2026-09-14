"use client";

import clsx from "clsx";
import { useLinkStatus } from "next/link";

/** Aro giratorio sobre la pestaña pulsada mientras llega la respuesta del servidor. */
export function IndicadorPestana() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={clsx(
        "pointer-events-none absolute -right-1.5 -top-1.5 h-4 w-4 rounded-full border-2 border-lima border-t-transparent bg-bosque transition-opacity",
        pending ? "animate-spin opacity-100" : "opacity-0",
      )}
    />
  );
}

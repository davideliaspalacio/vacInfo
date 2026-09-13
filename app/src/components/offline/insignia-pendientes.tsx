"use client";

import Link from "next/link";
import { CloudUpload } from "lucide-react";
import { usePendientes } from "./hooks";

export function InsigniaPendientes() {
  const total = usePendientes();
  if (!total) return null;
  return (
    <Link
      href="/campo/rapido?vista=pendientes"
      title="Registros guardados en el teléfono que aún no se envían"
      className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-amber-100 px-3 text-xs font-bold text-amber-900"
    >
      <CloudUpload className="h-4 w-4" aria-hidden />
      {total} sin enviar
    </Link>
  );
}

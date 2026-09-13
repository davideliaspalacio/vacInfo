"use client";

import { useFormStatus } from "react-dom";
import { LoaderCircle, Save } from "lucide-react";

export function BotonGuardar({ children = "Guardar registro" }: { children?: React.ReactNode }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-campo px-5 text-lg font-bold text-white shadow-lg shadow-campo/25 transition hover:bg-campo-oscuro active:scale-[0.99] disabled:opacity-60"
    >
      {pending ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden /> : <Save className="h-5 w-5" aria-hidden />}
      {pending ? "Guardando…" : children}
    </button>
  );
}

import clsx from "clsx";

export type EstadoFormulario = { errores?: Record<string, string[] | undefined>; mensaje?: string };

export function Campo({
  etiqueta,
  error,
  children,
  className,
  ayuda,
}: {
  etiqueta: string;
  error?: string[];
  children: React.ReactNode;
  className?: string;
  ayuda?: React.ReactNode;
}) {
  return (
    <label className={clsx("block", className)}>
      <span className="mb-1.5 block text-sm font-bold text-bosque">{etiqueta}</span>
      {children}
      {ayuda && !error?.length && <span className="mt-1 block text-xs text-tinta-suave">{ayuda}</span>}
      {error?.length ? <span className="mt-1 block text-xs font-bold text-alerta">{error[0]}</span> : null}
    </label>
  );
}

export function MensajeError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-xl border border-alerta/30 bg-[#fbe9e5] px-4 py-3 text-sm font-bold text-alerta">
      {children}
    </p>
  );
}

export function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white/70 px-4 py-3">
      <dt className="text-xs font-bold uppercase tracking-wider text-tinta-suave">{etiqueta}</dt>
      <dd className="mt-0.5 font-bold text-bosque">{children || "—"}</dd>
    </div>
  );
}

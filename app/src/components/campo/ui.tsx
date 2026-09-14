import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft, CircleCheck, TriangleAlert } from "lucide-react";
import { hoyISO } from "@/lib/formato";

export const control =
  "min-h-14 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-campo focus:outline-none focus:ring-4 focus:ring-campo/15";

export function param(valor: string | string[] | undefined) {
  return Array.isArray(valor) ? valor[0] : valor;
}

export function TarjetaCampo({ className, children, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      className={clsx("rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_16px_42px_rgba(16,24,40,0.08)]", className)}
      {...props}
    >
      {children}
    </section>
  );
}

export function Volver({ href, children = "Volver" }: { href: string; children?: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="mb-4 inline-flex min-h-12 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 font-bold text-slate-700 shadow-sm transition hover:-translate-y-0.5"
    >
      <ArrowLeft className="h-[18px] w-[18px]" aria-hidden />
      {children}
    </Link>
  );
}

export function Titulo({ kicker, titulo, descripcion }: { kicker?: string; titulo: string; descripcion?: React.ReactNode }) {
  return (
    <div className="mb-5">
      {kicker && <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-campo">{kicker}</p>}
      <h1 className="font-display text-[1.7rem] font-bold leading-tight text-slate-900">{titulo}</h1>
      {descripcion && <p className="mt-2 leading-relaxed text-slate-600">{descripcion}</p>}
    </div>
  );
}

export function Aviso({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) return null;
  return error ? (
    <p role="alert" className="mb-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 font-semibold text-red-800">
      <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      {error}
    </p>
  ) : (
    <p role="status" className="mb-4 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-semibold text-emerald-800">
      <CircleCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      {ok}
    </p>
  );
}

export function Chips({ items }: { items: { href: string; etiqueta: string; activo: boolean }[] }) {
  return (
    <div className="mb-5 flex flex-wrap gap-2">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.activo ? "page" : undefined}
          className={clsx(
            "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-bold",
            item.activo ? "border-campo bg-campo text-white" : "border-slate-300 bg-white text-slate-700",
          )}
        >
          {item.etiqueta}
        </Link>
      ))}
    </div>
  );
}

export function Campo({ etiqueta, ayuda, className, children }: { etiqueta: string; ayuda?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={clsx("block", className)}>
      <span className="mb-2 block font-bold text-slate-800">{etiqueta}</span>
      {children}
      {ayuda && <span className="mt-1.5 block text-sm text-slate-500">{ayuda}</span>}
    </label>
  );
}

export function CampoFecha({ etiqueta = "Fecha", name = "fecha", defecto = hoyISO(), requerido = true }: { etiqueta?: string; name?: string; defecto?: string; requerido?: boolean }) {
  return (
    <Campo etiqueta={etiqueta}>
      <input type="date" name={name} defaultValue={defecto} required={requerido} className={control} />
    </Campo>
  );
}

export function Opciones({
  etiqueta,
  name,
  opciones,
  defecto,
  requerido,
  columnas = 2,
}: {
  etiqueta: string;
  name: string;
  opciones: { valor: string; etiqueta: string }[];
  defecto?: string;
  requerido?: boolean;
  columnas?: 2 | 3;
}) {
  return (
    <fieldset>
      <legend className="mb-2 font-bold text-slate-800">{etiqueta}</legend>
      <div className={clsx("grid gap-2", columnas === 3 ? "grid-cols-3" : "grid-cols-2")}>
        {opciones.map((o) => (
          <label
            key={o.valor}
            className="flex min-h-14 cursor-pointer items-center justify-center rounded-2xl border border-slate-300 bg-white px-3 text-center font-bold text-slate-700 has-checked:border-campo has-checked:bg-blue-50 has-checked:text-campo-oscuro has-focus-visible:ring-4 has-focus-visible:ring-campo/25"
          >
            <input type="radio" name={name} value={o.valor} defaultChecked={o.valor === defecto} required={requerido} className="sr-only" />
            {o.etiqueta}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export const SI_NO = [
  { valor: "si", etiqueta: "Sí" },
  { valor: "no", etiqueta: "No" },
];

export const JORNADAS = [
  { valor: "am", etiqueta: "Mañana (AM)" },
  { valor: "pm", etiqueta: "Tarde (PM)" },
];

export function Casilla({ name, etiqueta, value, defecto }: { name: string; etiqueta: string; value?: string; defecto?: boolean }) {
  return (
    <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 font-bold text-slate-700 has-checked:border-campo has-checked:bg-blue-50 has-checked:text-campo-oscuro">
      <input type="checkbox" name={name} value={value} defaultChecked={defecto} className="h-6 w-6 accent-campo" />
      {etiqueta}
    </label>
  );
}

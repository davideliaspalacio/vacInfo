import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import clsx from "clsx";

export function Encabezado({
  eyebrow,
  titulo,
  descripcion,
  acciones,
  claro = true,
}: {
  eyebrow?: string;
  titulo: string;
  descripcion?: React.ReactNode;
  acciones?: React.ReactNode;
  /** true = texto claro sobre el fondo verde de VacInfo */
  claro?: boolean;
}) {
  return (
    <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
      <div>
        {eyebrow && (
          <p className={clsx("text-xs font-bold uppercase tracking-[0.16em]", claro ? "text-lima" : "text-pasto-oscuro")}>{eyebrow}</p>
        )}
        <h1 className={clsx("font-display mt-2 text-4xl font-bold sm:text-5xl", claro ? "text-leche" : "text-bosque")}>{titulo}</h1>
        {descripcion && <p className={clsx("mt-2 max-w-2xl", claro ? "text-leche/80" : "text-tinta-suave")}>{descripcion}</p>}
      </div>
      {acciones && <div className="flex flex-wrap gap-3">{acciones}</div>}
    </div>
  );
}

export function Tarjeta({ className, children, ...props }: React.ComponentProps<"section">) {
  return (
    <section className={clsx("papel rounded-3xl p-5 sm:p-6", className)} {...props}>
      {children}
    </section>
  );
}

export function TituloTarjeta({ children, detalle }: { children: React.ReactNode; detalle?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-3">
      <h2 className="font-display text-xl font-bold text-bosque">{children}</h2>
      {detalle && <span className="text-sm text-tinta-suave">{detalle}</span>}
    </div>
  );
}

export function Metrica({ valor, etiqueta, tono = "lima" }: { valor: React.ReactNode; etiqueta: string; tono?: "lima" | "crema" | "alerta" }) {
  return (
    <div
      className={clsx(
        "rounded-2xl border p-4",
        tono === "lima" && "border-[#cadba8] bg-lima-suave",
        tono === "crema" && "border-cafe/20 bg-crema",
        tono === "alerta" && "border-alerta/25 bg-[#fbe9e5]",
      )}
    >
      <span className="font-display block text-2xl font-bold text-bosque">{valor}</span>
      <span className="text-sm text-tinta-suave">{etiqueta}</span>
    </div>
  );
}

const TONOS = {
  verde: "bg-lima text-bosque",
  amarillo: "bg-dorado/40 text-[#6b4a09]",
  rojo: "bg-[#f7d4cc] text-alerta",
  azul: "bg-blue-100 text-campo-oscuro",
  gris: "bg-black/5 text-tinta-suave",
} as const;

export function Etiqueta({ tono = "gris", children }: { tono?: keyof typeof TONOS; children: React.ReactNode }) {
  return <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold", TONOS[tono])}>{children}</span>;
}

export function BotonVolver({ href, children = "Volver" }: { href: string; children?: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-[rgba(8,26,16,0.42)] px-4 py-2 text-leche backdrop-blur hover:bg-[rgba(8,26,16,0.7)]"
    >
      <ArrowLeft className="h-5 w-5" aria-hidden />
      {children}
    </Link>
  );
}

export function BotonPrimario({ className, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      className={clsx("boton-accion inline-flex items-center justify-center gap-2 rounded-xl bg-bosque px-5 py-3 font-bold text-leche disabled:opacity-60", className)}
      {...props}
    />
  );
}

export function Vacio({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-tinta/20 p-6 text-center text-tinta-suave">{children}</p>;
}

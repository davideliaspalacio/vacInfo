import Link from "next/link";
import { Check } from "lucide-react";
import clsx from "clsx";

export const PASOS_REGISTRO = ["Tu cuenta", "Tu empresa", "Tu primera finca", "¡Listo!"] as const;

export function MarcoPublico({
  eyebrow,
  titulo,
  descripcion,
  lateral,
  children,
}: {
  eyebrow: string;
  titulo: React.ReactNode;
  descripcion?: React.ReactNode;
  lateral?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="fondo-vacinfo grano relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10">
      <div className="mancha -left-24 top-[18%] h-44 w-64 rotate-12 opacity-80" aria-hidden />
      <div className="mancha -right-20 top-[58%] h-60 w-48 -rotate-12 opacity-80" aria-hidden />
      <div className="relative z-10 grid w-full max-w-5xl items-start gap-10 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="text-leche lg:sticky lg:top-10">
          <Link href="/login" className="font-display text-2xl font-extrabold">
            VacInfo
          </Link>
          <p className="mt-8 text-xs font-bold uppercase tracking-[0.16em] text-lima">{eyebrow}</p>
          <h1 className="font-display mt-3 text-4xl font-extrabold leading-[1.02] sm:text-5xl">{titulo}</h1>
          {descripcion && <p className="mt-4 max-w-md text-lg text-leche/85">{descripcion}</p>}
          <div className="divisor-campo my-7 max-w-sm" />
          {lateral}
        </div>
        <div className="papel rounded-3xl p-6 sm:p-8">{children}</div>
      </div>
    </main>
  );
}

function ProgresoLateral({ paso }: { paso: number }) {
  return (
    <ol className="hidden space-y-3 lg:block" aria-label="Pasos del registro">
      {PASOS_REGISTRO.map((nombre, i) => {
        const n = i + 1;
        const hecho = n < paso;
        const actual = n === paso;
        return (
          <li key={nombre} aria-current={actual ? "step" : undefined} className="flex items-center gap-3">
            <span
              className={clsx(
                "grid h-9 w-9 place-items-center rounded-full border-2 font-bold",
                hecho && "border-lima bg-lima text-bosque",
                actual && "border-dorado bg-dorado text-bosque",
                !hecho && !actual && "border-leche/35 text-leche/60",
              )}
            >
              {hecho ? <Check className="h-4 w-4" aria-hidden /> : n}
            </span>
            <span className={clsx("font-bold", actual ? "text-leche" : hecho ? "text-lima" : "text-leche/60")}>{nombre}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function MarcoRegistro({
  paso,
  titulo,
  descripcion,
  children,
}: {
  paso: 1 | 2 | 3 | 4;
  titulo: React.ReactNode;
  descripcion?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <MarcoPublico eyebrow="Registro de empresa" titulo={titulo} descripcion={descripcion} lateral={<ProgresoLateral paso={paso} />}>
      <div className="mb-6">
        <div className="flex items-baseline justify-between text-xs font-bold uppercase tracking-wider text-tinta-suave">
          <span>
            Paso {paso} de {PASOS_REGISTRO.length}
          </span>
          <span className="text-pasto-oscuro">{PASOS_REGISTRO[paso - 1]}</span>
        </div>
        <div
          className="mt-2 h-2.5 overflow-hidden rounded-full bg-black/10"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={PASOS_REGISTRO.length}
          aria-valuenow={paso}
          aria-label="Avance del registro"
        >
          <div className="h-full rounded-full bg-pasto transition-all" style={{ width: `${(paso / PASOS_REGISTRO.length) * 100}%` }} />
        </div>
      </div>
      {children}
    </MarcoPublico>
  );
}

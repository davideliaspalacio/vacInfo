import clsx from "clsx";
import { Microscope } from "lucide-react";
import { obtenerSesion } from "@/lib/sesion";
import { Chips, TarjetaCampo, Titulo, Volver, param } from "@/components/campo/ui";

const SECCIONES = [
  { clave: "manual", etiqueta: "Manual del trabajador" },
  { clave: "flujograma", etiqueta: "Flujograma reproductivo" },
  { clave: "sanitario", etiqueta: "Plan sanitario" },
] as const;

const FLUJO = [
  { etapa: "Parto", detalle: "Revisar placenta, calostro a la cría en las primeras horas.", dia: "Día 0" },
  { espera: "40 días de espera voluntaria" },
  { etapa: "Servicio", detalle: "Inseminación o monta. Si pasan más de 40 días sin servicio hay mora de preñez.", dia: "Desde el día 40" },
  { espera: "+33 días" },
  { etapa: "Palpación", detalle: "Si está vacía, vuelve a servicio en el siguiente celo.", dia: "Servicio + 33" },
  { espera: "+210 días desde el servicio" },
  { etapa: "Secar", detalle: "7 meses de preñez: se deja de ordeñar.", dia: "Servicio + 210" },
  { espera: "+65 días seca" },
  { etapa: "Parto", detalle: "Parto esperado. Empieza de nuevo el ciclo.", dia: "Servicio + 275" },
];

const PUNTOS = ["bg-campo", "bg-amber-500", "bg-emerald-600", "bg-slate-500", "bg-campo"];

export default async function AprendizajePage({ searchParams }: PageProps<"/campo/aprendizaje">) {
  const sp = await searchParams;
  const seccion = SECCIONES.find((s) => s.clave === param(sp.seccion))?.clave ?? "manual";
  const { supabase } = await obtenerSesion();

  const [tareas, plan] = await Promise.all([
    seccion === "manual"
      ? supabase.from("tareas_manual").select("id, frecuencia, orden, descripcion").order("orden").then((r) => r.data ?? [])
      : [],
    seccion === "sanitario"
      ? supabase.from("plan_sanitario").select("id, enfermedad, joven, adulto, observaciones").order("id").then((r) => r.data ?? [])
      : [],
  ]);

  return (
    <>
      <Volver href="/campo" />
      <TarjetaCampo>
        <Titulo kicker="Aprendizaje" titulo="Aprende el trabajo de la finca" descripcion="Consulta las tareas, el ciclo de cada vaca y el calendario de vacunas." />
        <Chips items={SECCIONES.map((s) => ({ href: `/campo/aprendizaje?seccion=${s.clave}`, etiqueta: s.etiqueta, activo: s.clave === seccion }))} />

        {seccion === "manual" &&
          (["diaria", "frecuente"] as const).map((frecuencia) => {
            const lista = tareas.filter((t) => t.frecuencia === frecuencia);
            return (
              <section key={frecuencia} className="mb-6 last:mb-0">
                <h2 className="font-display mb-3 text-xl font-bold text-slate-900">
                  {frecuencia === "diaria" ? "Tareas diarias" : "Tareas frecuentes"}
                  <span className="ml-2 text-sm font-semibold text-slate-400">{lista.length}</span>
                </h2>
                <ul className="space-y-2">
                  {lista.map((t) => (
                    <li key={t.id}>
                      <label className="flex min-h-14 cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3 has-checked:border-emerald-200 has-checked:bg-emerald-50 has-checked:text-slate-500">
                        <input type="checkbox" className="mt-0.5 h-6 w-6 shrink-0 accent-emerald-600" />
                        <span className="leading-snug">{t.descripcion}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

        {seccion === "flujograma" && (
          <ol className="relative">
            {FLUJO.map((paso, i) =>
              "espera" in paso ? (
                <li key={i} className="ml-[15px] border-l-4 border-dashed border-blue-200 py-3 pl-6">
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-campo-oscuro">{paso.espera}</span>
                </li>
              ) : (
                <li key={i} className="flex gap-4">
                  <span className={clsx("mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full font-bold text-white", PUNTOS[i / 2])}>
                    {i / 2 + 1}
                  </span>
                  <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="text-lg font-bold text-slate-900">{paso.etapa}</h3>
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-400">{paso.dia}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{paso.detalle}</p>
                  </div>
                </li>
              ),
            )}
          </ol>
        )}

        {seccion === "sanitario" && (
          <ul className="space-y-3">
            {plan.map((p) => (
              <li key={p.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <h3 className="font-bold text-slate-900">{p.enfermedad}</h3>
                <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Jóvenes</dt>
                    <dd className="text-slate-700">{p.joven || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Adultos</dt>
                    <dd className="text-slate-700">{p.adulto || "—"}</dd>
                  </div>
                </dl>
                {p.observaciones && <p className="mt-2 text-sm text-slate-500">{p.observaciones}</p>}
              </li>
            ))}
          </ul>
        )}
      </TarjetaCampo>

      <aside className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
        <Microscope className="mt-0.5 h-6 w-6 shrink-0" aria-hidden />
        <p>
          <strong className="block">Prueba de mastitis</strong>
          Hacerla cada 7 días en todas las vacas en ordeño y anotar los cuartos afectados en Salud → Mastitis.
        </p>
      </aside>
    </>
  );
}

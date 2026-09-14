import { Bloque } from "@/components/fincas/esqueletos";

export function EsqueletoInforme() {
  return (
    <section className="papel space-y-4 rounded-3xl p-5 sm:p-6" aria-busy="true" aria-label="Cargando informe">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Bloque className="h-8 w-72" />
        <Bloque className="h-4 w-56" />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Bloque key={i} className="h-44 rounded-lg" />
        ))}
      </div>
      <Bloque className="h-64 rounded-lg" />
    </section>
  );
}

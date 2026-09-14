import clsx from "clsx";

export function Bloque({ className }: { className?: string }) {
  return <div aria-hidden className={clsx("animate-pulse rounded-2xl bg-black/[0.07]", className)} />;
}

export function EsqueletoMetricas({ cantidad = 8, className }: { cantidad?: number; className?: string }) {
  return (
    <div className={clsx("grid grid-cols-2 gap-3 md:grid-cols-4", className)}>
      {Array.from({ length: cantidad }, (_, i) => (
        <Bloque key={i} className="h-[4.5rem]" />
      ))}
    </div>
  );
}

export function EsqueletoTabla({ filas = 8 }: { filas?: number }) {
  return (
    <section className="papel space-y-3 rounded-3xl p-5 sm:p-6" aria-busy="true" aria-label="Cargando">
      <Bloque className="h-7 w-64" />
      {Array.from({ length: filas }, (_, i) => (
        <Bloque key={i} className="h-8 rounded-lg" />
      ))}
    </section>
  );
}

/** Esqueleto de una página de VacInfo: encabezado sobre el fondo verde, tarjeta de métricas y tabla. */
export function EsqueletoPagina({ metricas = 8, pestanas = 0 }: { metricas?: number; pestanas?: number }) {
  return (
    <div className="space-y-8" aria-busy="true">
      <div className="h-10 w-28 animate-pulse rounded-xl bg-white/10" />
      <div className="space-y-3">
        <div className="h-3 w-48 animate-pulse rounded bg-lima/30" />
        <div className="h-12 w-80 max-w-full animate-pulse rounded-xl bg-white/15" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded bg-white/10" />
      </div>
      {metricas > 0 && (
        <section className="papel rounded-3xl p-5 sm:p-6">
          <Bloque className="mb-5 h-5 w-56" />
          <EsqueletoMetricas cantidad={metricas} className={metricas === 8 ? "xl:grid-cols-8" : "md:grid-cols-5"} />
        </section>
      )}
      {pestanas > 0 && (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: pestanas }, (_, i) => (
            <div key={i} className="h-9 w-28 animate-pulse rounded-xl bg-white/15" />
          ))}
        </div>
      )}
      <EsqueletoTabla />
    </div>
  );
}

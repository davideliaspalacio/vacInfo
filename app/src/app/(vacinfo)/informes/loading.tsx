import { EsqueletoInforme } from "@/components/informes/esqueleto";

export default function Cargando() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="space-y-3">
        <div className="h-3 w-48 animate-pulse rounded bg-lima/30" />
        <div className="h-12 w-72 max-w-full animate-pulse rounded-xl bg-white/15" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded bg-white/10" />
      </div>
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-12 w-36 animate-pulse rounded-xl bg-white/15" />
        ))}
      </div>
      <EsqueletoInforme />
    </div>
  );
}

import Link from "next/link";
import { Box, PawPrint, Warehouse } from "lucide-react";
import { obtenerSesion } from "@/lib/sesion";
import { Tarjeta, Vacio } from "@/components/ui";
import { CATEGORIAS_PLURAL, ORDEN_CATEGORIAS, ESTADOS_BIEN, TIPOS_BIEN, TIPOS_BIEN_PLURAL } from "@/components/fincas/etiquetas";

const MAX_CHIPS = 18;

function agrupar<T, K extends string>(filas: T[], clave: (f: T) => K, orden: K[]) {
  const grupos = new Map<K, T[]>();
  for (const f of filas) grupos.set(clave(f), [...(grupos.get(clave(f)) ?? []), f]);
  return orden.filter((k) => grupos.has(k)).map((k) => [k, grupos.get(k)!] as const);
}

export async function ArbolElementos({ fincaId, nombre }: { fincaId: string; nombre: string }) {
  const { supabase } = await obtenerSesion();
  const [{ data: animales }, { data: bienes }] = await Promise.all([
    supabase.from("animales").select("id, chapeta, nombre, categoria").eq("finca_id", fincaId).eq("estado", "activo").order("nombre"),
    supabase.from("bienes").select("id, codigo, nombre, tipo, estado").eq("finca_id", fincaId).order("nombre"),
  ]);

  const gruposAnimales = agrupar(animales ?? [], (a) => a.categoria, ORDEN_CATEGORIAS);
  const gruposBienes = agrupar(bienes ?? [], (b) => b.tipo, Object.keys(TIPOS_BIEN) as (keyof typeof TIPOS_BIEN)[]);

  return (
    <Tarjeta className="sm:p-8">
      <div className="flex items-center gap-3 rounded-2xl bg-bosque p-5 font-bold text-leche">
        <Warehouse className="h-6 w-6" aria-hidden />
        <span className="font-display text-xl">{nombre}</span>
        <span className="ml-auto text-sm font-normal text-leche/75">
          {animales?.length ?? 0} seres vivos · {bienes?.length ?? 0} bienes
        </span>
      </div>

      <div className="ml-5 mt-4 space-y-4 border-l-2 border-dashed border-[#9eb386] pl-6">
        <div className="rounded-2xl bg-lima-suave p-4">
          <strong className="flex items-center gap-2 text-bosque">
            <PawPrint className="h-5 w-5" aria-hidden />
            Seres vivos ({animales?.length ?? 0})
          </strong>
          {gruposAnimales.length === 0 ? (
            <div className="mt-3">
              <Vacio>Sin seres vivos activos.</Vacio>
            </div>
          ) : (
            <div className="ml-3 mt-3 space-y-4 border-l-2 border-dashed border-[#9eb386] pl-5">
              {gruposAnimales.map(([categoria, lista]) => (
                <div key={categoria}>
                  <p className="mb-2 text-sm font-bold text-bosque">
                    {CATEGORIAS_PLURAL[categoria]} <span className="rounded-full bg-bosque px-2 text-xs text-leche">{lista.length}</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {lista.slice(0, MAX_CHIPS).map((a) => (
                      <Link key={a.id} href={`/animales/${a.id}`} className="rounded-xl bg-white px-3 py-2 text-sm shadow-sm hover:bg-lima">
                        <span className="font-mono text-xs text-tinta-suave">{a.chapeta ?? "s/c"}</span> <strong className="text-bosque">{a.nombre}</strong>
                      </Link>
                    ))}
                    {lista.length > MAX_CHIPS && (
                      <span className="rounded-xl border border-dashed border-bosque/30 px-3 py-2 text-sm text-tinta-suave">
                        +{lista.length - MAX_CHIPS} más
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-lima-suave p-4">
          <strong className="flex items-center gap-2 text-bosque">
            <Box className="h-5 w-5" aria-hidden />
            Bienes ({bienes?.length ?? 0})
          </strong>
          {gruposBienes.length === 0 ? (
            <div className="mt-3">
              <Vacio>Sin bienes registrados.</Vacio>
            </div>
          ) : (
            <div className="ml-3 mt-3 space-y-4 border-l-2 border-dashed border-[#9eb386] pl-5">
              {gruposBienes.map(([tipo, lista]) => (
                <div key={tipo}>
                  <p className="mb-2 text-sm font-bold text-bosque">
                    {TIPOS_BIEN_PLURAL[tipo]} <span className="rounded-full bg-bosque px-2 text-xs text-leche">{lista.length}</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {lista.map((b) => (
                      <Link key={b.id} href={`/bienes/${b.id}`} className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm shadow-sm hover:bg-lima">
                        <span
                          aria-label={ESTADOS_BIEN[b.estado].texto}
                          className={`h-2.5 w-2.5 rounded-full ${b.estado === "bueno" ? "bg-pasto" : b.estado === "malo" ? "bg-alerta" : "bg-dorado"}`}
                        />
                        <strong className="text-bosque">{b.nombre}</strong>
                        <span className="font-mono text-xs text-tinta-suave">{b.codigo}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Tarjeta>
  );
}

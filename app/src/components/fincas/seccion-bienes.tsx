import Link from "next/link";
import { puedeRegistrar } from "@/lib/permisos";
import { obtenerSesion } from "@/lib/sesion";
import { fecha, hoyISO } from "@/lib/formato";
import { consultarPagina, leerPagina, type Params } from "@/lib/paginacion";
import { Etiqueta, Tarjeta, TituloTarjeta, Vacio } from "@/components/ui";
import { Paginacion } from "@/components/paginacion";
import { ESTADOS_BIEN, TIPOS_BIEN } from "@/components/fincas/etiquetas";

const POR_PAGINA = 50;

export async function SeccionBienes({ fincaId, searchParams }: { fincaId: string; searchParams: Params }) {
  const { supabase, rol } = await obtenerSesion();
  const { filas: bienes, total, pagina } = await consultarPagina(
    (desde, hasta) =>
      supabase
        .from("bienes")
        .select("id, codigo, nombre, tipo, marca, estado, garantia_hasta, recordatorio", { count: "exact" })
        .eq("finca_id", fincaId)
        .order("codigo")
        .order("id")
        .range(desde, hasta),
    leerPagina(searchParams, { tamano: POR_PAGINA }),
  );
  const hoy = hoyISO();

  return (
    <Tarjeta id="bienes" className="scroll-mt-6">
      <TituloTarjeta
        detalle={
          puedeRegistrar(rol) && (
            <Link href={`/bienes/nuevo?finca=${fincaId}`} className="font-bold text-pasto-oscuro hover:underline">
              + Nueva ficha de bien
            </Link>
          )
        }
      >
        Bienes y equipos
      </TituloTarjeta>
      {!bienes.length ? (
        <Vacio>Esta finca aún no tiene bienes registrados.</Vacio>
      ) : (
        <div className="overflow-x-auto">
          <table className="matriz w-full border-collapse bg-white text-sm">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Marca</th>
                <th>Estado</th>
                <th>Garantía hasta</th>
                <th>Recordatorio</th>
              </tr>
            </thead>
            <tbody>
              {bienes.map((b) => (
                <tr key={b.id} className="hover:bg-lima-suave">
                  <td className="font-mono font-bold">
                    <Link href={`/bienes/${b.id}`} className="text-bosque hover:underline">
                      {b.codigo}
                    </Link>
                  </td>
                  <td className="!text-left">
                    <Link href={`/bienes/${b.id}`} className="font-bold text-bosque hover:underline">
                      {b.nombre}
                    </Link>
                  </td>
                  <td>{TIPOS_BIEN[b.tipo]}</td>
                  <td>{b.marca ?? "—"}</td>
                  <td>
                    <Etiqueta tono={ESTADOS_BIEN[b.estado].tono}>{ESTADOS_BIEN[b.estado].texto}</Etiqueta>
                  </td>
                  <td className={b.garantia_hasta && b.garantia_hasta < hoy ? "text-tinta-suave line-through" : undefined}>{fecha(b.garantia_hasta)}</td>
                  <td className="max-w-xs truncate !text-left text-tinta-suave">{b.recordatorio ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Paginacion
        ruta={`/fincas/${fincaId}`}
        searchParams={searchParams}
        pagina={pagina.pagina}
        tamano={pagina.tamano}
        total={total}
        unidad="bienes"
        etiqueta="Páginas de bienes"
        ancla="bienes"
      />
    </Tarjeta>
  );
}

import Link from "next/link";
import { puedeRegistrar } from "@/lib/permisos";
import { obtenerSesion } from "@/lib/sesion";
import { fecha, hoyISO } from "@/lib/formato";
import { Etiqueta, Tarjeta, TituloTarjeta, Vacio } from "@/components/ui";
import { ESTADOS_BIEN, TIPOS_BIEN } from "@/components/fincas/etiquetas";

export async function SeccionBienes({ fincaId }: { fincaId: string }) {
  const { supabase, rol } = await obtenerSesion();
  const { data: bienes } = await supabase
    .from("bienes")
    .select("id, codigo, nombre, tipo, marca, estado, garantia_hasta, recordatorio")
    .eq("finca_id", fincaId)
    .order("codigo");
  const hoy = hoyISO();

  return (
    <Tarjeta>
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
      {!bienes?.length ? (
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
    </Tarjeta>
  );
}

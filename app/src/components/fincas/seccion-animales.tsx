import Link from "next/link";
import { obtenerSesion } from "@/lib/sesion";
import { fecha, num } from "@/lib/formato";
import { Etiqueta, Tarjeta, TituloTarjeta, Vacio } from "@/components/ui";

export async function SeccionAnimales({ fincaId, corte }: { fincaId: string; corte: string }) {
  const { supabase } = await obtenerSesion();
  const [{ data: filas }, { data: otros }] = await Promise.all([
    supabase.rpc("estado_reproductivo", { p_finca: fincaId, p_corte: corte }),
    supabase
      .from("animales")
      .select("id, chapeta, nombre, categoria, sexo")
      .eq("finca_id", fincaId)
      .eq("estado", "activo")
      .or("sexo.eq.macho,categoria.not.in.(vaca,novilla)")
      .order("nombre"),
  ]);

  const animales = filas ?? [];

  return (
    <div className="space-y-6">
      <Tarjeta>
        <TituloTarjeta detalle={`${animales.length} vientres`}>Estado reproductivo y producción</TituloTarjeta>
        {animales.length === 0 ? (
          <Vacio>No hay vacas ni novillas activas en esta finca.</Vacio>
        ) : (
          <div className="overflow-x-auto">
            <table className="matriz w-full border-collapse bg-white text-sm">
              <thead>
                <tr>
                  <th>Chapeta</th>
                  <th>Nombre</th>
                  <th>Estado</th>
                  <th>Días ordeño</th>
                  <th>Preñada</th>
                  <th>Mora</th>
                  <th>Palpar el</th>
                  <th>Secar el</th>
                  <th>Parto esperado</th>
                  <th>Litros</th>
                </tr>
              </thead>
              <tbody>
                {animales.map((a) => {
                  const hoyToca = (f: string | null) => f != null && f <= corte;
                  return (
                    <tr key={a.animal_id} className="hover:bg-lima-suave">
                      <td className="font-mono font-bold">
                        <Link href={`/animales/${a.animal_id}`} className="text-bosque underline-offset-2 hover:underline">
                          {a.chapeta ?? a.codigo}
                        </Link>
                      </td>
                      <td className="!text-left">
                        <Link href={`/animales/${a.animal_id}`} className="font-bold text-bosque hover:underline">
                          {a.nombre}
                        </Link>
                      </td>
                      <td>
                        {a.en_ordeno ? (
                          <Etiqueta tono="verde">Ordeño</Etiqueta>
                        ) : a.ultimo_parto ? (
                          <Etiqueta tono="amarillo">Horra</Etiqueta>
                        ) : (
                          <Etiqueta tono="azul">Novilla</Etiqueta>
                        )}
                      </td>
                      <td>{a.dias_ordeno ?? (a.dias_seca != null ? <span className="text-tinta-suave">{a.dias_seca} secas</span> : "—")}</td>
                      <td>{a.prenada ? <Etiqueta tono="verde">Sí</Etiqueta> : a.ultimo_servicio ? <Etiqueta tono="gris">Servida</Etiqueta> : "No"}</td>
                      <td className={a.mora_prenez && a.mora_prenez > 60 ? "font-bold text-alerta" : undefined}>{a.mora_prenez || "—"}</td>
                      <td className={hoyToca(a.palpar_el) ? "font-bold text-alerta" : undefined}>{fecha(a.palpar_el)}</td>
                      <td className={a.en_ordeno && hoyToca(a.secar_el) ? "font-bold text-alerta" : undefined}>{fecha(a.secar_el)}</td>
                      <td>{fecha(a.parto_esperado)}</td>
                      <td className="font-bold">{a.litros_total ? num(a.litros_total) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>

      {(otros?.length ?? 0) > 0 && (
        <Tarjeta>
          <TituloTarjeta detalle={`${otros!.length} animales`}>Otros seres vivos</TituloTarjeta>
          <div className="flex flex-wrap gap-2">
            {otros!.map((a) => (
              <Link key={a.id} href={`/animales/${a.id}`} className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm hover:bg-lima-suave">
                <strong className="text-bosque">{a.nombre}</strong> <span className="text-tinta-suave">· {a.chapeta ?? a.categoria}</span>
              </Link>
            ))}
          </div>
        </Tarjeta>
      )}
    </div>
  );
}

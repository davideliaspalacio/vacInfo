import { fecha, num } from "@/lib/formato";
import { Etiqueta, Metrica, Vacio } from "@/components/ui";
import { GraficoCrecimiento, PESO_NACIMIENTO_KG } from "./grafico-crecimiento";
import { ESTADOS_LEVANTE, tonoGanancia, type EstadoLevante } from "./etiquetas";

export type PesajeFila = {
  id: string;
  fecha: string;
  peso_kg: number;
  altura_cm: number | null;
  condicion_corporal: number | null;
  observaciones: string | null;
};

type Reglas = { dias_destete: number; edad_servicio_meses: number; peso_servicio_kg: number };
type Levante = {
  estado: string;
  edad_meses: number | null;
  destetar_el: string | null;
  ganancia_diaria_g: number | null;
} | null;

const diasEntre = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86400000);

/** Pesajes, curva contra la meta y datos de destete de un animal de levante. */
export function SeccionCrecimiento({
  pesajes,
  nacimiento,
  fechaDestete,
  reglas,
  levante,
}: {
  pesajes: PesajeFila[];
  nacimiento: string | null;
  fechaDestete: string | null;
  reglas: Reglas;
  levante: Levante;
}) {
  const ordenados = [...pesajes].sort((a, b) => b.fecha.localeCompare(a.fecha));
  const ultimo = ordenados[0];
  const estado = levante && levante.estado in ESTADOS_LEVANTE ? ESTADOS_LEVANTE[levante.estado as EstadoLevante] : null;

  let metaHoy: number | null = null;
  if (ultimo && nacimiento) {
    const m = diasEntre(nacimiento, ultimo.fecha) / 30.4;
    metaHoy = Math.round(PESO_NACIMIENTO_KG + ((reglas.peso_servicio_kg - PESO_NACIMIENTO_KG) / reglas.edad_servicio_meses) * m);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Metrica valor={estado ? <Etiqueta tono={estado.tono}>{estado.texto}</Etiqueta> : "—"} etiqueta="Estado de levante" tono="crema" />
        <Metrica valor={levante?.edad_meses != null ? `${num(levante.edad_meses)} m` : "—"} etiqueta="Edad" tono="crema" />
        <Metrica
          valor={ultimo ? `${num(ultimo.peso_kg)} kg` : "—"}
          etiqueta={ultimo ? `Último pesaje ${fecha(ultimo.fecha)}${metaHoy ? ` · meta ${num(metaHoy)} kg` : ""}` : "Sin pesajes"}
          tono={ultimo && metaHoy && ultimo.peso_kg < metaHoy * 0.9 ? "alerta" : "lima"}
        />
        <Metrica
          valor={<span className={tonoGanancia(levante?.ganancia_diaria_g)}>{levante?.ganancia_diaria_g != null ? `${num(levante.ganancia_diaria_g)} g/d` : "—"}</span>}
          etiqueta="Ganancia diaria"
          tono="crema"
        />
        <Metrica
          valor={fechaDestete ? fecha(fechaDestete) : levante?.destetar_el ? fecha(levante.destetar_el) : "—"}
          etiqueta={fechaDestete ? "Destetada el" : levante?.destetar_el ? `Destetar el (a los ${reglas.dias_destete} días)` : "Destete"}
          tono={!fechaDestete && levante?.estado === "destetar" ? "alerta" : "crema"}
        />
      </div>

      {pesajes.length === 0 ? (
        <Vacio>Sin pesajes registrados. Regístralos desde Levante o en VacDaTa.</Vacio>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
          <GraficoCrecimiento
            nacimiento={nacimiento}
            pesajes={pesajes.map((p) => ({ fecha: p.fecha, peso_kg: Number(p.peso_kg) }))}
            pesoServicio={reglas.peso_servicio_kg}
            edadServicioMeses={reglas.edad_servicio_meses}
          />
          <div className="max-h-72 overflow-auto">
            <table className="matriz w-full border-collapse bg-white text-sm">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Peso</th>
                  <th>g/día</th>
                  <th>Altura</th>
                  <th>CC</th>
                </tr>
              </thead>
              <tbody>
                {ordenados.map((p, i) => {
                  const previo = ordenados[i + 1];
                  const g = previo ? Math.round(((p.peso_kg - previo.peso_kg) * 1000) / Math.max(diasEntre(previo.fecha, p.fecha), 1)) : null;
                  return (
                    <tr key={p.id} title={p.observaciones ?? undefined}>
                      <td>{fecha(p.fecha)}</td>
                      <td className="font-bold">{num(p.peso_kg)} kg</td>
                      <td className={tonoGanancia(g)}>{g ?? "—"}</td>
                      <td>{p.altura_cm != null ? `${num(p.altura_cm)} cm` : "—"}</td>
                      <td>{num(p.condicion_corporal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

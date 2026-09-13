"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { num } from "@/lib/formato";

export const PESO_NACIMIENTO_KG = 38;

type Pesaje = { fecha: string; peso_kg: number };

const dias = (desde: string, hasta: string) => Math.round((Date.parse(`${hasta}T12:00:00`) - Date.parse(`${desde}T12:00:00`)) / 86400000);
const meses = (d: number) => Math.round((d / 30.4) * 10) / 10;

/** Peso real por edad (meses) contra la meta lineal de 38 kg al nacer al peso de servicio. */
export function GraficoCrecimiento({
  nacimiento,
  pesajes,
  pesoServicio,
  edadServicioMeses,
}: {
  nacimiento: string | null;
  pesajes: Pesaje[];
  pesoServicio: number;
  edadServicioMeses: number;
}) {
  const origen = nacimiento ?? pesajes[0]?.fecha;
  if (!origen) return null;

  const reales = [...pesajes]
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((p) => ({ edad: meses(dias(origen, p.fecha)), peso: Number(p.peso_kg), fecha: p.fecha }));
  const ultimaEdad = reales.at(-1)?.edad ?? 0;
  const fin = Math.max(edadServicioMeses, Math.ceil(ultimaEdad));
  const pendiente = (pesoServicio - PESO_NACIMIENTO_KG) / edadServicioMeses;
  const meta = nacimiento
    ? [
        { edad: 0, meta: PESO_NACIMIENTO_KG },
        { edad: fin, meta: Math.round(PESO_NACIMIENTO_KG + pendiente * fin) },
      ]
    : [];

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart margin={{ top: 10, right: 16, bottom: 4, left: -8 }}>
          <CartesianGrid stroke="#dfe8d4" strokeDasharray="4 4" />
          <XAxis
            dataKey="edad"
            type="number"
            domain={[0, fin]}
            allowDuplicatedCategory={false}
            tickFormatter={(v: number) => `${num(v)} m`}
            tick={{ fontSize: 12, fill: "#52644d" }}
          />
          <YAxis tick={{ fontSize: 12, fill: "#52644d" }} unit=" kg" width={70} domain={[0, "auto"]} />
          <Tooltip
            labelFormatter={(v) => `${num(Number(v))} meses${nacimiento ? "" : " desde el primer pesaje"}`}
            formatter={(v, nombre) => [`${num(Number(v))} kg`, nombre]}
            contentStyle={{ borderRadius: 12, borderColor: "#cadba8" }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {meta.length > 0 && (
            <Line data={meta} dataKey="meta" name={`Meta (${num(pesoServicio)} kg a los ${edadServicioMeses} meses)`} stroke="#f4c95d" strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
          )}
          <Line data={reales} dataKey="peso" name="Peso registrado" stroke="#4f7a39" strokeWidth={3} dot={{ r: 4, fill: "#173f2a" }} activeDot={{ r: 6 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

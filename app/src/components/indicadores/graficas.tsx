"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatear, type Formato } from "./formato";

export type Punto = { etiqueta: string } & Record<string, string | number | null>;
export type Serie = { clave: string; nombre: string; color: string };

type Props = { datos: Punto[]; series: Serie[]; formato: Formato };

const EJE = { fontSize: 11, fill: "#52644d" };

function corto(v: number, formato: Formato) {
  if (formato === "pesos") return `$${Math.round(v).toLocaleString("es-CO")}`;
  if (formato === "pct") return `${Math.round(v * 100)} %`;
  return v.toLocaleString("es-CO", { maximumFractionDigits: 1 });
}

export function GraficaLineas({ datos, series, formato }: Props) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={datos} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid vertical={false} stroke="#e4e8df" />
          <XAxis dataKey="etiqueta" tick={EJE} />
          <YAxis tickFormatter={(v) => corto(Number(v), formato)} tick={EJE} width={formato === "pesos" ? 70 : 48} domain={formato === "pct" ? [0, 1] : ["auto", "auto"]} />
          <Tooltip formatter={(v) => formatear(v == null ? null : Number(v), formato)} labelStyle={{ fontWeight: 700 }} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {series.map((s) => (
            <Line
              key={s.clave}
              type="monotone"
              dataKey={s.clave}
              name={s.nombre}
              stroke={s.color}
              strokeWidth={2.5}
              dot={{ r: 3.5, fill: s.color }}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GraficaBarras({ datos, series, formato }: Props) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid vertical={false} stroke="#e4e8df" />
          <XAxis dataKey="etiqueta" tick={EJE} />
          <YAxis tickFormatter={(v) => corto(Number(v), formato)} tick={EJE} width={56} allowDecimals={formato !== "numero"} />
          <Tooltip formatter={(v) => formatear(v == null ? null : Number(v), formato)} labelStyle={{ fontWeight: 700 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {series.map((s) => (
            <Bar key={s.clave} dataKey={s.clave} name={s.nombre} fill={s.color} radius={[5, 5, 0, 0]} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fecha, num } from "@/lib/formato";

export type PuntoProduccion = { fecha: string; litros: number };

export function GraficoProduccion({ datos }: { datos: PuntoProduccion[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={datos} margin={{ top: 10, right: 16, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="#dfe8d4" strokeDasharray="4 4" />
          <XAxis dataKey="fecha" tickFormatter={(v: string) => fecha(v).slice(0, 5)} tick={{ fontSize: 12, fill: "#52644d" }} minTickGap={18} />
          <YAxis tick={{ fontSize: 12, fill: "#52644d" }} unit=" L" width={64} />
          <Tooltip
            labelFormatter={(v) => fecha(String(v), true)}
            formatter={(v) => [`${num(Number(v))} L`, "Leche del día"]}
            contentStyle={{ borderRadius: 12, borderColor: "#cadba8" }}
          />
          <Line type="monotone" dataKey="litros" stroke="#4f7a39" strokeWidth={3} dot={{ r: 3, fill: "#173f2a" }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

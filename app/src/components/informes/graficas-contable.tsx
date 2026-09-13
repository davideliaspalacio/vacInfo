"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const porcentaje = (v: number) => `${(v * 100).toLocaleString("es-CO", { maximumFractionDigits: 2 })}%`;
const millones = (v: number) => `$${(v / 1_000_000).toLocaleString("es-CO", { maximumFractionDigits: 1 })} M`;
const pesos = (v: number) => v.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export function GraficaCostosPct({ datos }: { datos: { categoria: string; pct: number }[] }) {
  const ordenados = [...datos].sort((a, b) => b.pct - a.pct);
  return (
    <div style={{ height: Math.max(260, ordenados.length * 28 + 40) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={ordenados} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 8 }}>
          <CartesianGrid horizontal={false} stroke="#e4e8df" />
          <XAxis type="number" tickFormatter={porcentaje} tick={{ fontSize: 11, fill: "#52644d" }} />
          <YAxis type="category" dataKey="categoria" width={160} tick={{ fontSize: 11, fill: "#182019" }} />
          <Tooltip formatter={(v) => porcentaje(Number(v))} labelStyle={{ fontWeight: 700 }} />
          <Bar dataKey="pct" name="% del ingreso" radius={[0, 6, 6, 0]} isAnimationActive={false}>
            {ordenados.map((d, i) => (
              <Cell key={d.categoria} fill={i === 0 ? "#a53b2b" : i < 3 ? "#f4c95d" : "#8fbf55"} />
            ))}
            <LabelList dataKey="pct" position="right" formatter={(v) => porcentaje(Number(v))} style={{ fontSize: 11, fill: "#182019" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GraficaFlujoCaja({ ingresos, pagos, saldo }: { ingresos: number; pagos: number; saldo: number }) {
  const datos = [
    { nombre: "Ingresos", valor: ingresos, color: "#8fbf55" },
    { nombre: "Pagos", valor: pagos, color: "#f4c95d" },
    { nombre: "Saldo", valor: saldo, color: saldo < 0 ? "#a53b2b" : "#173f2a" },
  ];
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} margin={{ top: 20, right: 8, bottom: 4, left: 8 }}>
          <CartesianGrid vertical={false} stroke="#e4e8df" />
          <XAxis dataKey="nombre" tick={{ fontSize: 12, fill: "#182019" }} />
          <YAxis tickFormatter={millones} tick={{ fontSize: 11, fill: "#52644d" }} width={64} />
          <Tooltip formatter={(v) => pesos(Number(v))} />
          <Bar dataKey="valor" radius={[6, 6, 0, 0]} isAnimationActive={false}>
            {datos.map((d) => (
              <Cell key={d.nombre} fill={d.color} />
            ))}
            <LabelList dataKey="valor" position="top" formatter={(v) => millones(Number(v))} style={{ fontSize: 11 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GraficaPagos({ datos }: { datos: { categoria: string; mes: number }[] }) {
  return (
    <div style={{ height: Math.max(240, datos.length * 26 + 40) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} layout="vertical" margin={{ top: 4, right: 64, bottom: 4, left: 8 }}>
          <CartesianGrid horizontal={false} stroke="#e4e8df" />
          <XAxis type="number" tickFormatter={millones} tick={{ fontSize: 11, fill: "#52644d" }} />
          <YAxis type="category" dataKey="categoria" width={160} tick={{ fontSize: 11, fill: "#182019" }} />
          <Tooltip formatter={(v) => pesos(Number(v))} />
          <Bar dataKey="mes" name="Pagos del mes" fill="#1d5136" radius={[0, 6, 6, 0]} isAnimationActive={false}>
            <LabelList dataKey="mes" position="right" formatter={(v) => millones(Number(v))} style={{ fontSize: 11 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

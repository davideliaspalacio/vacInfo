import clsx from "clsx";
import { fecha, num } from "@/lib/formato";
import { Etiqueta } from "@/components/ui";
import { ETIQUETA_CATEGORIA, type CategoriaInsumo } from "./opciones";

export type Saldo = {
  insumo_id: string | null;
  producto: string;
  categoria: CategoriaInsumo | null;
  unidad: string;
  ingresos: number;
  salidas: number;
  consumo_registrado: number;
  consumo_automatico: number;
  saldo: number;
  consumo_diario: number | null;
  dias_alcanza: number | null;
  stock_minimo: number | null;
  ultimo_ingreso: string | null;
  estado: string;
};

const ESTADO = {
  ok: { tono: "verde", texto: "Al día" },
  bajo: { tono: "amarillo", texto: "Bajo" },
  agotado: { tono: "rojo", texto: "Agotado" },
} as const;

/** La barra se llena a los 30 días. */
const ESCALA_DIAS = 30;

export function TablaSaldos({ saldos }: { saldos: Saldo[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[880px] text-sm">
        <thead>
          <tr className="border-b-2 border-bosque text-left text-xs uppercase text-tinta-suave">
            <th className="py-2 pr-2">Producto</th>
            <th className="px-2 py-2">Categoría</th>
            <th className="px-2 py-2 text-right">Saldo</th>
            <th className="px-2 py-2 text-right">Consumo diario</th>
            <th className="px-2 py-2">Días que alcanza</th>
            <th className="px-2 py-2 text-right">Mínimo</th>
            <th className="px-2 py-2">Último ingreso</th>
            <th className="py-2 pl-2">Estado</th>
          </tr>
        </thead>
        <tbody>
          {saldos.map((s) => {
            const estado = ESTADO[s.estado as keyof typeof ESTADO] ?? ESTADO.ok;
            const dias = s.dias_alcanza;
            const automatico = Number(s.consumo_automatico) > 0;
            return (
              <tr key={s.insumo_id ?? s.producto} className={clsx("border-b border-tinta/10", s.estado === "agotado" && "bg-[#fbe9e5]/60")}>
                <td className="py-2.5 pr-2">
                  <span className="font-bold text-bosque">{s.producto}</span>
                  {!s.insumo_id && <span className="block text-xs text-tinta-suave">Fuera del catálogo</span>}
                </td>
                <td className="px-2 py-2.5">{s.categoria ? ETIQUETA_CATEGORIA[s.categoria] : "—"}</td>
                <td className="px-2 py-2.5 text-right tabular-nums">
                  <strong className={clsx(s.saldo <= 0 && "text-alerta")}>
                    {num(s.saldo)} {s.unidad}
                  </strong>
                  <span className="block text-xs text-tinta-suave" title="Ingresos − salidas − consumo diario registrado − consumo automático">
                    +{num(s.ingresos)} −{num(s.salidas)}
                    {s.consumo_registrado > 0 && ` −${num(s.consumo_registrado)} consumo`}
                  </span>
                  {automatico && <span className="block text-xs font-bold text-indigo-800">−{num(s.consumo_automatico)} automático</span>}
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums">
                  {s.consumo_diario ? `${num(s.consumo_diario)} / día` : "—"}
                  {automatico && <span className="block text-xs text-indigo-800">incluye consumo automático</span>}
                </td>
                <td className="px-2 py-2.5">
                  {dias == null ? (
                    <span className="text-tinta-suave">Sin consumo reciente</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-28 overflow-hidden rounded-full bg-black/10" aria-hidden>
                        <div
                          className={clsx("h-full rounded-full", dias < 3 ? "bg-alerta" : dias < 7 ? "bg-dorado" : "bg-pasto")}
                          style={{ width: `${Math.max(3, Math.min(dias / ESCALA_DIAS, 1) * 100)}%` }}
                        />
                      </div>
                      <span className={clsx("tabular-nums font-bold", dias < 3 ? "text-alerta" : dias < 7 ? "text-[#6b4a09]" : "text-bosque")}>
                        {num(dias)} días
                      </span>
                    </div>
                  )}
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums">{s.stock_minimo == null ? "—" : num(s.stock_minimo)}</td>
                <td className="px-2 py-2.5">{fecha(s.ultimo_ingreso)}</td>
                <td className="py-2.5 pl-2">
                  <Etiqueta tono={estado.tono}>{estado.texto}</Etiqueta>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

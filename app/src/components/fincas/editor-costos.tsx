"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Info, Lock, Plus, Trash2 } from "lucide-react";
import { calcularInforme, type ConteoAnimales, type Estado, type ParametrosCostos } from "@/lib/finanzas";
import { fecha, litros, num, pct, pesos } from "@/lib/formato";
import { BotonPrimario, Etiqueta, Tarjeta, TituloTarjeta } from "@/components/ui";
import { MensajeError, type EstadoFormulario } from "@/components/fincas/campo";

const TONO_ESTADO: Record<Estado, "verde" | "amarillo" | "rojo"> = { RENTABLE: "verde", AJUSTADA: "amarillo", "EN RIESGO": "rojo" };

const ANIMALES: { clave: keyof ConteoAnimales; texto: string }[] = [
  { clave: "vacas_produccion", texto: "Vacas en ordeño" },
  { clave: "vacas_secas", texto: "Vacas secas" },
  { clave: "novillas", texto: "Novillas" },
  { clave: "terneras", texto: "Terneras" },
  { clave: "terneros", texto: "Terneros" },
  { clave: "novillos", texto: "Novillos" },
  { clave: "toros", texto: "Toros" },
  { clave: "caballos", texto: "Caballos" },
  { clave: "perros", texto: "Perros" },
  { clave: "otros", texto: "Otros" },
];

const LITROS: { clave: keyof ParametrosCostos["litros_dia"]; texto: string }[] = [
  { clave: "venta", texto: "Para la venta" },
  { clave: "terneras", texto: "Para terneras" },
  { clave: "consumo_humano", texto: "Consumo humano" },
];

function Numero({
  valor,
  onCambio,
  etiqueta,
  className = "",
}: {
  valor: number;
  onCambio: (v: number) => void;
  etiqueta: string;
  className?: string;
}) {
  return (
    <input
      type="number"
      min={0}
      step="any"
      inputMode="decimal"
      aria-label={etiqueta}
      value={Number.isFinite(valor) && valor !== 0 ? valor : ""}
      placeholder="0"
      onChange={(e) => onCambio(e.target.value === "" ? 0 : Math.max(0, Number(e.target.value)))}
      className={`campo-control text-right tabular-nums ${className}`}
    />
  );
}

export function EditorCostos({
  inicial,
  editable,
  accion,
  fincaId,
  fechaConteo,
}: {
  /** `inicial.animales` ya trae el conteo real de la finca a `fechaConteo`. */
  inicial: ParametrosCostos;
  editable: boolean;
  accion: (estado: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;
  fincaId: string;
  fechaConteo: string;
}) {
  const [p, setP] = useState<ParametrosCostos>(inicial);
  const [estado, enviar, pendiente] = useActionState(accion, {});
  const informe = useMemo(() => calcularInforme(p), [p]);

  const cambiarItem = (ci: number, ii: number, cambio: Partial<ParametrosCostos["costos"][number]["items"][number]>) =>
    setP((prev) => ({
      ...prev,
      costos: prev.costos.map((c, i) => (i !== ci ? c : { ...c, items: c.items.map((it, j) => (j === ii ? { ...it, ...cambio } : it)) })),
    }));

  const agregarItem = (ci: number) =>
    setP((prev) => ({ ...prev, costos: prev.costos.map((c, i) => (i === ci ? { ...c, items: [...c.items, { nombre: "", mes: 0 }] } : c)) }));

  const quitarItem = (ci: number, ii: number) =>
    setP((prev) => ({ ...prev, costos: prev.costos.map((c, i) => (i === ci ? { ...c, items: c.items.filter((_, j) => j !== ii) } : c)) }));

  return (
    <form action={enviar} className="grid items-start gap-6 xl:grid-cols-[1fr_380px]">
      <input type="hidden" name="datos" value={JSON.stringify(p)} />

      <fieldset disabled={!editable || pendiente} className="min-w-0 space-y-6">
        <Tarjeta>
          <TituloTarjeta>Precio y valorización</TituloTarjeta>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-bosque">Precio por litro (COP)</span>
              <Numero etiqueta="Precio por litro" valor={p.precio_litro} onCambio={(v) => setP({ ...p, precio_litro: v })} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-bosque">Valorización mensual por animal de levante</span>
              <Numero
                etiqueta="Valorización mensual por animal"
                valor={p.valorizacion_mensual_por_animal}
                onCambio={(v) => setP({ ...p, valorizacion_mensual_por_animal: v })}
              />
            </label>
          </div>
        </Tarjeta>

        <Tarjeta aria-labelledby="animales-costos">
          <TituloTarjeta detalle={`${num(informe.totalAnimales)} en total al ${fecha(fechaConteo)}`}>
            <span id="animales-costos" className="inline-flex items-center gap-2">
              Animales <Lock className="h-4 w-4 text-tinta-suave" aria-label="No editable" />
            </span>
          </TituloTarjeta>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {ANIMALES.map(({ clave, texto }) => (
              <div key={clave} className="rounded-xl border border-[#cadba8] bg-lima-suave px-3 py-2">
                <dt className="text-xs font-bold text-tinta-suave">{texto}</dt>
                <dd className="font-display text-xl font-bold tabular-nums text-bosque">{num(informe.animales[clave])}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 flex gap-2 rounded-xl bg-crema p-3 text-sm text-tinta-suave">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-pasto-oscuro" aria-hidden />
            <span>
              Se calculan con las fichas de la finca al {fecha(fechaConteo, true)} (cierre del mes o fecha de corte). Para cambiar la cantidad de
              animales: registra la muerte o venta en la ficha del animal (
              <Link href={`/fincas/${fincaId}`} className="font-bold text-bosque underline">
                Gestionar fincas
              </Link>
              ) o desde{" "}
              <Link href="/campo" className="font-bold text-bosque underline">
                VacDaTa
              </Link>
              ; para agregar, crea la ficha en Gestionar fincas ›{" "}
              <Link href={`/animales/nuevo?finca=${fincaId}`} className="font-bold text-bosque underline">
                Nueva ficha de ser vivo
              </Link>
              .
            </span>
          </p>
        </Tarjeta>

        <Tarjeta>
          <TituloTarjeta detalle={litros(informe.litrosDia)}>Litros por día</TituloTarjeta>
          <div className="grid gap-4 sm:grid-cols-3">
            {LITROS.map(({ clave, texto }) => (
              <label key={clave} className="block">
                <span className="mb-1.5 block text-sm font-bold text-bosque">{texto}</span>
                <Numero etiqueta={texto} valor={p.litros_dia[clave]} onCambio={(v) => setP({ ...p, litros_dia: { ...p.litros_dia, [clave]: v } })} />
              </label>
            ))}
          </div>
        </Tarjeta>

        <Tarjeta>
          <TituloTarjeta detalle={`${pesos(informe.costosMes)} / mes`}>Costos mensuales por categoría</TituloTarjeta>
          <div className="space-y-3">
            {p.costos.map((c, ci) => {
              const total = informe.categorias[ci];
              return (
                <details key={c.categoria} className="group rounded-2xl border border-black/10 bg-white" open={ci === 0}>
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
                    <ChevronDown className="h-4 w-4 shrink-0 text-tinta-suave transition group-open:rotate-180" aria-hidden />
                    <strong className="flex-1 text-bosque">{c.categoria}</strong>
                    <span className="text-xs text-tinta-suave">{c.items.length} ítems</span>
                    <span className="w-32 text-right font-bold tabular-nums text-bosque">{pesos(total?.totalMes ?? 0)}</span>
                    <span className="hidden w-16 text-right text-xs tabular-nums text-tinta-suave sm:inline">{pct(total?.pct ?? 0)}</span>
                  </summary>
                  <div className="space-y-2 border-t border-black/5 px-4 py-3">
                    {c.items.length > 0 && (
                      <div className="hidden grid-cols-[1fr_160px_110px_36px] gap-2 text-xs font-bold uppercase tracking-wider text-tinta-suave sm:grid">
                        <span>Ítem</span>
                        <span className="text-right">Valor mes</span>
                        <span className="text-center">No sale de caja</span>
                        <span />
                      </div>
                    )}
                    {c.items.map((it, ii) => (
                      <div key={ii} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_160px_110px_36px] sm:items-center">
                        <input
                          aria-label="Nombre del ítem"
                          value={it.nombre}
                          required
                          placeholder="Nombre del ítem"
                          onChange={(e) => cambiarItem(ci, ii, { nombre: e.target.value })}
                          className="campo-control col-span-2 py-2 sm:col-span-1"
                        />
                        <Numero etiqueta={`Valor mensual de ${it.nombre || "ítem"}`} valor={it.mes} onCambio={(v) => cambiarItem(ci, ii, { mes: v })} className="py-2" />
                        <label className="flex items-center justify-center gap-2 text-sm text-tinta-suave">
                          <input
                            type="checkbox"
                            checked={it.caja === false}
                            onChange={(e) => cambiarItem(ci, ii, { caja: e.target.checked ? false : undefined })}
                            className="h-4 w-4 accent-[#173f2a]"
                          />
                          <span className="sm:sr-only">No sale de caja</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => quitarItem(ci, ii)}
                          className="justify-self-end rounded-lg p-2 text-tinta-suave hover:bg-[#fbe9e5] hover:text-alerta disabled:hidden"
                          aria-label={`Quitar ${it.nombre || "ítem"}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => agregarItem(ci)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-bold text-pasto-oscuro hover:bg-lima-suave disabled:hidden"
                    >
                      <Plus className="h-4 w-4" aria-hidden />
                      Agregar ítem
                    </button>
                  </div>
                </details>
              );
            })}
          </div>
        </Tarjeta>
      </fieldset>

      <aside className="space-y-4 xl:sticky xl:top-24">
        <Tarjeta>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-xl font-bold text-bosque">Vista previa</h2>
            <Etiqueta tono={TONO_ESTADO[informe.estado]}>{informe.estado}</Etiqueta>
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <Fila etiqueta="Ingresos del mes" valor={pesos(informe.ingresosMes)} />
            <Fila etiqueta="Costos del mes" valor={pesos(informe.costosMes)} />
            <Fila etiqueta="Utilidad" valor={pesos(informe.utilidadMes)} fuerte negativo={informe.utilidadMes < 0} />
            <Fila etiqueta="Margen" valor={pct(informe.margen)} fuerte negativo={informe.margen < 0} />
          </dl>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#dfe8d4]" aria-hidden>
            <div
              className={`h-full rounded-full ${informe.estado === "RENTABLE" ? "bg-pasto" : informe.estado === "AJUSTADA" ? "bg-dorado" : "bg-alerta"}`}
              style={{ width: `${Math.min(100, Math.max(2, (informe.margen / 0.16) * 100))}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-tinta-suave">Rentable ≥ 8 % · Ajustada ≥ 3 % · En riesgo por debajo</p>

          <dl className="mt-5 space-y-2 border-t border-black/5 pt-4 text-sm">
            <Fila etiqueta="Costo por litro" valor={pesos(informe.costoLitro)} />
            <Fila etiqueta="Utilidad por litro" valor={pesos(informe.utilidadLitro)} negativo={informe.utilidadLitro < 0} />
            <Fila etiqueta="Punto de equilibrio" valor={`${num(Math.round(informe.puntoEquilibrioLitros))} L/día`} />
            <Fila etiqueta="Margen sobre equilibrio" valor={`${num(Math.round(informe.margenEquilibrioLitros))} L/día`} negativo={informe.margenEquilibrioLitros < 0} />
            <Fila etiqueta="Promedio por vaca" valor={litros(informe.promedioVaca)} />
            {informe.mayorCosto && <Fila etiqueta="Mayor costo" valor={`${informe.mayorCosto.categoria} (${pct(informe.mayorCosto.pct)})`} />}
          </dl>

          <dl className="mt-5 space-y-2 border-t border-black/5 pt-4 text-sm">
            <Fila etiqueta="Con valorización de levante" valor={pesos(informe.utilidadTotalMes)} />
            <Fila etiqueta="Margen con levante" valor={<Etiqueta tono={TONO_ESTADO[informe.estadoTotal]}>{pct(informe.margenTotal)}</Etiqueta>} />
            <Fila etiqueta="Saldo de caja" valor={pesos(informe.caja.saldo)} negativo={informe.caja.saldo < 0} />
            <Fila etiqueta="Margen de caja" valor={<Etiqueta tono={TONO_ESTADO[informe.caja.estado]}>{pct(informe.caja.margen)}</Etiqueta>} />
          </dl>

          {editable && (
            <div className="mt-6 space-y-3">
              <MensajeError>{estado.mensaje}</MensajeError>
              <BotonPrimario disabled={pendiente} className="w-full">
                {pendiente ? "Guardando…" : "Guardar parámetros"}
              </BotonPrimario>
            </div>
          )}
        </Tarjeta>
      </aside>
    </form>
  );
}

function Fila({ etiqueta, valor, fuerte, negativo }: { etiqueta: string; valor: React.ReactNode; fuerte?: boolean; negativo?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-tinta-suave">{etiqueta}</dt>
      <dd className={`text-right tabular-nums ${fuerte ? "font-display text-lg font-bold" : "font-bold"} ${negativo ? "text-alerta" : "text-bosque"}`}>{valor}</dd>
    </div>
  );
}

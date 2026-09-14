"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { CircleCheck, Download, MapPin } from "lucide-react";
import { TarjetaCampo, Titulo } from "@/components/campo/ui";
import {
  CLAVE_FINCA,
  actualizarAnimalLocal,
  descargarCatalogo,
  descargarFincas,
  descartar,
  elegirFinca,
  encolar,
  leerCatalogo,
  reintentar,
} from "@/lib/offline/cliente";
import { fechaHora } from "@/lib/offline/resumen";
import type { Accion, AnimalCatalogo, Catalogo, RegistroCola } from "@/lib/offline/tipos";
import { AnimalRapido } from "./animal-rapido";
import { BarraEstado } from "./barra-estado";
import { FormulariosFinca } from "./formularios-finca";
import { useCola, useEnLinea, useFincas, useLocal, useSincronizacion } from "./hooks";
import { OrdenoLista } from "./ordeno-lista";
import { Pendientes } from "./pendientes";

const VISTAS = [
  { id: "animal", etiqueta: "Animal" },
  { id: "lista", etiqueta: "Ordeño por lista" },
  { id: "finca", etiqueta: "Finca" },
  { id: "pendientes", etiqueta: "Pendientes" },
] as const;
type Vista = (typeof VISTAS)[number]["id"];

const SEIS_HORAS = 6 * 60 * 60 * 1000;

/** Registro de VacDaTa: todo se guarda en el teléfono y se envía cuando hay señal. */
export function Registro() {
  const parametros = useSearchParams();
  const fincaEnlace = parametros.get("finca");
  const animalEnlace = parametros.get("animal");

  const enLinea = useEnLinea();
  const { cola, historial } = useCola();
  const sync = useSincronizacion();
  const { ejecutar } = sync;
  const fincas = useFincas();
  const fincaId = useLocal(CLAVE_FINCA);

  const [vista, setVista] = useState<Vista>(() => VISTAS.find((v) => v.id === parametros.get("vista"))?.id ?? "animal");
  const [cambiandoFinca, setCambiandoFinca] = useState(false);
  const [cargado, setCargado] = useState<{ finca: string; catalogo: Catalogo | null } | null>(null);
  const [descarga, setDescarga] = useState<{ activa: boolean; error?: string }>({ activa: false });
  const [aviso, setAviso] = useState<{ id: number; texto: string } | null>(null);
  const enlaceAplicado = useRef(false);

  const catalogo = cargado && cargado.finca === fincaId ? cargado.catalogo : undefined;
  const finca = catalogo?.finca ?? fincas.find((f) => f.id === fincaId);

  const descargar = useCallback(async (id: string) => {
    setDescarga({ activa: true });
    try {
      setCargado({ finca: id, catalogo: await descargarCatalogo(id) });
      setDescarga({ activa: false });
    } catch (e) {
      setDescarga({ activa: false, error: e instanceof Error ? e.message : "No se pudieron descargar los datos." });
    }
  }, []);

  // Un enlace con ?finca= (p. ej. desde la ficha de un animal) elige esa finca una sola vez.
  useEffect(() => {
    if (enlaceAplicado.current || !fincaEnlace || !fincas.some((f) => f.id === fincaEnlace)) return;
    enlaceAplicado.current = true;
    if (fincaEnlace !== fincaId) elegirFinca(fincaEnlace);
  }, [fincaEnlace, fincas, fincaId]);

  useEffect(() => {
    if (!fincaId) return;
    let vivo = true;
    leerCatalogo(fincaId)
      .catch(() => undefined)
      .then((c) => {
        if (!vivo) return;
        setCargado({ finca: fincaId, catalogo: c ?? null });
        const viejo = !c || Date.now() - new Date(c.descargado_en).getTime() > SEIS_HORAS;
        if (viejo && navigator.onLine) void descargar(fincaId);
      });
    return () => {
      vivo = false;
    };
  }, [fincaId, descargar]);

  useEffect(() => {
    if (enLinea && fincas.length === 0) descargarFincas().catch(() => undefined);
  }, [enLinea, fincas.length]);

  useEffect(() => {
    if (!fincaId && fincas.length === 1) elegirFinca(fincas[0].id);
  }, [fincaId, fincas]);

  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), 4000);
    return () => window.clearTimeout(t);
  }, [aviso]);

  const guardar = useCallback(
    async (accion: Accion, datos: Record<string, unknown>, animal?: AnimalCatalogo) => {
      if (!fincaId) throw new Error("Sin finca");
      await encolar(accion, datos, fincaId, animal);
      if (animal && (accion === "destete" || accion === "baja")) {
        const cambios = accion === "baja" ? null : { fecha_destete: String(datos.fecha) };
        const nuevo = await actualizarAnimalLocal(fincaId, animal.id, cambios).catch(() => undefined);
        if (nuevo) setCargado({ finca: fincaId, catalogo: nuevo });
      }
      setAviso({ id: Date.now(), texto: "Guardado en el teléfono" });
      void ejecutar("evento");
    },
    [fincaId, ejecutar],
  );

  function alDescartar(registro: RegistroCola) {
    if (window.confirm(`¿Descartar «${registro.resumen}»? No se enviará y no se puede recuperar.`)) void descartar(registro.cliente_id);
  }

  async function alReintentar(ids: string[]) {
    await reintentar(ids);
    void ejecutar("manual");
  }

  const errores = cola.filter((r) => r.estado === "error").length;
  const elegir = !fincaId || cambiandoFinca || (fincas.length > 0 && !finca);

  return (
    <>
      <BarraEstado
        enLinea={enLinea}
        pendientes={cola.length}
        errores={errores}
        sincronizando={sync.sincronizando}
        problema={sync.problema}
        ultimoSync={sync.ultimoSync}
        alSincronizar={() => void ejecutar("manual")}
      />

      {elegir ? (
        <TarjetaCampo>
          <Titulo kicker="Registrar" titulo="¿En qué finca estás?" descripcion="Los datos de la finca quedan guardados en el teléfono para anotar con o sin señal." />
          {fincas.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-center text-slate-500">
              {enLinea ? "Buscando tus fincas…" : "Conéctate a internet una vez para descargar tus fincas."}
            </p>
          ) : (
            <div className="space-y-3">
              {fincas.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    elegirFinca(f.id);
                    setCambiandoFinca(false);
                  }}
                  className={clsx(
                    "flex min-h-[72px] w-full items-center gap-4 rounded-2xl border p-4 text-left",
                    f.id === fincaId ? "border-campo bg-blue-50" : "border-slate-200 bg-white",
                  )}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-campo-oscuro">
                    <MapPin className="h-[22px] w-[22px]" aria-hidden />
                  </span>
                  <span>
                    <span className="block text-lg font-bold text-slate-800">{f.nombre}</span>
                    {f.municipio && <span className="text-sm text-slate-500">{f.municipio}</span>}
                  </span>
                </button>
              ))}
            </div>
          )}
        </TarjetaCampo>
      ) : (
        <>
          <section className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="flex min-w-0 items-center gap-2 text-lg font-bold text-campo-oscuro">
                <MapPin className="h-5 w-5 shrink-0" aria-hidden />
                <span className="truncate">{finca?.nombre}</span>
              </p>
              {fincas.length > 1 && (
                <button type="button" onClick={() => setCambiandoFinca(true)} className="min-h-11 shrink-0 text-sm font-bold text-campo underline underline-offset-4">
                  Cambiar finca
                </button>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {catalogo ? `Datos del ${fechaHora(catalogo.descargado_en)} · ${catalogo.animales.length} animales` : "Sin datos descargados"}
            </p>
            {descarga.error && <p className="mt-1 text-sm font-semibold text-red-700">{descarga.error}</p>}
            <button
              type="button"
              onClick={() => fincaId && void descargar(fincaId)}
              disabled={!enLinea || descarga.activa}
              className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-campo bg-white font-bold text-campo-oscuro disabled:border-slate-200 disabled:text-slate-400"
            >
              <Download className={clsx("h-5 w-5", descarga.activa && "animate-bounce")} aria-hidden />
              {descarga.activa ? "Descargando…" : enLinea ? "Actualizar datos de la finca" : "Actualizar datos (necesita señal)"}
            </button>
          </section>

          <nav aria-label="Tipo de registro" className="mb-4 grid grid-cols-4 gap-1 rounded-2xl bg-slate-100 p-1">
            {VISTAS.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setVista(v.id)}
                aria-pressed={vista === v.id}
                className={clsx(
                  "min-h-12 rounded-xl px-1 text-[13px] font-bold leading-tight",
                  vista === v.id ? "bg-white text-campo-oscuro shadow-sm" : "text-slate-600",
                )}
              >
                {v.etiqueta}
                {v.id === "pendientes" && cola.length > 0 && <span className="ml-1 rounded-full bg-amber-200 px-1.5 text-amber-900">{cola.length}</span>}
              </button>
            ))}
          </nav>

          <TarjetaCampo>
            {vista === "pendientes" ? (
              <Pendientes cola={cola} historial={historial} alReintentar={alReintentar} alDescartar={alDescartar} />
            ) : vista === "finca" && fincaId ? (
              <FormulariosFinca fincaId={fincaId} catalogo={catalogo ?? null} alGuardar={(accion, datos) => guardar(accion, datos)} />
            ) : catalogo === undefined ? (
              <p className="p-5 text-center text-slate-500">Cargando datos del teléfono…</p>
            ) : catalogo === null ? (
              <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-center text-slate-500">
                {enLinea ? "Descargando los animales de la finca…" : "Aún no hay animales guardados en este teléfono. Descárgalos cuando tengas señal."}
              </p>
            ) : vista === "lista" ? (
              <OrdenoLista catalogo={catalogo} alGuardar={(accion, datos) => guardar(accion, datos)} />
            ) : (
              <AnimalRapido key={catalogo.finca_id} catalogo={catalogo} animalInicial={animalEnlace} alGuardar={guardar} />
            )}
          </TarjetaCampo>
        </>
      )}

      {aviso && (
        <p
          key={aviso.id}
          role="status"
          className="fixed inset-x-3 bottom-24 z-40 mx-auto flex max-w-[496px] items-center gap-3 rounded-2xl bg-emerald-600 p-4 text-lg font-bold text-white shadow-xl"
        >
          <CircleCheck className="h-6 w-6 shrink-0" aria-hidden />
          {aviso.texto}
          {!enLinea && <span className="text-sm font-semibold text-emerald-100">Se enviará cuando haya señal</span>}
        </p>
      )}
    </>
  );
}

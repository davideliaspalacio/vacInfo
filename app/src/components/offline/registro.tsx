"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { CircleCheck, CloudOff, RefreshCw, MapPin } from "lucide-react";
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
import { indiceOrdenos } from "@/lib/offline/ordenos";
import { fechaHora } from "@/lib/offline/resumen";
import type { Accion, AnimalCatalogo, Catalogo, RegistroCola } from "@/lib/offline/tipos";
import { AnimalRapido } from "./animal-rapido";
import { BarraEstado } from "./barra-estado";
import { FormulariosFinca } from "./formularios-finca";
import { useCola, useEnLinea, useEscribiendo, useFincas, useLocal, useSincronizacion } from "./hooks";
import { OrdenoLista } from "./ordeno-lista";
import { TIC_REFRESCO, tocaRefrescar } from "./refresco";

// El cliente quitó la pestaña «Pendientes»: lo que falta por enviar y lo que falló se ve en la
// barra de estado de arriba (ver `barra-estado.tsx`), que es el único aviso.
const VISTAS = [
  { id: "animal", etiqueta: "Animal" },
  { id: "lista", etiqueta: "Ordeño por lista" },
  { id: "finca", etiqueta: "Finca" },
] as const;
type Vista = (typeof VISTAS)[number]["id"];

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
  const estaEscribiendo = useEscribiendo();

  const [vista, setVista] = useState<Vista>(() => VISTAS.find((v) => v.id === parametros.get("vista"))?.id ?? "animal");
  const [cambiandoFinca, setCambiandoFinca] = useState(false);
  const [cargado, setCargado] = useState<{ finca: string; catalogo: Catalogo | null } | null>(null);
  const [descarga, setDescarga] = useState<{ activa: boolean; error?: string }>({ activa: false });
  const [aviso, setAviso] = useState<{ id: number; texto: string } | null>(null);
  const enlaceAplicado = useRef(false);
  // Refs (no estado) para que el reloj del refresco no se reinicie en cada render.
  const descargando = useRef(false);
  // El intento se guarda con su finca: al cambiar de finca hay que bajar el catálogo de una.
  const ultimoIntento = useRef<{ finca: string; en: number }>({ finca: "", en: 0 });
  const ultimasFincas = useRef(0);

  const catalogo = cargado && cargado.finca === fincaId ? cargado.catalogo : undefined;
  const finca = catalogo?.finca ?? fincas.find((f) => f.id === fincaId);
  // Ordeños que el teléfono ya conoce: lo descargado de la finca, lo que sigue en la cola y lo ya enviado (funciona sin señal).
  const indiceDeOrdenos = useMemo(() => indiceOrdenos([...cola, ...historial], catalogo), [cola, historial, catalogo]);

  const descargar = useCallback(async (id: string) => {
    // Candado: dos disparos a la vez (reloj + volver a primer plano) no bajan el catálogo dos veces.
    if (descargando.current) return;
    descargando.current = true;
    ultimoIntento.current = { finca: id, en: Date.now() };
    setDescarga({ activa: true });
    try {
      setCargado({ finca: id, catalogo: await descargarCatalogo(id) });
      setDescarga({ activa: false });
    } catch (e) {
      setDescarga({ activa: false, error: e instanceof Error ? e.message : "No se pudieron descargar los datos." });
    } finally {
      descargando.current = false;
    }
  }, []);

  // Un enlace con ?finca= (p. ej. desde la ficha de un animal) elige esa finca una sola vez.
  useEffect(() => {
    if (enlaceAplicado.current || !fincaEnlace || !fincas.some((f) => f.id === fincaEnlace)) return;
    enlaceAplicado.current = true;
    if (fincaEnlace !== fincaId) elegirFinca(fincaEnlace);
  }, [fincaEnlace, fincas, fincaId]);

  useEffect(() => {
    // Primero lo que ya hay en el teléfono (funciona sin señal). Si toca bajarlo otra vez lo
    // decide el refresco automático de más abajo, no esta lectura.
    if (!fincaId) return;
    let vivo = true;
    leerCatalogo(fincaId)
      .catch(() => undefined)
      .then((c) => {
        if (vivo) setCargado({ finca: fincaId, catalogo: c ?? null });
      });
    return () => {
      vivo = false;
    };
  }, [fincaId]);

  /**
   * Descarga automática (antes era el botón «Actualizar datos de la finca», que el cliente quitó).
   * No se dispara sin señal, ni con una descarga en curso, ni mientras el trabajador escribe en un
   * formulario: la decisión está en `tocaRefrescar`.
   */
  const refrescar = useCallback(() => {
    const ahora = Date.now();
    if (!navigator.onLine) return;

    // La lista de fincas también se refresca: si el administrador cambia a qué fincas tiene acceso
    // esta persona, el recuadro no puede quedarse mostrando la finca vieja.
    if (tocaRefrescar({ enLinea: true, descargando: false, escribiendo: false, ultimaDescarga: ultimasFincas.current || null, ahora })) {
      ultimasFincas.current = ahora;
      descargarFincas().catch(() => undefined);
    }

    if (!fincaId || !cargado || cargado.finca !== fincaId) return;
    const guardado = cargado.catalogo ? new Date(cargado.catalogo.descargado_en).getTime() : 0;
    // El último intento cuenta aunque haya fallado: así un error no se reintenta en cada tic.
    const intento = ultimoIntento.current.finca === fincaId ? ultimoIntento.current.en : 0;
    const ultimaDescarga = Math.max(guardado, intento) || null;
    if (!tocaRefrescar({ enLinea: true, descargando: descargando.current, escribiendo: estaEscribiendo(), ultimaDescarga, ahora })) return;
    void descargar(fincaId);
  }, [fincaId, cargado, descargar, estaEscribiendo]);

  useEffect(() => {
    // Al abrir la pantalla, al volver a primer plano, al recuperar la señal y cada 2 minutos
    // (el reloj late más seguido; `tocaRefrescar` es quien mide los 2 minutos).
    refrescar();
    const alVolver = () => {
      if (document.visibilityState === "visible") refrescar();
    };
    const reloj = window.setInterval(refrescar, TIC_REFRESCO);
    window.addEventListener("online", refrescar);
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      window.clearInterval(reloj);
      window.removeEventListener("online", refrescar);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [refrescar]);

  useEffect(() => {
    // Si le quitaron el acceso a la finca que tenía elegida, se suelta la selección.
    if (fincaId && fincas.length > 0 && !fincas.some((f) => f.id === fincaId)) elegirFinca("");
  }, [fincaId, fincas]);

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
      // Una baja saca al animal del inventario del teléfono antes de volver a descargar el catálogo.
      // (El destete ya no se registra: lo genera solo el sistema con `fincas.dias_destete`.)
      if (animal && accion === "baja") {
        const nuevo = await actualizarAnimalLocal(fincaId, animal.id, null).catch(() => undefined);
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

  const elegir = !fincaId || cambiandoFinca || (fincas.length > 0 && !finca);

  return (
    <>
      <BarraEstado
        enLinea={enLinea}
        cola={cola}
        historial={historial}
        sincronizando={sync.sincronizando}
        problema={sync.problema}
        ultimoSync={sync.ultimoSync}
        alSincronizar={() => void ejecutar("manual")}
        alReintentar={alReintentar}
        alDescartar={alDescartar}
      />

      {elegir ? (
        <TarjetaCampo>
          <Titulo kicker="Registrar evento finca" titulo="¿En qué finca estás?" descripcion="Los datos de la finca quedan guardados en el teléfono para anotar con o sin señal." />
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
          <h1 className="font-display mb-3 text-[1.45rem] font-bold leading-tight text-slate-900">Registrar evento finca</h1>

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
              {catalogo
                ? `${catalogo.animales.length} ${catalogo.animales.length === 1 ? "animal" : "animales"} · datos del ${fechaHora(catalogo.descargado_en)}`
                : "Sin datos descargados en este teléfono"}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-slate-500" aria-live="polite">
              {descarga.activa ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Actualizando los datos de la finca…
                </>
              ) : enLinea ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  Se actualiza solo cada 2 minutos
                </>
              ) : (
                <>
                  <CloudOff className="h-3.5 w-3.5" aria-hidden />
                  Sin señal: se actualiza solo cuando vuelva
                </>
              )}
            </p>
            {descarga.error && <p className="mt-1 text-sm font-semibold text-red-700">{descarga.error}</p>}
          </section>

          <nav aria-label="Tipo de registro" className="mb-4 grid grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1">
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
              </button>
            ))}
          </nav>

          <TarjetaCampo>
            {vista === "finca" && fincaId ? (
              <FormulariosFinca fincaId={fincaId} catalogo={catalogo ?? null} alGuardar={(accion, datos) => guardar(accion, datos)} />
            ) : catalogo === undefined ? (
              <p className="p-5 text-center text-slate-500">Cargando datos del teléfono…</p>
            ) : catalogo === null ? (
              <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-center text-slate-500">
                {enLinea ? "Descargando los animales de la finca…" : "Aún no hay animales guardados en este teléfono. Descárgalos cuando tengas señal."}
              </p>
            ) : vista === "lista" ? (
              <OrdenoLista catalogo={catalogo} indice={indiceDeOrdenos} alGuardar={(accion, datos) => guardar(accion, datos)} />
            ) : (
              <AnimalRapido key={catalogo.finca_id} catalogo={catalogo} animalInicial={animalEnlace} indice={indiceDeOrdenos} alGuardar={guardar} />
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

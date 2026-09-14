"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  CLAVE_FINCAS,
  CLAVE_MENSAJES,
  CLAVE_ULTIMO_SYNC,
  SinConexionError,
  SinSesionError,
  claveLeidos,
  descargarMensajes,
  escucharCambios,
  listarCola,
  listarHistorial,
  marcarMensajesLeidos,
  sincronizar,
  type ResumenSync,
} from "@/lib/offline/cliente";
import type { BandejaMensajes, FincaResumen, MensajeCampo, RegistroCola, RegistroHistorial } from "@/lib/offline/tipos";

function suscribirConexion(alCambiar: () => void) {
  window.addEventListener("online", alCambiar);
  window.addEventListener("offline", alCambiar);
  return () => {
    window.removeEventListener("online", alCambiar);
    window.removeEventListener("offline", alCambiar);
  };
}

export function useEnLinea() {
  return useSyncExternalStore(suscribirConexion, () => navigator.onLine, () => true);
}

function suscribirAlmacen(alCambiar: () => void) {
  window.addEventListener("storage", alCambiar);
  return () => window.removeEventListener("storage", alCambiar);
}

/** Valor de localStorage reactivo (también entre pestañas). */
export function useLocal(clave: string) {
  return useSyncExternalStore(
    suscribirAlmacen,
    () => {
      try {
        return localStorage.getItem(clave);
      } catch {
        return null;
      }
    },
    () => null,
  );
}

export function useFincas(): FincaResumen[] {
  const crudo = useLocal(CLAVE_FINCAS);
  return useMemo(() => {
    try {
      return crudo ? (JSON.parse(crudo) as FincaResumen[]) : [];
    } catch {
      return [];
    }
  }, [crudo]);
}

const CINCO_MINUTOS = 5 * 60_000;

/** Bandeja de mensajes guardada en el teléfono; se actualiza al abrir la app, al volver la señal y cada 5 minutos. */
export function useMensajes(usuarioId: string) {
  const crudo = useLocal(CLAVE_MENSAJES);
  const leidosCrudo = useLocal(claveLeidos(usuarioId));

  const bandeja = useMemo(() => {
    try {
      const leida = crudo ? (JSON.parse(crudo) as BandejaMensajes) : null;
      return leida?.usuario_id === usuarioId ? leida : null;
    } catch {
      return null;
    }
  }, [crudo, usuarioId]);
  const mensajes = useMemo(() => bandeja?.mensajes ?? [], [bandeja]);

  const leidos = useMemo(() => {
    try {
      return new Set(JSON.parse(leidosCrudo ?? "[]") as string[]);
    } catch {
      return new Set<string>();
    }
  }, [leidosCrudo]);

  useEffect(() => {
    const actualizar = () => {
      if (navigator.onLine) descargarMensajes().catch(() => undefined);
    };
    actualizar();
    const reloj = window.setInterval(actualizar, CINCO_MINUTOS);
    window.addEventListener("online", actualizar);
    return () => {
      window.clearInterval(reloj);
      window.removeEventListener("online", actualizar);
    };
  }, []);

  const noLeido = useCallback(
    (m: MensajeCampo) => !leidos.has(m.id) && !(m.destinatario_id === usuarioId && m.leido),
    [leidos, usuarioId],
  );

  return {
    mensajes,
    descargada: bandeja !== null,
    noLeido,
    noLeidos: mensajes.filter(noLeido).length,
    marcar: (lista: MensajeCampo[]) => marcarMensajesLeidos(usuarioId, lista),
  };
}

export function useCola() {
  const [estado, setEstado] = useState<{ cola: RegistroCola[]; historial: RegistroHistorial[]; cargada: boolean }>({
    cola: [],
    historial: [],
    cargada: false,
  });

  useEffect(() => {
    let vivo = true;
    const cargar = () => {
      Promise.all([listarCola(), listarHistorial()])
        .then(([cola, historial]) => {
          if (vivo) setEstado({ cola, historial, cargada: true });
        })
        .catch(() => undefined);
    };
    cargar();
    const dejar = escucharCambios(cargar);
    return () => {
      vivo = false;
      dejar();
    };
  }, []);

  return estado;
}

export function usePendientes() {
  const [total, setTotal] = useState(0);
  useEffect(() => {
    let vivo = true;
    const cargar = () => {
      listarCola()
        .then((cola) => {
          if (vivo) setTotal(cola.length);
        })
        .catch(() => undefined);
    };
    cargar();
    const dejar = escucharCambios(cargar);
    return () => {
      vivo = false;
      dejar();
    };
  }, []);
  return total;
}

const INTERVALO = 60_000;
const ESPERA_MAXIMA = 15 * 60_000;

export type Problema = { tipo: "sin-sesion" | "sin-conexion" | "servidor"; texto: string } | null;
type Motivo = "manual" | "evento" | "auto";

/** Sincroniza al volver la señal, al volver a la app, cada 60 s (con espera creciente si falla) y a pedido. */
export function useSincronizacion() {
  const [sincronizando, setSincronizando] = useState(false);
  const [problema, setProblema] = useState<Problema>(null);
  const [resumen, setResumen] = useState<ResumenSync | null>(null);
  const siguiente = useRef(0);
  const espera = useRef(INTERVALO);
  const ultimoSync = useLocal(CLAVE_ULTIMO_SYNC);

  const ejecutar = useCallback(async (motivo: Motivo) => {
    await Promise.resolve();
    if (!navigator.onLine) {
      if (motivo === "manual") setProblema({ tipo: "sin-conexion", texto: new SinConexionError().message });
      return;
    }
    if (motivo === "auto" && Date.now() < siguiente.current) return;
    const pendientes = (await listarCola()).filter((r) => r.estado === "pendiente");
    if (!pendientes.length) {
      if (motivo === "manual") setProblema(null);
      return;
    }

    setSincronizando(true);
    try {
      setResumen(await sincronizar());
      setProblema(null);
      espera.current = INTERVALO;
    } catch (e) {
      espera.current = Math.min(espera.current * 2, ESPERA_MAXIMA);
      if (e instanceof SinSesionError) setProblema({ tipo: "sin-sesion", texto: e.message });
      else if (e instanceof SinConexionError) setProblema({ tipo: "sin-conexion", texto: e.message });
      else setProblema({ tipo: "servidor", texto: e instanceof Error ? e.message : "No se pudo sincronizar." });
    } finally {
      siguiente.current = Date.now() + espera.current;
      setSincronizando(false);
    }
  }, []);

  useEffect(() => {
    const alConectar = () => void ejecutar("evento");
    const alVolver = () => {
      if (document.visibilityState === "visible") void ejecutar("auto");
    };
    const alMensaje = (e: MessageEvent) => {
      if (e.data?.tipo === "sincronizar") void ejecutar("evento");
    };
    window.addEventListener("online", alConectar);
    window.addEventListener("focus", alVolver);
    document.addEventListener("visibilitychange", alVolver);
    navigator.serviceWorker?.addEventListener("message", alMensaje);
    const reloj = window.setInterval(() => void ejecutar("auto"), 15_000);
    const inicio = window.setTimeout(() => void ejecutar("evento"), 0);
    return () => {
      window.clearTimeout(inicio);
      window.removeEventListener("online", alConectar);
      window.removeEventListener("focus", alVolver);
      document.removeEventListener("visibilitychange", alVolver);
      navigator.serviceWorker?.removeEventListener("message", alMensaje);
      window.clearInterval(reloj);
    };
  }, [ejecutar]);

  return { sincronizando, problema, resumen, ultimoSync, ejecutar };
}

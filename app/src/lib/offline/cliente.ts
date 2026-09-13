import { borrar, contar, guardar, leer, leerTodos, transaccion } from "./idb";
import { resumir } from "./resumen";
import type { Accion, AnimalCatalogo, Catalogo, FincaResumen, RegistroCola, RegistroHistorial, ResultadoRegistro } from "./tipos";

export const CLAVE_FINCA = "vacdata:finca";
export const CLAVE_FINCAS = "vacdata:fincas";
export const CLAVE_ULTIMO_SYNC = "vacdata:ultimo-sync";
export const ETIQUETA_SYNC = "vacdata-sync";
const EVENTO_CAMBIO = "vacdata:cambio";
const TAMANO_LOTE = 50;
const MAX_HISTORIAL = 100;

export class SinSesionError extends Error {
  constructor() {
    super("Tu sesión se cerró. Entra de nuevo con señal para enviar los registros.");
  }
}
export class SinConexionError extends Error {
  constructor() {
    super("Sin señal. Los registros siguen guardados en el teléfono.");
  }
}

// ─────────────────────────── Avisos entre pestañas ───────────────────────────
let canal: BroadcastChannel | null | undefined;
function obtenerCanal() {
  if (canal === undefined) canal = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("vacdata");
  return canal;
}

export function avisarCambio() {
  window.dispatchEvent(new Event(EVENTO_CAMBIO));
  obtenerCanal()?.postMessage("cambio");
}

export function escucharCambios(alCambiar: () => void) {
  const c = obtenerCanal();
  const alMensajeSW = (e: MessageEvent) => {
    if (e.data?.tipo === "cola-actualizada") alCambiar();
  };
  window.addEventListener(EVENTO_CAMBIO, alCambiar);
  c?.addEventListener("message", alCambiar);
  navigator.serviceWorker?.addEventListener("message", alMensajeSW);
  return () => {
    window.removeEventListener(EVENTO_CAMBIO, alCambiar);
    c?.removeEventListener("message", alCambiar);
    navigator.serviceWorker?.removeEventListener("message", alMensajeSW);
  };
}

// ─────────────────────────── Red ───────────────────────────
async function pedirJSON<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, credentials: "same-origin", cache: "no-store", redirect: "manual" });
  } catch {
    throw new SinConexionError();
  }
  // El proxy redirige a /login cuando no hay sesión.
  if (res.type === "opaqueredirect" || res.status === 401 || (res.status >= 300 && res.status < 400)) throw new SinSesionError();
  if (!res.headers.get("content-type")?.includes("application/json")) {
    throw res.ok ? new SinSesionError() : new Error(`El servidor respondió ${res.status}.`);
  }
  const cuerpo = await res.json();
  if (!res.ok) throw new Error(cuerpo?.error ?? `El servidor respondió ${res.status}.`);
  return cuerpo as T;
}

function guardarLocal(clave: string, valor: string) {
  try {
    localStorage.setItem(clave, valor);
    window.dispatchEvent(new StorageEvent("storage", { key: clave }));
  } catch {
    // Almacenamiento lleno o bloqueado: no es crítico.
  }
}

export function elegirFinca(id: string) {
  guardarLocal(CLAVE_FINCA, id);
}

// ─────────────────────────── Catálogo ───────────────────────────
export async function descargarFincas(): Promise<FincaResumen[]> {
  const { fincas } = await pedirJSON<{ fincas: FincaResumen[] }>("/api/campo/catalogo");
  guardarLocal(CLAVE_FINCAS, JSON.stringify(fincas));
  return fincas;
}

export async function descargarCatalogo(fincaId: string): Promise<Catalogo> {
  const { fincas, catalogo } = await pedirJSON<{ fincas: FincaResumen[]; catalogo: Catalogo }>(
    `/api/campo/catalogo?finca=${encodeURIComponent(fincaId)}`,
  );
  await guardar("catalogo", catalogo);
  guardarLocal(CLAVE_FINCAS, JSON.stringify(fincas));
  return catalogo;
}

export const leerCatalogo = (fincaId: string) => leer<Catalogo>("catalogo", fincaId);

// ─────────────────────────── Cola ───────────────────────────
function nuevoId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // crypto.randomUUID solo existe en contextos seguros (https o localhost).
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export async function encolar(accion: Accion, datos: Record<string, unknown>, fincaId: string, animal?: AnimalCatalogo) {
  const registro: RegistroCola = {
    cliente_id: nuevoId(),
    accion,
    datos,
    finca_id: fincaId,
    resumen: resumir(accion, datos, animal),
    creado_en: new Date().toISOString(),
    intentos: 0,
    estado: "pendiente",
    error: null,
    ultimo_intento: null,
  };
  await guardar("cola", registro);
  avisarCambio();
  void pedirSyncEnSegundoPlano();
  return registro;
}

export async function listarCola() {
  return (await leerTodos<RegistroCola>("cola")).sort((a, b) => a.creado_en.localeCompare(b.creado_en));
}

export async function listarHistorial() {
  return (await leerTodos<RegistroHistorial>("historial")).sort((a, b) => b.sincronizado_en.localeCompare(a.sincronizado_en));
}

export const contarPendientes = () => contar("cola");

export async function descartar(clienteId: string) {
  await borrar("cola", clienteId);
  avisarCambio();
}

export async function reintentar(clienteIds: string[]) {
  const cola = await listarCola();
  await transaccion(["cola"], ({ cola: almacen }) => {
    for (const r of cola) if (clienteIds.includes(r.cliente_id)) almacen.put({ ...r, estado: "pendiente", error: null });
  });
  avisarCambio();
}

export async function pedirSyncEnSegundoPlano() {
  try {
    const registro = (await navigator.serviceWorker?.ready) as (ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } }) | undefined;
    await registro?.sync?.register(ETIQUETA_SYNC);
  } catch {
    // Background Sync no disponible (iOS, Firefox): la página sincroniza por su cuenta.
  }
}

// ─────────────────────────── Sincronización ───────────────────────────
export type ResumenSync = { enviados: number; ok: number; duplicados: number; errores: number };

let enCurso: Promise<ResumenSync> | null = null;

/** Envía los registros pendientes. Un solo envío a la vez, también entre pestañas y el service worker. */
export function sincronizar(): Promise<ResumenSync> {
  enCurso ??= conCandado().finally(() => {
    enCurso = null;
  });
  return enCurso;
}

async function conCandado(): Promise<ResumenSync> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  return locks ? await locks.request(ETIQUETA_SYNC, enviarPendientes) : enviarPendientes();
}

async function enviarPendientes(): Promise<ResumenSync> {
  const resumen: ResumenSync = { enviados: 0, ok: 0, duplicados: 0, errores: 0 };
  const pendientes = (await listarCola()).filter((r) => r.estado === "pendiente");
  if (!pendientes.length) return resumen;

  for (let i = 0; i < pendientes.length; i += TAMANO_LOTE) {
    const lote = pendientes.slice(i, i + TAMANO_LOTE);
    const { resultados } = await pedirJSON<{ resultados: ResultadoRegistro[] }>("/api/campo/sincronizar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registros: lote.map(({ cliente_id, accion, datos }) => ({ cliente_id, accion, datos })) }),
    });

    const ahora = new Date().toISOString();
    const porId = new Map(lote.map((r) => [r.cliente_id, r]));
    await transaccion(["cola", "historial"], ({ cola, historial }) => {
      for (const res of resultados) {
        const registro = porId.get(res.cliente_id);
        if (!registro) continue;
        resumen.enviados++;
        if (res.estado === "error") {
          resumen.errores++;
          cola.put({ ...registro, estado: "error", error: res.mensaje ?? "Error desconocido", intentos: registro.intentos + 1, ultimo_intento: ahora });
        } else {
          if (res.estado === "ok") resumen.ok++;
          else resumen.duplicados++;
          cola.delete(registro.cliente_id);
          const enHistorial: RegistroHistorial = {
            ...registro,
            intentos: registro.intentos + 1,
            ultimo_intento: ahora,
            resultado: res.estado,
            mensaje: res.mensaje ?? null,
            sincronizado_en: ahora,
          };
          historial.put(enHistorial);
        }
      }
    });
    avisarCambio();
  }

  await recortarHistorial();
  guardarLocal(CLAVE_ULTIMO_SYNC, new Date().toISOString());
  avisarCambio();
  return resumen;
}

async function recortarHistorial() {
  const historial = await listarHistorial();
  if (historial.length <= MAX_HISTORIAL) return;
  await transaccion(["historial"], ({ historial: almacen }) => {
    for (const r of historial.slice(MAX_HISTORIAL)) almacen.delete(r.cliente_id);
  });
}

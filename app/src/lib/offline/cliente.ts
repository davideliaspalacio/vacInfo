import { borrar, contar, guardar, leer, leerTodos, transaccion } from "./idb";
import { resumir } from "./resumen";
import type {
  Accion,
  AnimalCatalogo,
  BandejaMensajes,
  Catalogo,
  FincaResumen,
  MensajeCampo,
  RegistroCola,
  RegistroHistorial,
  ResultadoRegistro,
} from "./tipos";

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

const PREFIJO_ESPERA = "Hay muchos envíos seguidos.";
/** El servidor pidió esperar (429): nada se pierde, se reintenta después. */
export class EsperaError extends Error {
  constructor(readonly segundos: number) {
    const minutos = Math.max(1, Math.ceil(segundos / 60));
    super(`${PREFIJO_ESPERA} Lo registrado sigue guardado en el teléfono; se reintenta en ${minutos} ${minutos === 1 ? "minuto" : "minutos"}.`);
  }
}
export const esAvisoDeEspera = (texto: string) => texto.startsWith(PREFIJO_ESPERA);

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
/** Hasta cuándo no se vuelve a llamar cada ruta después de un 429. */
const pausas = new Map<string, number>();

function segundosDeEspera(retryAfter: string | null) {
  const valor = retryAfter?.trim() ?? "";
  const segundos = /^\d+$/.test(valor) ? Number(valor) : (Date.parse(valor) - Date.now()) / 1000;
  return Number.isFinite(segundos) ? Math.min(Math.max(Math.ceil(segundos), 5), 3600) : 60;
}

async function pedirJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const ruta = url.split("?")[0];
  const pausa = (pausas.get(ruta) ?? 0) - Date.now();
  if (pausa > 0) throw new EsperaError(pausa / 1000);

  let res: Response;
  try {
    res = await fetch(url, { ...init, credentials: "same-origin", cache: "no-store", redirect: "manual" });
  } catch {
    throw new SinConexionError();
  }
  if (res.status === 429) {
    const segundos = segundosDeEspera(res.headers.get("retry-after"));
    pausas.set(ruta, Date.now() + segundos * 1000);
    throw new EsperaError(segundos);
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
  const { fincas, mensajes } = await pedirJSON<{ fincas: FincaResumen[]; mensajes: BandejaMensajes | null }>("/api/campo/catalogo");
  guardarLocal(CLAVE_FINCAS, JSON.stringify(fincas));
  if (mensajes) guardarBandeja(mensajes);
  return fincas;
}

export async function descargarCatalogo(fincaId: string): Promise<Catalogo> {
  const { fincas, catalogo, mensajes } = await pedirJSON<{ fincas: FincaResumen[]; catalogo: Catalogo; mensajes: BandejaMensajes | null }>(
    `/api/campo/catalogo?finca=${encodeURIComponent(fincaId)}`,
  );
  await guardar("catalogo", catalogo);
  guardarLocal(CLAVE_FINCAS, JSON.stringify(fincas));
  if (mensajes) guardarBandeja(mensajes);
  return catalogo;
}

/** Los catálogos descargados con una versión anterior no traen todos los campos. */
function completarCatalogo(c: Catalogo): Catalogo {
  return {
    ...c,
    animales: c.animales.map((a) => ({ ...a, fecha_destete: a.fecha_destete ?? null })),
    potreros_estado: c.potreros_estado ?? [],
    dias_descanso_objetivo: c.dias_descanso_objetivo ?? 35,
    grupos: c.grupos ?? [],
    rotaciones_abiertas: c.rotaciones_abiertas ?? [],
    bienes: c.bienes ?? [],
    insumos: c.insumos ?? [],
    toros: c.toros ?? [],
  };
}

export async function leerCatalogo(fincaId: string) {
  const c = await leer<Catalogo>("catalogo", fincaId);
  return c && completarCatalogo(c);
}

/** Refleja en el teléfono un destete o una salida antes de volver a descargar. null = el animal sale del inventario. */
export async function actualizarAnimalLocal(fincaId: string, animalId: string, cambios: Partial<AnimalCatalogo> | null) {
  const c = await leerCatalogo(fincaId);
  if (!c) return undefined;
  const animales = cambios === null ? c.animales.filter((a) => a.id !== animalId) : c.animales.map((a) => (a.id === animalId ? { ...a, ...cambios } : a));
  const nuevo = { ...c, animales };
  await guardar("catalogo", nuevo);
  return nuevo;
}

// ─────────────────────────── Mensajes ───────────────────────────
export const CLAVE_MENSAJES = "vacdata:mensajes";
export const claveLeidos = (usuarioId: string) => `vacdata:mensajes-leidos:${usuarioId}`;
let descargandoMensajes: Promise<void> | null = null;

function guardarBandeja(bandeja: BandejaMensajes) {
  guardarLocal(CLAVE_MENSAJES, JSON.stringify(bandeja));
  const leidos = leerLeidos(bandeja.usuario_id);
  // Mensajes para mí que marqué sin señal: se avisa al servidor ahora.
  const porMarcar = bandeja.mensajes.filter((m) => m.destinatario_id === bandeja.usuario_id && !m.leido && leidos.has(m.id)).map((m) => m.id);
  if (porMarcar.length) void enviarLeidos(porMarcar).catch(() => undefined);
  // Solo se conservan las marcas de los mensajes que siguen en la bandeja.
  const vigentes = bandeja.mensajes.filter((m) => leidos.has(m.id)).map((m) => m.id);
  if (vigentes.length !== leidos.size) guardarLocal(claveLeidos(bandeja.usuario_id), JSON.stringify(vigentes));
}

export function leerLeidos(usuarioId: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(claveLeidos(usuarioId)) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

/** Descarga la bandeja; varias pantallas pueden pedirla a la vez y se hace una sola petición. */
export function descargarMensajes(): Promise<void> {
  descargandoMensajes ??= pedirJSON<BandejaMensajes>("/api/campo/mensajes")
    .then(guardarBandeja)
    .finally(() => {
      descargandoMensajes = null;
    });
  return descargandoMensajes;
}

async function enviarLeidos(ids: string[]) {
  await pedirJSON("/api/campo/mensajes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
}

export function marcarMensajesLeidos(usuarioId: string, mensajes: MensajeCampo[]) {
  const leidos = leerLeidos(usuarioId);
  mensajes.forEach((m) => leidos.add(m.id));
  guardarLocal(claveLeidos(usuarioId), JSON.stringify([...leidos]));
  const propios = mensajes.filter((m) => m.destinatario_id === usuarioId && !m.leido).map((m) => m.id);
  // Sin señal queda marcado en el teléfono y se envía en la próxima descarga de mensajes.
  if (propios.length && navigator.onLine) void enviarLeidos(propios).catch(() => undefined);
}

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

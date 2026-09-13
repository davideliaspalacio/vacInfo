/* Service worker de VacDaTa: shell de Registro rápido sin señal + sincronización en segundo plano. */
const VERSION = "v1";
const CACHE_SHELL = `vacdata-shell-${VERSION}`;
const CACHE_ESTATICOS = `vacdata-estaticos-${VERSION}`;
const RUTA_RAPIDO = "/campo/rapido";
const ETIQUETA_SYNC = "vacdata-sync";
const MODO_DEV = new URL(self.location.href).searchParams.get("modo") === "dev";
const PRECACHE = ["/manifest.webmanifest", "/icon.svg", "/icon-192.png", "/icon-512.png"];

// ─────────────────────────── Ciclo de vida ───────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_SHELL);
      await Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => undefined)));
      await guardarShell().catch(() => undefined);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const vigentes = [CACHE_SHELL, CACHE_ESTATICOS];
      const nombres = await caches.keys();
      await Promise.all(nombres.filter((n) => n.startsWith("vacdata-") && !vigentes.includes(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

// ─────────────────────────── Caché ───────────────────────────
function esShellValido(respuesta) {
  return respuesta && respuesta.ok && !respuesta.redirected && new URL(respuesta.url).pathname === RUTA_RAPIDO;
}

/** Descarga el HTML de Registro rápido (solo si hay sesión) y los archivos estáticos que usa. */
async function guardarShell() {
  const respuesta = await fetch(RUTA_RAPIDO, { credentials: "include", cache: "no-store" });
  if (!esShellValido(respuesta)) return;
  const html = await respuesta.clone().text();
  await (await caches.open(CACHE_SHELL)).put(RUTA_RAPIDO, respuesta);
  const urls = [...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)].map((m) => m[1].replaceAll("&amp;", "&"));
  await precachear(urls);
}

async function precachear(urls) {
  const cache = await caches.open(CACHE_ESTATICOS);
  await Promise.all(
    [...new Set(urls)].map(async (url) => {
      if (await cache.match(url)) return;
      const r = await fetch(url).catch(() => null);
      if (r && r.ok) await cache.put(url, r);
    }),
  );
}

function paginaSinSenal() {
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#2563eb"><title>Sin señal · VacDaTa</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f8fafc;font-family:system-ui,sans-serif;color:#0f172a;padding:24px;box-sizing:border-box}
main{max-width:420px;background:#fff;border:1px solid #e2e8f0;border-radius:24px;padding:28px;text-align:center;box-shadow:0 16px 42px rgba(16,24,40,.08)}
h1{font-size:1.5rem;margin:0 0 8px}p{color:#475569;line-height:1.5}a{display:block;margin-top:20px;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;padding:16px;border-radius:16px;font-size:1.1rem}</style></head>
<body><main><h1>No hay señal</h1><p>Esta pantalla necesita internet. Puedes seguir anotando en <strong>Registro rápido</strong>: se guarda en el teléfono y se envía cuando vuelva la señal.</p>
<a href="${RUTA_RAPIDO}">Abrir Registro rápido</a></main></body></html>`;
  return new Response(html, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

async function redPrimeroRapido(request) {
  const cache = await caches.open(CACHE_SHELL);
  try {
    const respuesta = await fetch(request);
    if (esShellValido(respuesta)) await cache.put(RUTA_RAPIDO, respuesta.clone());
    return respuesta;
  } catch {
    return (await cache.match(RUTA_RAPIDO)) || paginaSinSenal();
  }
}

async function cachePrimero(request) {
  const cache = await caches.open(CACHE_ESTATICOS);
  const guardada = await cache.match(request);
  if (guardada && !MODO_DEV) return guardada;
  try {
    const respuesta = await fetch(request);
    if (respuesta.ok) await cache.put(request, respuesta.clone());
    return respuesta;
  } catch (error) {
    if (guardada) return guardada;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    if (url.pathname === RUTA_RAPIDO) event.respondWith(redPrimeroRapido(request));
    else event.respondWith(fetch(request).catch(() => paginaSinSenal()));
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || /^\/(icon[^/]*\.(svg|png)|manifest\.webmanifest|favicon\.ico)$/.test(url.pathname)) {
    event.respondWith(cachePrimero(request));
  }
});

self.addEventListener("message", (event) => {
  const datos = event.data || {};
  if (datos.tipo === "precachear") {
    const urls = (datos.urls || []).filter((u) => typeof u === "string" && u.startsWith("/_next/static/"));
    event.waitUntil(Promise.all([precachear(urls), datos.shell ? guardarShell() : null]).catch(() => undefined));
  }
});

// ─────────────────────────── Sincronización en segundo plano ───────────────────────────
self.addEventListener("sync", (event) => {
  if (event.tag === ETIQUETA_SYNC) event.waitUntil(sincronizarDesdeSW());
});

async function sincronizarDesdeSW() {
  const ventanas = await self.clients.matchAll({ type: "window" });
  if (ventanas.length) {
    ventanas.forEach((v) => v.postMessage({ tipo: "sincronizar" }));
    return;
  }
  const trabajo = () => enviarCola();
  return self.navigator.locks ? self.navigator.locks.request(ETIQUETA_SYNC, trabajo) : trabajo();
}

// Misma base que src/lib/offline/idb.ts.
function abrirBD() {
  return new Promise((resolve, reject) => {
    const peticion = indexedDB.open("vacdata", 1);
    peticion.onupgradeneeded = () => {
      const bd = peticion.result;
      if (!bd.objectStoreNames.contains("catalogo")) bd.createObjectStore("catalogo", { keyPath: "finca_id" });
      if (!bd.objectStoreNames.contains("cola")) bd.createObjectStore("cola", { keyPath: "cliente_id" });
      if (!bd.objectStoreNames.contains("historial")) bd.createObjectStore("historial", { keyPath: "cliente_id" });
    };
    peticion.onsuccess = () => resolve(peticion.result);
    peticion.onerror = () => reject(peticion.error);
  });
}

function completar(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
}

async function enviarCola() {
  const bd = await abrirBD();
  try {
    const cola = await new Promise((resolve, reject) => {
      const p = bd.transaction("cola").objectStore("cola").getAll();
      p.onsuccess = () => resolve(p.result);
      p.onerror = () => reject(p.error);
    });
    const pendientes = cola.filter((r) => r.estado === "pendiente").sort((a, b) => a.creado_en.localeCompare(b.creado_en));

    for (let i = 0; i < pendientes.length; i += 50) {
      const lote = pendientes.slice(i, i + 50);
      // Si falla la red, la promesa se rechaza y el navegador reintenta el sync más tarde.
      const respuesta = await fetch("/api/campo/sincronizar", {
        method: "POST",
        credentials: "same-origin",
        redirect: "manual",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registros: lote.map(({ cliente_id, accion, datos }) => ({ cliente_id, accion, datos })) }),
      });
      if (!respuesta.ok || !(respuesta.headers.get("content-type") || "").includes("application/json")) return; // sin sesión: espera a la página
      const { resultados } = await respuesta.json();

      const ahora = new Date().toISOString();
      const porId = new Map(lote.map((r) => [r.cliente_id, r]));
      const tx = bd.transaction(["cola", "historial"], "readwrite");
      for (const res of resultados) {
        const r = porId.get(res.cliente_id);
        if (!r) continue;
        const intentos = r.intentos + 1;
        if (res.estado === "error") {
          tx.objectStore("cola").put({ ...r, estado: "error", error: res.mensaje || "Error desconocido", intentos, ultimo_intento: ahora });
        } else {
          tx.objectStore("cola").delete(r.cliente_id);
          tx.objectStore("historial").put({ ...r, intentos, ultimo_intento: ahora, resultado: res.estado, mensaje: res.mensaje || null, sincronizado_en: ahora });
        }
      }
      await completar(tx);
    }
    const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    ventanas.forEach((v) => v.postMessage({ tipo: "cola-actualizada" }));
  } finally {
    bd.close();
  }
}

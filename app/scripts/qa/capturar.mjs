// Capturas de pantalla y tiempos de respuesta de la app local.
// Uso: node scripts/qa/capturar.mjs <antes|despues> [base=http://localhost:3100]
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { cookiesDe } from "./sesion-local.mjs";

const FASE = process.argv[2] ?? "antes";
const BASE = process.argv[3] ?? "http://localhost:3100";
// Conjunto de pantallas: "v1.1" (primera revisión) o "revision2"
const CONJUNTO = process.argv[4] ?? "v1.1";
const CARPETA = CONJUNTO === "revision2" ? "revision-2" : "ajustes-v1.1";
const SALIDA = `/Users/1234/vacasProyecto/entregables/${CARPETA}/${FASE}`;
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PUERTO = 9355;
const PERFIL = `/tmp/vacinfo-qa-perfil-${FASE}`;

const T = "00000000-0000-4000-8000-000000000101";
const VACA = "00000000-0000-4000-8000-000000000016";

const WEB = { ancho: 1440, alto: 1000, movil: false };
const CEL = { ancho: 390, alto: 844, movil: true };

const clic = (texto) => `(() => {
  const el = [...document.querySelectorAll('button, a, [role=tab], label')].find(e => e.textContent.trim().includes(${JSON.stringify(texto)}));
  if (el) el.click();
  return !!el;
})()`;

const CUENTAS = {
  admin: "gustavo@vacinfo.local",
  consultor: "consultor@vacinfo.local",
  trabajador: "jhon@vacinfo.local",
};

const TOMAS_REVISION2 = [
  { n: "01-costos", cuenta: "admin", ruta: `/fincas/${T}/costos`, ...WEB, alto: 1500 },
  { n: "02-finca-rango", cuenta: "admin", ruta: `/fincas/${T}`, ...WEB, alto: 1100 },
  { n: "03-levante-rango", cuenta: "admin", ruta: `/fincas/${T}/levante`, ...WEB, alto: 1300 },
  { n: "04-inventario-rango", cuenta: "admin", ruta: `/inventario?finca=${T}`, ...WEB, alto: 1000 },
  { n: "05-nuevo-ser-vivo", cuenta: "admin", ruta: `/animales/nuevo?finca=${T}`, ...WEB, alto: 1300 },
  { n: "06-levante-etapas", cuenta: "admin", ruta: `/fincas/${T}/levante`, ...WEB, alto: 2600 },
  { n: "07-notificaciones", cuenta: "admin", ruta: "/mensajes", ...WEB, alto: 1400 },
  { n: "08-finca-secas", cuenta: "admin", ruta: `/fincas/${T}?tab=animales`, ...WEB, alto: 1400 },
  { n: "09-vacdata-secas", cuenta: "trabajador", ruta: `/campo/registrar?finca=${T}`, ...CEL, alto: 1500, acciones: [clic("Finca Toneles")], espera: 5000 },
];

export const TOMAS = CONJUNTO === "revision2" ? TOMAS_REVISION2 : [
  // Administrador (web)
  { n: "01-informe-administrativo", cuenta: "admin", ruta: `/informes?tab=administrativo&finca=${T}`, ...WEB, alto: 2200 },
  { n: "02-calendario", cuenta: "admin", ruta: `/calendario?finca=${T}`, ...WEB, alto: 1400 },
  { n: "03-inventario", cuenta: "admin", ruta: `/inventario?finca=${T}`, ...WEB, alto: 2000 },
  { n: "04-nuevo-ser-vivo", cuenta: "admin", ruta: `/animales/nuevo?finca=${T}`, ...WEB, alto: 1400 },
  { n: "05-mensajes-admin", cuenta: "admin", ruta: "/mensajes", ...WEB, alto: 1200 },
  // Consultor (web)
  { n: "06-consultor-finca", cuenta: "consultor", ruta: `/fincas/${T}`, ...WEB, alto: 1100 },
  { n: "07-consultor-inventario", cuenta: "consultor", ruta: `/inventario?finca=${T}`, ...WEB, alto: 1600 },
  { n: "08-consultor-levante", cuenta: "consultor", ruta: `/fincas/${T}/levante`, ...WEB, alto: 1200 },
  // Trabajador (celular)
  { n: "09-vacdata-menu", cuenta: "trabajador", ruta: "/campo", ...CEL },
  { n: "10-vacdata-registrar", cuenta: "trabajador", ruta: `/campo/registrar?finca=${T}`, ...CEL },
  { n: "11-vacdata-vaca-acciones", cuenta: "trabajador", ruta: `/campo/animal/${VACA}`, ...CEL, alto: 1300 },
  { n: "12-vacdata-rapido", cuenta: "trabajador", ruta: "/campo/rapido", ...CEL, alto: 1100, acciones: [clic("Finca Toneles")], espera: 6000 },
  { n: "13-vacdata-aprendizaje", cuenta: "trabajador", ruta: "/campo/aprendizaje", ...CEL, alto: 1300 },
  { n: "14-vacdata-mensajes", cuenta: "trabajador", ruta: "/campo/mensajes", ...CEL },
];

// Rutas cuyo tiempo de respuesta se mide (servidor, versión de producción)
export const RUTAS_TIEMPO = [
  `/fincas/${T}?tab=animales`,
  `/fincas/${T}?tab=alertas`,
  `/fincas/${T}?tab=bienes`,
  `/fincas/${T}?tab=arbol`,
  `/fincas/${T}?tab=historial`,
  `/informes?tab=operativo&finca=${T}`,
  `/informes?tab=administrativo&finca=${T}`,
  `/informes?tab=contable&finca=${T}`,
  `/mensajes`,
  `/calendario?finca=${T}`,
  `/inventario?finca=${T}`,
];

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function medirTiempos(cookies) {
  const cabecera = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const filas = [];
  for (const ruta of RUTAS_TIEMPO) {
    await fetch(BASE + ruta, { headers: { cookie: cabecera } }).then((r) => r.text()); // calentamiento
    const muestras = [];
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      const r = await fetch(BASE + ruta, { headers: { cookie: cabecera }, redirect: "manual" });
      await r.text();
      muestras.push(performance.now() - t0);
      if (r.status >= 300) throw new Error(`${ruta} respondió ${r.status}`);
    }
    muestras.sort((a, b) => a - b);
    filas.push({ ruta, mediana_ms: Math.round(muestras[2]), min_ms: Math.round(muestras[0]), max_ms: Math.round(muestras[4]) });
  }
  return filas;
}

async function capturar() {
  rmSync(PERFIL, { recursive: true, force: true });
  const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PUERTO}`, `--user-data-dir=${PERFIL}`, "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
  let listo = null;
  for (let i = 0; i < 50 && !listo; i++) {
    await dormir(200);
    listo = await fetch(`http://127.0.0.1:${PUERTO}/json/list`).then((r) => r.json()).catch(() => null);
  }
  const ws = new WebSocket(listo.find((o) => o.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0;
  const pendientes = new Map();
  const oyentes = [];
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pendientes.has(m.id)) {
      const { ok, mal } = pendientes.get(m.id);
      pendientes.delete(m.id);
      m.error ? mal(new Error(m.error.message)) : ok(m.result);
    } else if (m.method) oyentes.forEach((f) => f(m));
  });
  const cdp = (method, params = {}) => new Promise((ok, mal) => { const n = ++id; pendientes.set(n, { ok, mal }); ws.send(JSON.stringify({ id: n, method, params })); });
  const carga = () => new Promise((ok) => { const f = (m) => { if (m.method === "Page.loadEventFired") { oyentes.splice(oyentes.indexOf(f), 1); ok(); } }; oyentes.push(f); });

  await cdp("Page.enable");
  await cdp("Network.enable");
  const sesiones = {};
  const resultado = [];
  let cuentaActual = null;
  for (const t of TOMAS) {
    if (t.cuenta !== cuentaActual) {
      await cdp("Network.clearBrowserCookies");
      sesiones[t.cuenta] ??= await cookiesDe(CUENTAS[t.cuenta]);
      for (const c of sesiones[t.cuenta]) {
        await cdp("Network.setCookie", { name: c.name, value: c.value, url: BASE });
      }
      cuentaActual = t.cuenta;
    }
    await cdp("Emulation.setDeviceMetricsOverride", { width: t.ancho, height: t.alto, deviceScaleFactor: t.movil ? 2 : 1, mobile: t.movil });
    const esperaCarga = carga();
    await cdp("Page.navigate", { url: BASE + t.ruta });
    await Promise.race([esperaCarga, dormir(25000)]);
    await dormir(2500);
    for (const a of t.acciones ?? []) {
      await cdp("Runtime.evaluate", { expression: a });
      await dormir(t.espera ?? 2500);
    }
    const { result } = await cdp("Runtime.evaluate", { expression: "location.pathname + location.search + ' | ' + document.title" });
    const { data } = await cdp("Page.captureScreenshot", { format: "jpeg", quality: 85 });
    writeFileSync(`${SALIDA}/${t.n}.jpg`, Buffer.from(data, "base64"));
    resultado.push(`${t.n}: ${result.value}`);
  }
  ws.close();
  chrome.kill();
  await dormir(1500);
  try {
    rmSync(PERFIL, { recursive: true, force: true });
  } catch {
    // Chrome puede seguir cerrando archivos; la carpeta está en /tmp.
  }
  return { resultado, sesiones };
}

mkdirSync(SALIDA, { recursive: true });
const { resultado, sesiones } = await capturar();
console.log(resultado.join("\n"));
const tiempos = await medirTiempos(sesiones.admin ?? (await cookiesDe(CUENTAS.admin)));
writeFileSync(`${SALIDA}/tiempos.json`, JSON.stringify(tiempos, null, 2));
console.table(tiempos);

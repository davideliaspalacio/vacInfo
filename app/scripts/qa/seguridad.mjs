// Cabeceras de seguridad y límites de uso contra un build local (pnpm build && pnpm start -p 3200).
// Uso: node scripts/qa/seguridad.mjs [http://localhost:3200]
// Necesita el Supabase local (cuentas demo) y Docker para limpiar los contadores que crea (tabla limites_uso).
import { execFileSync } from "node:child_process";
import { cookiesDe } from "./sesion-local.mjs";

const BASE = process.argv[2] ?? "http://localhost:3200";
const IP = `198.18.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`; // red de pruebas (RFC 2544)
const CUENTAS = ["jhon@vacinfo.local", "consultor@vacinfo.local", "nelson@vacinfo.local"];
const CLAVE_DEMO = "vacinfo123";

let fallos = 0;
const comprobar = (condicion, texto) => {
  console.log(`${condicion ? "  ok " : "  FALLA"} ${texto}`);
  if (!condicion) fallos++;
};

/** Borra solo los contadores que usa esta prueba (las claves se guardan como sha256). */
function limpiar() {
  const lista = (xs) => xs.map((x) => `'${x.replace(/'/g, "''")}'`).join(", ");
  const sql = `
    delete from limites_uso where clave in (
      select encode(extensions.digest(k, 'sha256'), 'hex') from unnest(array[
        ${lista([IP, "::1", "127.0.0.1", "::ffff:127.0.0.1", "desconocida"].map((ip) => `login:ip:${ip}`))},
        ${lista(CUENTAS.map((c) => `login:cuenta:${c}`))}
      ]) k
      union
      select encode(extensions.digest(p || ':usuario:' || u.id, 'sha256'), 'hex')
      from auth.users u, unnest(array['campo-catalogo', 'campo-sincronizar', 'campo-mensajes']) p
      where u.email = any(array[${lista(CUENTAS)}])
    );`;
  try {
    execFileSync("docker", ["exec", "-i", "supabase_db_vacinfo", "psql", "-U", "postgres", "-d", "postgres", "-q"], { input: sql, stdio: ["pipe", "ignore", "inherit"] });
  } catch (e) {
    console.warn("No se pudieron limpiar los contadores (¿Docker apagado?):", e.message);
  }
}

// ─────────────────────────── Cabeceras ───────────────────────────
const ESPERADAS = {
  "content-security-policy": (v) => /default-src 'self'/.test(v) && /frame-ancestors 'none'/.test(v) && /object-src 'none'/.test(v),
  "x-content-type-options": (v) => v === "nosniff",
  "x-frame-options": (v) => v === "DENY",
  "referrer-policy": (v) => v === "strict-origin-when-cross-origin",
  "permissions-policy": (v) => /camera=\(self\)/.test(v) && /microphone=\(\)/.test(v),
  "strict-transport-security": (v) => /max-age=\d+/.test(v),
};

async function cabeceras(cookie) {
  console.log("\nCabeceras de seguridad");
  for (const ruta of ["/login", "/campo/registrar", "/sw.js"]) {
    const res = await fetch(BASE + ruta, { redirect: "manual", headers: ruta === "/login" ? {} : { cookie } });
    console.log(`  ${ruta} → ${res.status}`);
    for (const [nombre, valida] of Object.entries(ESPERADAS)) {
      const valor = res.headers.get(nombre);
      console.log(`      ${nombre}: ${valor}`);
      comprobar(valor !== null && valida(valor), `${ruta} ${nombre}`);
    }
    if (ruta === "/sw.js") {
      comprobar(res.headers.get("service-worker-allowed") === "/", "/sw.js Service-Worker-Allowed: /");
      comprobar(/javascript/.test(res.headers.get("content-type") ?? ""), "/sw.js se sirve como JavaScript (nosniff)");
    }
  }
}

// ─────────────────────────── Inicio de sesión (formulario sin JavaScript) ───────────────────────────
const decodificar = (s) => s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

async function intentarLogin(identificador, password) {
  const html = await (await fetch(`${BASE}/login`, { headers: { "x-forwarded-for": IP } })).text();
  const formulario = html.match(/<form[^>]*>([\s\S]*?)<\/form>/)?.[1] ?? "";
  const datos = new FormData();
  for (const [input] of formulario.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
    const nombre = input.match(/name="([^"]*)"/)?.[1];
    if (nombre) datos.append(decodificar(nombre), decodificar(input.match(/value="([^"]*)"/)?.[1] ?? ""));
  }
  datos.append("identificador", identificador);
  datos.append("password", password);
  const res = await fetch(`${BASE}/login`, { method: "POST", body: datos, redirect: "manual", headers: { "x-forwarded-for": IP } });
  const texto = await res.text();
  if (res.status >= 300 && res.status < 400) return "entra";
  if (texto.includes("Demasiados intentos")) return "bloqueado";
  if (texto.includes("incorrectos")) return "incorrecto";
  return `desconocido (${res.status})`;
}

async function login() {
  console.log(`\nInicio de sesión (IP de prueba ${IP})`);
  const jhon = [];
  for (let i = 0; i < 6; i++) jhon.push(await intentarLogin(CUENTAS[0], "clave-mala"));
  console.log("  jhon, 6 contraseñas malas:", jhon.join(", "));
  comprobar(jhon.slice(0, 5).every((r) => r === "incorrecto"), "los 5 primeros fallos dicen 'incorrectos'");
  comprobar(jhon[5] === "bloqueado", "el 6.º intento queda bloqueado con 'Demasiados intentos'");
  comprobar((await intentarLogin(CUENTAS[0], CLAVE_DEMO)) === "bloqueado", "la contraseña correcta tampoco entra mientras dura el bloqueo");
  comprobar((await intentarLogin(CUENTAS[2], CLAVE_DEMO)) === "entra", "otra cuenta desde la misma IP sí entra");

  const consultor = [];
  for (let i = 0; i < 3; i++) consultor.push(await intentarLogin(CUENTAS[1], "clave-mala"));
  consultor.push(await intentarLogin(CUENTAS[1], CLAVE_DEMO));
  for (let i = 0; i < 4; i++) consultor.push(await intentarLogin(CUENTAS[1], "clave-mala"));
  console.log("  consultor, 3 malas + 1 buena + 4 malas:", consultor.join(", "));
  comprobar(consultor[3] === "entra", "entra con la contraseña correcta tras 3 fallos");
  comprobar(consultor.slice(4).every((r) => r === "incorrecto"), "entrar reinicia el contador de la cuenta");
}

// ─────────────────────────── API de VacDaTa ───────────────────────────
async function api(cookie) {
  console.log("\nAPI de VacDaTa");
  let limite = null;
  for (let i = 1; i <= 30 && !limite; i++) {
    const res = await fetch(`${BASE}/api/campo/catalogo`, { headers: { cookie } });
    if (res.status === 429) limite = { i, res, cuerpo: await res.json() };
    else await res.arrayBuffer();
  }
  comprobar(limite?.i === 21, `catálogo: 429 en la petición ${limite?.i ?? "ninguna"} (límite 20/min)`);
  if (limite) {
    console.log(`      Retry-After: ${limite.res.headers.get("retry-after")} · ${JSON.stringify(limite.cuerpo)}`);
    comprobar(Number(limite.res.headers.get("retry-after")) > 0, "429 trae Retry-After");
    comprobar(/Demasiados intentos/.test(limite.cuerpo.error ?? ""), "429 trae JSON { error }");
  }

  const grande = JSON.stringify({ registros: [{ cliente_id: "x", accion: "ordeno", datos: "a".repeat(1024 * 1024) }] });
  const conLargo = await fetch(`${BASE}/api/campo/sincronizar`, { method: "POST", headers: { cookie, "content-type": "application/json" }, body: grande });
  comprobar(conLargo.status === 413, `sincronizar >1 MB con content-length → ${conLargo.status}`);

  const flujo = new ReadableStream({
    start(c) {
      c.enqueue(new TextEncoder().encode(grande));
      c.close();
    },
  });
  const sinLargo = await fetch(`${BASE}/api/campo/sincronizar`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: flujo,
    duplex: "half",
  });
  comprobar(sinLargo.status === 413, `sincronizar >1 MB sin content-length → ${sinLargo.status}`);

  const vacio = await fetch(`${BASE}/api/campo/sincronizar`, { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ registros: [] }) });
  comprobar(vacio.status === 200, `sincronizar con lote vacío sigue respondiendo 200 → ${vacio.status}`);
}

limpiar();
try {
  const cookie = (await cookiesDe(CUENTAS[0])).map((c) => `${c.name}=${c.value}`).join("; ");
  await cabeceras(cookie);
  await login();
  await api(cookie);
} finally {
  limpiar();
}

console.log(fallos ? `\n${fallos} comprobaciones fallaron.` : "\nTodo bien.");
process.exit(fallos ? 1 : 0);

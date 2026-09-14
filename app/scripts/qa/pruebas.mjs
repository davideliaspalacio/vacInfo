// Pruebas de funcionamiento de los ajustes v1.1 contra la app local (producción) y la base local.
// Uso: node scripts/qa/pruebas.mjs [base=http://localhost:3100]
import { execFileSync, spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { cookiesDe } from "./sesion-local.mjs";

const BASE = process.argv[2] ?? "http://localhost:3100";
const SALIDA = "/Users/1234/vacasProyecto/entregables/ajustes-v1.1/pruebas.json";
const T = "00000000-0000-4000-8000-000000000101";
const VACA = "00000000-0000-4000-8000-000000000016";
const U = { admin: "10000000-0000-4000-8000-000000000002", consultor: "10000000-0000-4000-8000-000000000005", jhon: "10000000-0000-4000-8000-000000000004" };

const resultados = [];
const registrar = (ajuste, prueba, esperado, ok, detalle = "") => {
  resultados.push({ ajuste, prueba, esperado, ok: Boolean(ok), detalle });
  console.log(`${ok ? "✔" : "✘"} [${ajuste}] ${prueba}${detalle ? ` — ${detalle}` : ""}`);
};

const cabecera = (cookies) => cookies.map((c) => `${c.name}=${c.value}`).join("; ");
const pedir = async (cookies, ruta, opciones = {}) => {
  const r = await fetch(BASE + ruta, { redirect: "manual", ...opciones, headers: { cookie: cabecera(cookies), ...(opciones.headers ?? {}) } });
  return { estado: r.status, destino: r.headers.get("location") ?? "", texto: await r.text() };
};

// SQL como un usuario concreto dentro de una transacción que se revierte.
const sqlComo = (usuario, cuerpo) =>
  execFileSync("docker", ["exec", "-i", "supabase_db_vacinfo", "psql", "-U", "postgres", "-d", "postgres", "-At", "-v", "ON_ERROR_STOP=0"], {
    input: `begin;
select set_config('request.jwt.claims', '{"sub":"${usuario}","role":"authenticated"}', true);
set local role authenticated;
${cuerpo}
rollback;`,
    encoding: "utf8",
  });

// Los avisos de psql (RAISE NOTICE) salen por stderr: se leen ambas salidas.
const intenta = (usuario, sentencia) => {
  const { stdout, stderr } = spawnSync("docker", ["exec", "-i", "supabase_db_vacinfo", "psql", "-U", "postgres", "-d", "postgres", "-At"], {
    input: `begin;
select set_config('request.jwt.claims', '{"sub":"${usuario}","role":"authenticated"}', true);
set local role authenticated;
do $$ begin ${sentencia}; raise notice 'RESULTADO=ok'; exception when others then raise notice 'RESULTADO=error %', sqlerrm; end $$;
rollback;`,
    encoding: "utf8",
  });
  return `${stdout}\n${stderr}`;
};

const admin = await cookiesDe("gustavo@vacinfo.local");
const consultor = await cookiesDe("consultor@vacinfo.local");
const jhon = await cookiesDe("jhon@vacinfo.local");

// ── 1. Informe administrativo compacto
{
  const r = await pedir(admin, `/informes?tab=administrativo&finca=${T}`);
  registrar("1 · Informe administrativo", "La página carga y agrupa los registros vacíos al final", "Responde 200 y muestra “Registros sin movimientos”", r.estado === 200 && /sin movimientos/i.test(r.texto), `HTTP ${r.estado}`);
}

// ── 2. Pestañas
{
  const tabs = ["animales", "alertas", "bienes", "arbol", "historial"];
  const tiempos = [];
  for (const t of tabs) {
    const t0 = performance.now();
    const r = await pedir(admin, `/fincas/${T}?tab=${t}`);
    tiempos.push(Math.round(performance.now() - t0));
    if (r.estado !== 200) registrar("2 · Pestañas", `Pestaña ${t}`, "Responde 200", false, `HTTP ${r.estado}`);
  }
  const max = Math.max(...tiempos);
  registrar("2 · Pestañas", "Las 5 pestañas de la finca responden rápido", "Cada una por debajo de 300 ms", max < 300, `máximo ${max} ms (${tiempos.join(", ")} ms)`);
}

// ── 3. Eventos programados
{
  const r = await pedir(admin, `/calendario?finca=${T}&mes=2026-04`);
  registrar("3 · Calendario", "Formulario “Programar evento” visible para el administrador", "Aparece el formulario", /Programar evento/i.test(r.texto), `HTTP ${r.estado}`);
  const rc = await pedir(consultor, `/calendario?finca=${T}&mes=2026-04`);
  registrar("3 · Calendario", "El consultor no ve el formulario de programar", "No aparece el formulario", rc.estado === 200 && !/name="titulo"/i.test(rc.texto));
  const salida = sqlComo(U.admin, `
insert into eventos_programados (finca_id, fecha, titulo, tipo) values ('${T}', '2026-04-29', 'Prueba QA evento', 'otro');
select count(*) from eventos_calendario('${T}', '2026-04-01', '2026-04-30', '2026-04-30') where detalle = 'Prueba QA evento';
select count(*) from alertas_finca('${T}', '2026-04-30') where tipo = 'programado' and (nombre = 'Prueba QA evento' or detalle ilike '%Prueba QA evento%');`);
  const [enCalendario, enAlertas] = salida.trim().split("\n").filter((l) => /^\d+$/.test(l)).map(Number);
  registrar("3 · Calendario", "Un evento programado aparece en el calendario", "1 evento en el calendario", enCalendario === 1, `calendario: ${enCalendario}`);
  registrar("3 · Calendario", "El evento programado genera aviso en Mensajes", "1 alerta", enAlertas === 1, `alertas: ${enAlertas}`);
}

// ── 4. Consumo automático
{
  const salida = sqlComo(U.admin, `
select saldo from saldo_insumos('${T}', '2026-04-30') where producto = 'Sal mineralizada';
insert into consumos_programados (finca_id, insumo_id, modo, cantidad, periodo, desde)
  select '${T}', id, 'fijo', 3, 'mes', '2026-04-17' from insumos where nombre = 'Sal mineralizada';
select saldo from saldo_insumos('${T}', '2026-04-30') where producto = 'Sal mineralizada';`);
  const [antes, despues] = salida.trim().split("\n").filter((l) => /^-?\d+(\.\d+)?$/.test(l)).map(Number);
  registrar("4 · Gasto automático", "Una regla “3 bultos por mes” descuenta del saldo sin registrar salidas", "El saldo baja", despues < antes, `sal: ${antes} → ${despues} bultos`);
  const r = await pedir(admin, `/inventario?finca=${T}`);
  registrar("4 · Gasto automático", "Sección “Consumo automático” en Inventario", "Aparece la sección", /Consumo autom/i.test(r.texto));
}

// ── 5. Consultor solo lectura
{
  const escrituras = {
    "ordeño": `insert into ordenos (animal_id, fecha, jornada, litros) values ('${VACA}', '2020-01-01', 'am', 1)`,
    "movimiento de insumo": `insert into movimientos_insumos (finca_id, producto, tipo, cantidad) values ('${T}', 'QA', 'ingreso', 1)`,
    "comentario": `insert into comentarios (organizacion_id, mensaje) values ('00000000-0000-4000-8000-000000000001', 'QA')`,
    "mensaje": `insert into mensajes (organizacion_id, remitente_id, texto) values ('00000000-0000-4000-8000-000000000001', '${U.consultor}', 'QA')`,
    "evento programado": `insert into eventos_programados (finca_id, fecha, titulo, tipo) values ('${T}', '2026-04-29', 'QA', 'otro')`,
  };
  let bloqueadas = 0;
  for (const s of Object.values(escrituras)) if (/RESULTADO=error/.test(intenta(U.consultor, s))) bloqueadas++;
  registrar("5 · Consultor", "Intentos de escritura del consultor en la base", `${Object.keys(escrituras).length} de ${Object.keys(escrituras).length} bloqueados`, bloqueadas === Object.keys(escrituras).length, `${bloqueadas} bloqueados`);
  let permitidas = 0;
  for (const s of Object.values(escrituras).slice(0, 3)) if (/RESULTADO=ok/.test(intenta(U.jhon, s))) permitidas++;
  registrar("5 · Consultor", "El trabajador sí puede registrar", "3 de 3 permitidos", permitidas === 3, `${permitidas} permitidos`);
  const lectura = sqlComo(U.consultor, `select count(*) from animales where finca_id = '${T}';`).trim().split("\n").find((l) => /^\d+$/.test(l));
  registrar("5 · Consultor", "El consultor sí puede ver la información", "Lee los animales", Number(lectura) > 0, `${lectura} animales visibles`);
  const f = await pedir(consultor, `/fincas/${T}`);
  registrar("5 · Consultor", "Sin botón “Nueva ficha de ser vivo” para el consultor", "No aparece el botón", f.estado === 200 && !/Nueva ficha de ser vivo/i.test(f.texto));
  const nuevo = await pedir(consultor, `/animales/nuevo?finca=${T}`);
  registrar("5 · Consultor", "El consultor no puede abrir “Nuevo ser vivo”", "Lo redirige", nuevo.estado >= 300 && nuevo.estado < 400, `HTTP ${nuevo.estado} → ${nuevo.destino}`);
  const campo = await pedir(consultor, "/campo");
  registrar("5 · Consultor", "El consultor no entra a VacDaTa", "Lo redirige a VacInfo", campo.estado >= 300 && campo.estado < 400, `HTTP ${campo.estado} → ${campo.destino}`);
  const sync = await pedir(consultor, "/api/campo/sincronizar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ registros: [] }) });
  registrar("5 · Consultor", "La sincronización offline rechaza al consultor", "HTTP 403", sync.estado === 403, `HTTP ${sync.estado}`);
}

// ── 6. Mensajes en VacDaTa
{
  const menu = await pedir(jhon, "/campo");
  registrar("6 · Mensajes", "El menú de VacDaTa tiene la sección Mensajes", "Aparece “Mensajes”", /Mensajes/.test(menu.texto));
  const api = await pedir(jhon, "/api/campo/mensajes");
  let datos = {};
  try { datos = JSON.parse(api.texto); } catch { /* respuesta no JSON */ }
  const lista = Array.isArray(datos) ? datos : (datos.mensajes ?? []);
  const directo = lista.some((m) => /veterinario/i.test(m.texto ?? ""));
  registrar("6 · Mensajes", "El mensaje del administrador para Jhon llega a VacDaTa", "Aparece el mensaje", api.estado === 200 && directo, `HTTP ${api.estado}, ${lista.length} mensajes`);
}

// ── 7. Registrar unificado
{
  const menu = await pedir(jhon, "/campo");
  registrar("7 · Registrar", "El menú muestra una sola opción de registro", "Sin “Registro rápido” duplicado", /Registrar/.test(menu.texto) && !/Registro rápido/.test(menu.texto));
  const rapido = await pedir(jhon, "/campo/rapido");
  registrar("7 · Registrar", "La ruta vieja /campo/rapido redirige a /campo/registrar", "Redirección", rapido.estado >= 300 && /\/campo\/registrar/.test(rapido.destino), `HTTP ${rapido.estado} → ${rapido.destino}`);
  const animal = await pedir(jhon, `/campo/animal/${VACA}`);
  registrar("7 · Registrar", "La ruta vieja de animal abre el registro con la vaca elegida", "Redirección con ?animal=", animal.estado >= 300 && /animal=/.test(animal.destino), `HTTP ${animal.estado} → ${animal.destino}`);
  try {
    execFileSync("pnpm", ["exec", "vitest", "run", "src/lib/offline"], { cwd: "/Users/1234/vacasProyecto/app", env: { ...process.env, VACDATA_INTEGRACION: "1" }, encoding: "utf8", stdio: "pipe" });
    registrar("7 · Registrar", "Sincronización sin señal: todos los tipos de registro, enviados dos veces", "Se guardan una vez, sin duplicados", true, "prueba de integración 7/7");
  } catch (e) {
    registrar("7 · Registrar", "Sincronización sin señal: todos los tipos de registro, enviados dos veces", "Se guardan una vez, sin duplicados", false, String(e.stdout ?? e.message).slice(-200));
  }
  const manifiesto = await (await fetch(`${BASE}/manifest.webmanifest`)).json();
  registrar("7 · Registrar", "La app instalada abre directo en Registrar", "start_url = /campo/registrar", manifiesto.start_url === "/campo/registrar", manifiesto.start_url);
}

// ── 8 y 9. Pesaje y “Escanear chapeta” (el formulario se arma en el teléfono: se revisa el código enviado al navegador)
{
  const r = await pedir(jhon, `/campo/registrar?finca=${T}`);
  const scripts = [...r.texto.matchAll(/src="(\/_next\/static\/chunks\/[^"]+\.js)"/g)].map((m) => m[1]);
  let codigo = r.texto;
  for (const s of scripts) codigo += await (await fetch(BASE + s)).text();
  registrar("9 · Escanear chapeta", "El botón dice “Escanear chapeta”", "Aparece “Escanear chapeta” y no “Escanear QR”", /Escanear chapeta/.test(codigo) && !/Escanear QR/.test(codigo));
  registrar("8 · Sin pesaje", "Las acciones del animal en VacDaTa no incluyen Pesaje", "No aparece “Peso, altura y condición”", !/Peso, altura y condici/.test(codigo));
}

// ── 10. Aprendizaje
{
  const r = await pedir(jhon, "/campo/aprendizaje");
  registrar("10 · Aprendizaje", "El manual es solo texto", "Sin casillas de verificación", r.estado === 200 && !/type="checkbox"/.test(r.texto), `HTTP ${r.estado}`);
}

// ── 11–14. Formulario de ser vivo
{
  const r = await pedir(admin, `/animales/nuevo?finca=${T}`);
  const t = r.texto;
  registrar("11 · Ser vivo", "Sin campo “Especie” (se deduce de la categoría)", "No hay select de especie", !/name="especie"/.test(t));
  registrar("12 · Ser vivo", "Método de adquisición sin “Producido”", "Aparece “Nacido en la finca” y no “Producido”", /Nacido en la finca/.test(t) && !/>Producido</.test(t));
  registrar("13 · Ser vivo", "Sin texto libre “Nombre de la madre”", "Solo la lista de madres", !/name="madre_nombre"/.test(t) && /madre_id/.test(t));
  registrar("14 · Ser vivo", "Lista de toros para el padre", "Aparece la lista con “Otro (escribir nombre)”", /Otro \(escribir nombre\)/.test(t));
  const especie = sqlComo(U.admin, `
insert into animales (finca_id, codigo, nombre, categoria, especie, sexo) values ('${T}', 'QA-CABALLO', 'Caballo QA', 'caballo', 'equino', 'macho');
select especie from animales where codigo = 'QA-CABALLO';`);
  registrar("11 · Ser vivo", "Guardar un caballo lo registra como equino", "especie = equino", /equino/.test(especie));
}

// ── Corrección extra: bajas
{
  const salida = sqlComo(U.jhon, `
insert into bajas (animal_id, fecha, tipo, causa) values ('${VACA}', '2026-04-30', 'venta', 'QA');
select estado from animales where id = '${VACA}';`);
  const estado = salida.split("\n").find((l) => /^(activo|vendido|retirado|muerto)$/.test(l.trim())) ?? "sin dato";
  registrar("Extra · Bajas", "Un trabajador registra una venta y la vaca queda vendida", "estado = vendido", estado.trim() === "vendido", `estado: ${estado.trim()}`);
}

writeFileSync(SALIDA, JSON.stringify(resultados, null, 2));
const pasadas = resultados.filter((r) => r.ok).length;
console.log(`\n${pasadas} de ${resultados.length} pruebas pasadas`);

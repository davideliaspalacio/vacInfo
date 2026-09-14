// Pruebas de la segunda revisión + regresión de la revisión anterior (pruebas.mjs).
// Uso: node scripts/qa/pruebas-revision2.mjs [base=http://localhost:3100]
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { cookiesDe } from "./sesion-local.mjs";

const BASE = process.argv[2] ?? "http://localhost:3100";
const DIR = "/Users/1234/vacasProyecto/entregables/revision-2";
const APP = "/Users/1234/vacasProyecto/app";
const T = "00000000-0000-4000-8000-000000000101";
const ADMIN = "10000000-0000-4000-8000-000000000002";
const JHON = "10000000-0000-4000-8000-000000000004";

const resultados = [];
const registrar = (ajuste, prueba, ok, detalle = "") => {
  resultados.push({ ajuste, prueba, ok: Boolean(ok), detalle });
  console.log(`${ok ? "✔" : "✘"} [${ajuste}] ${prueba}${detalle ? ` — ${detalle}` : ""}`);
};

const cabecera = (c) => c.map((x) => `${x.name}=${x.value}`).join("; ");
const pedir = async (cookies, ruta) => {
  const r = await fetch(BASE + ruta, { redirect: "manual", headers: { cookie: cabecera(cookies) } });
  return { estado: r.status, texto: await r.text() };
};
const sql = (cuerpo) =>
  execFileSync("docker", ["exec", "-i", "supabase_db_vacinfo", "psql", "-U", "postgres", "-d", "postgres", "-At"], { input: cuerpo, encoding: "utf8" });
const sqlComo = (usuario, cuerpo) =>
  sql(`begin;
select set_config('request.jwt.claims', '{"sub":"${usuario}","role":"authenticated"}', true);
set local role authenticated;
${cuerpo}
rollback;`);
const numeros = (salida) => salida.split("\n").filter((l) => /^-?\d+$/.test(l.trim())).map(Number);
const contar = (patron) => {
  try {
    // Textos visibles: pantallas, componentes, archivos públicos y semillas. `src/lib` queda fuera porque
    // guarda la compatibilidad con datos antiguos (p. ej. `vacas_horras`) y los tipos generados de la base.
    return Number(execFileSync("sh", ["-c", `grep -rioE '${patron}' src/app src/components public supabase/seed*.sql | wc -l`], { cwd: APP, encoding: "utf8" }).trim());
  } catch {
    return 0;
  }
};

const admin = await cookiesDe("gustavo@vacinfo.local");
const jhon = await cookiesDe("jhon@vacinfo.local");

// ── 1 · Costos
{
  const r = await pedir(admin, `/fincas/${T}/costos`);
  const inputsAnimales = (r.texto.match(/name="(animales|vacas_produccion|vacas_horras|novillas|terneras|terneronas|toros)[^"]*"/g) ?? []).length;
  registrar("1 · Costos", "La página de costos carga", r.estado === 200, `HTTP ${r.estado}`);
  registrar("1 · Costos", "No hay casillas editables para la cantidad de animales", inputsAnimales === 0, `${inputsAnimales} casillas`);
  registrar("1 · Costos", "Indica dónde agregar o retirar animales", /Gestionar fincas|ficha del animal|VacDaTa/i.test(r.texto));
}

// ── 2 · Rango de fechas
for (const [nombre, ruta] of [
  ["Finca", `/fincas/${T}`],
  ["Levante", `/fincas/${T}/levante`],
  ["Potreros", `/fincas/${T}/potreros`],
  ["Inventario", `/inventario?finca=${T}`],
  ["Indicadores", `/indicadores?finca=${T}`],
  ["Ficha de animal", "/animales/00000000-0000-4000-8000-000000000016"],
]) {
  const r = await pedir(admin, ruta);
  registrar("2 · Rango de fechas", `${nombre}: tiene Desde y Hasta`, r.estado === 200 && /name="desde"/.test(r.texto) && /name="hasta"/.test(r.texto), `HTTP ${r.estado}`);
}
{
  const r = await pedir(admin, `/fincas/${T}?desde=2026-04-01&hasta=2026-04-15`);
  registrar("2 · Rango de fechas", "Un rango elegido se refleja en la página", r.estado === 200 && /15\/04\/2026|15\/04\/26/.test(r.texto), `HTTP ${r.estado}`);
  const legado = await pedir(admin, `/fincas/${T}?corte=2026-04-20`);
  registrar("2 · Rango de fechas", "Los enlaces viejos con fecha de corte siguen funcionando", legado.estado === 200, `HTTP ${legado.estado}`);
}

// ── 3 · Parientes por especie y sexo
{
  const r = await pedir(admin, `/animales/nuevo?finca=${T}`);
  registrar("3 · Parientes", "El formulario de nuevo ser vivo carga", r.estado === 200, `HTTP ${r.estado}`);
  const machosComoMadre = numeros(sql(`select count(*) from animales where finca_id='${T}' and sexo='macho' and categoria in ('vaca','novilla','ternera');`))[0];
  registrar("3 · Parientes", "No hay animales con categoría femenina y sexo macho", machosComoMadre === 0, `${machosComoMadre}`);
  try {
    execFileSync("pnpm", ["exec", "vitest", "run", "src/lib/__tests__"], { cwd: APP, encoding: "utf8", stdio: "pipe" });
    registrar("3 · Parientes", "Pruebas unitarias de filtrado de parientes y rango de fechas", true);
  } catch (e) {
    registrar("3 · Parientes", "Pruebas unitarias de filtrado de parientes y rango de fechas", false, String(e.stdout ?? "").slice(-160));
  }
}

// ── 4 · Etapas
{
  const enBase = numeros(sql("select count(*) from animales where categoria::text = 'ternerona';"))[0];
  registrar("4 · Etapas", "Ningún animal quedó como ternerona", enBase === 0, `${enBase} en la base`);
  const rechazo = sqlComo(ADMIN, `do $$ begin insert into animales (finca_id, codigo, nombre, categoria, sexo) values ('${T}', 'QA-TNA', 'QA', 'ternerona', 'hembra'); raise notice 'R=ok'; exception when others then raise notice 'R=error'; end $$;`);
  registrar("4 · Etapas", "La base rechaza crear una ternerona nueva", !/R=ok/.test(rechazo));
  const novillo = sqlComo(ADMIN, `insert into animales (finca_id, codigo, nombre, categoria, sexo) values ('${T}', 'QA-NOV', 'QA', 'novillo', 'macho'); select count(*) from animales where codigo='QA-NOV';`);
  registrar("4 · Etapas", "Se puede registrar un novillo", numeros(novillo).includes(1));
  const f = await pedir(admin, `/animales/nuevo?finca=${T}`);
  registrar("4 · Etapas", "El formulario ofrece Novillo y no Ternerona", /Novillo/.test(f.texto) && !/Ternerona/i.test(f.texto));
  const l = await pedir(admin, `/fincas/${T}/levante`);
  registrar("4 · Etapas", "Levante no muestra “ternerona”", l.estado === 200 && !/ternerona/i.test(l.texto));
}

// ── 5 · Descartar notificaciones
{
  const r = await pedir(admin, "/mensajes");
  registrar("5 · Notificaciones", "Botón “Descartar” en las notificaciones", r.estado === 200 && /Descartar/.test(r.texto));
  const salida = sqlComo(ADMIN, `
insert into alertas_descartadas (finca_id, clave, fecha_alerta) values ('${T}', 'qa:prueba:2026-04-30', '2026-04-30');
select count(*) from alertas_descartadas where clave = 'qa:prueba:2026-04-30';
select set_config('request.jwt.claims', '{"sub":"${JHON}","role":"authenticated"}', true);
select count(*) from alertas_descartadas where clave = 'qa:prueba:2026-04-30';`);
  const [propio, ajeno] = numeros(salida);
  registrar("5 · Notificaciones", "Descartar guarda la notificación para ese usuario", propio === 1, `${propio}`);
  registrar("5 · Notificaciones", "Otro usuario no ve lo que descartó el administrador", ajeno === 0, `${ajeno}`);
}

// ── 6 · Vaca seca
{
  // `vacas_horras` es un nombre interno de columna/código que se conserva para no romper datos; se cuentan solo textos.
  const horra = contar("(^|[^_a-z])horras?");
  registrar("6 · Vaca seca", "Sin “horra” en textos visibles de la app ni semillas", horra === 0, `${horra} menciones`);
  const grupos = numeros(sql("select count(*) from rotaciones_potrero where grupo ilike '%horra%';"))[0];
  registrar("6 · Vaca seca", "Grupos de potrero renombrados a “secas”", grupos === 0, `${grupos} con “horras”`);
  const f = await pedir(admin, `/fincas/${T}?tab=animales`);
  registrar("6 · Vaca seca", "El resumen de la finca dice “secas”", f.estado === 200 && /secas?/i.test(f.texto) && !/horra/i.test(f.texto));
}

// ── Métricas después
const metricas = {
  ternerona_src: contar("ternerona"),
  horra_src: contar("(^|[^_a-z])horras?"),
  ternerona_db: numeros(sql("select count(*) from animales where categoria::text='ternerona';"))[0],
  grupos_horras_db: numeros(sql("select count(*) from rotaciones_potrero where grupo ilike '%horra%';"))[0],
};
writeFileSync(`${DIR}/despues/metricas.txt`, Object.entries(metricas).map(([k, v]) => `${k}=${v}`).join("\n") + "\n");

// ── Regresión: pruebas de la revisión anterior
execFileSync("node", ["scripts/qa/pruebas.mjs", BASE], { cwd: APP, stdio: "ignore" });
const anteriores = JSON.parse(readFileSync("/Users/1234/vacasProyecto/entregables/ajustes-v1.1/pruebas.json", "utf8"));
const okAnt = anteriores.filter((p) => p.ok).length;
registrar("Regresión v1.1", `Pruebas de la revisión anterior (${anteriores.length})`, okAnt === anteriores.length, `${okAnt} de ${anteriores.length}`);
for (const p of anteriores.filter((p) => !p.ok)) registrar("Regresión v1.1", p.prueba, false, p.detalle);

writeFileSync(`${DIR}/pruebas.json`, JSON.stringify(resultados, null, 2));
console.log(`\n${resultados.filter((r) => r.ok).length} de ${resultados.length} pruebas pasadas`);

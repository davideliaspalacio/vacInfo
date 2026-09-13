"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { obtenerSesion } from "@/lib/sesion";
import { avisoPotrero, moverGrupo, sacarGrupo } from "@/components/potreros/rotacion";

type Cliente = Awaited<ReturnType<typeof createClient>>;
type ErrorBD = { message: string; code?: string };

// ─────────────────────────── Esquemas base ───────────────────────────
const limpiar = (v: unknown) => (typeof v === "string" ? (v.trim() === "" ? undefined : v.trim()) : v);
const aNumero = (v: unknown) => {
  const x = limpiar(v);
  return typeof x === "string" ? Number(x.replace(",", ".")) : x;
};

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const texto = z.preprocess(limpiar, z.string().max(2000).optional());
const requerido = z.preprocess(limpiar, z.string().min(1).max(2000));
const hora = z.preprocess(limpiar, z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional());
const numero = z.preprocess(aNumero, z.number().min(0).optional());
const numeroRequerido = z.preprocess(aNumero, z.number().min(0));
const entero = z.preprocess(aNumero, z.number().int().min(0).optional());
const casilla = z.preprocess((v) => v === "on", z.boolean());
const siNo = z.preprocess((v) => (v === "si" ? true : v === "no" ? false : undefined), z.boolean().optional());
const jornada = z.enum(["am", "pm"]);
const jornadaOpcional = z.preprocess(limpiar, jornada.optional());
const uuidOpcional = z.preprocess(limpiar, uuid.optional());

const ETIQUETAS: Record<string, string> = {
  animal_id: "animal",
  finca_id: "finca",
  toro_nombre: "nombre del toro",
  toro_raza: "raza del toro",
  dias_prenez: "días de preñez",
  cria_sexo: "sexo de la cría",
  dias_retiro: "días de retiro",
  proxima_fecha: "próxima fecha",
  cuartos: "cuartos afectados",
  dias_retiro_pastoreo: "días de retiro del pastoreo",
  animales_tratados: "animales tratados",
  kg_concentrado_vacas: "consumo del día",
  hora_ingreso: "hora",
  peso_kg: "peso",
  altura_cm: "altura",
  condicion_corporal: "condición corporal (1 a 5)",
  potrero_id: "potrero destino",
  potrero_ids: "potreros",
};

// ─────────────────────────── Utilidades ───────────────────────────
function rutaSegura(valor: FormDataEntryValue | null) {
  const ruta = typeof valor === "string" ? valor : "";
  return ruta.startsWith("/campo") ? ruta : "/campo";
}

function conParametros(ruta: string, extra: Record<string, string>) {
  const url = new URL(ruta, "http://vacdata.local");
  url.searchParams.delete("ok");
  url.searchParams.delete("error");
  for (const [clave, valor] of Object.entries(extra)) url.searchParams.set(clave, valor);
  return `${url.pathname}${url.search}`;
}

function mensajeValidacion(error: z.ZodError) {
  const campo = String(error.issues[0]?.path[0] ?? "formulario");
  return `Revisa el campo «${ETIQUETAS[campo] ?? campo.replaceAll("_", " ")}»: falta o no es válido.`;
}

function mensajeBD(error: ErrorBD) {
  if (error.code === "AVISO") return error.message;
  if (error.code === "42501" || /row-level security/i.test(error.message)) return "No tienes permiso para registrar en esta finca.";
  if (error.code === "23514") return "Algún valor no es válido. Revisa los números y las opciones.";
  if (error.code === "23505") return "Ese registro ya existe.";
  return `No se pudo guardar: ${error.message}`;
}

/** Valida el formulario, guarda y vuelve con ?ok= o ?error=. */
async function procesar<T extends z.ZodType>(
  formData: FormData,
  esquema: T,
  guardar: (datos: z.output<T>, supabase: Cliente) => PromiseLike<{ error: ErrorBD | null }>,
  exito: string | ((datos: z.output<T>) => string),
) {
  const volver = rutaSegura(formData.get("volver"));
  const reabrir = Object.fromEntries(new URLSearchParams(String(formData.get("paso") ?? "")));

  const leido = esquema.safeParse({
    ...Object.fromEntries(formData),
    cuartos: formData.getAll("cuartos"),
    potrero_ids: formData.getAll("potrero_ids"),
  });
  if (!leido.success) redirect(conParametros(volver, { ...reabrir, error: mensajeValidacion(leido.error) }));

  const supabase = await createClient();
  const { error } = await guardar(leido.data, supabase);
  if (error) redirect(conParametros(volver, { ...reabrir, error: mensajeBD(error) }));

  revalidatePath("/", "layout");
  redirect(conParametros(volver, { ok: typeof exito === "function" ? exito(leido.data) : exito }));
}

const aviso = (message: string) => ({ error: { message, code: "AVISO" } });

// ─────────────────────────── Eventos del animal ───────────────────────────
const delAnimal = { animal_id: uuid, fecha };

export async function registrarOrdeno(formData: FormData) {
  await procesar(
    formData,
    z.object({ ...delAnimal, jornada, litros: numeroRequerido }),
    (d, s) => s.from("ordenos").upsert(d, { onConflict: "animal_id,fecha,jornada" }),
    "Ordeño guardado",
  );
}

export async function registrarServicio(formData: FormData) {
  await procesar(
    formData,
    z.object({
      ...delAnimal,
      tipo: z.enum(["inseminacion", "monta"]),
      toro_nombre: texto,
      toro_raza: texto,
      inseminador: texto,
      jornada: jornadaOpcional,
      observaciones: texto,
    }),
    (d, s) => s.from("servicios").insert(d),
    "Servicio guardado. Palpar en 33 días",
  );
}

export async function registrarPalpacion(formData: FormData) {
  await procesar(
    formData,
    z.object({
      ...delAnimal,
      resultado: z.enum(["prenada", "vacia"]),
      dias_prenez: entero,
      veterinario: texto,
      observaciones: texto,
    }),
    (d, s) => s.from("palpaciones").insert(d),
    "Palpación guardada",
  );
}

export async function registrarParto(formData: FormData) {
  const conCria = (d: { registrar_cria: boolean; aborto: boolean; nacido_vivo?: boolean }) => d.registrar_cria && !d.aborto && d.nacido_vivo !== false;

  await procesar(
    formData,
    z
      .object({
        ...delAnimal,
        cria_sexo: z.preprocess(limpiar, z.enum(["hembra", "macho"]).optional()),
        cria_raza: texto,
        en_la_noche: siNo,
        nacido_vivo: siNo,
        aborto: casilla,
        toma_calostro: siNo,
        persona_calostro: texto,
        placenta_expulsada: siNo,
        lavado: siNo,
        observaciones: texto,
        registrar_cria: casilla,
        cria_nombre: z.preprocess(limpiar, z.string().max(120).optional()),
        cria_chapeta: z.preprocess(limpiar, z.string().max(30).optional()),
      })
      .refine((d) => !conCria(d) || d.cria_sexo !== undefined, { path: ["cria_sexo"] }),
    async ({ registrar_cria, cria_nombre, cria_chapeta, ...parto }, s) => {
      if (!conCria({ registrar_cria, ...parto })) return s.rpc("registrar_parto", { p_parto: parto });

      const { data: madre } = await s.from("animales").select("finca_id, codigo, nombre, raza").eq("id", parto.animal_id).single();
      if (!madre) return aviso("No se encontró la madre.");

      // Código de la cría: prefijo de la finca (tomado de la madre) + chapeta, o T + marca de tiempo.
      const prefijo = madre.codigo.split("-")[0] || "CRIA";
      const base = `${prefijo}-${cria_chapeta ?? `T${Date.now().toString(36).toUpperCase().slice(-6)}`}`;
      const { data: parecidos } = await s.from("animales").select("codigo").eq("finca_id", madre.finca_id).like("codigo", `${base}%`);
      const usados = new Set((parecidos ?? []).map((a) => a.codigo));
      let codigo = base;
      for (let n = 2; usados.has(codigo); n++) codigo = `${base}-${n}`;

      // La función crea la cría y el parto en una sola transacción.
      return s.rpc("registrar_parto", {
        p_parto: parto,
        p_cria: {
          codigo,
          nombre: cria_nombre ?? `Cría de ${madre.nombre}`,
          chapeta: cria_chapeta ?? null,
          sexo: parto.cria_sexo,
          raza: parto.cria_raza ?? madre.raza,
        },
      });
    },
    (d) => (conCria(d) ? "Parto guardado y ficha de la cría creada" : "Parto guardado"),
  );
}

export async function registrarPesaje(formData: FormData) {
  await procesar(
    formData,
    z.object({
      ...delAnimal,
      peso_kg: z.preprocess(aNumero, z.number().positive()),
      altura_cm: numero,
      condicion_corporal: z.preprocess(aNumero, z.number().min(1).max(5).optional()),
      observaciones: texto,
    }),
    async (d, s) => {
      const r = await s.from("pesajes").upsert(d, { onConflict: "animal_id,fecha" });
      if (r.error && (r.error.code === "42501" || /row-level security/i.test(r.error.message)))
        return aviso("Ya hay un pesaje de ese día. Pide al administrador que lo corrija.");
      return r;
    },
    (d) => `Pesaje guardado: ${String(d.peso_kg).replace(".", ",")} kg`,
  );
}

export async function registrarDestete(formData: FormData) {
  await procesar(
    formData,
    z.object(delAnimal),
    (d, s) => s.rpc("registrar_destete", { p_animal: d.animal_id, p_fecha: d.fecha }),
    "Destete registrado",
  );
}

export async function registrarSecado(formData: FormData) {
  await procesar(
    formData,
    z.object({ ...delAnimal, motivo: texto }),
    (d, s) => s.from("secados").insert(d),
    "Secado guardado",
  );
}

export async function registrarSalud(formData: FormData) {
  await procesar(
    formData,
    z
      .object({
        ...delAnimal,
        tipo: z.enum(["vacuna", "enfermedad", "tratamiento", "mastitis", "cojera", "fiebre"]),
        diagnostico: texto,
        producto: texto,
        lote: texto,
        registro_ica: texto,
        dosis: texto,
        via_administracion: texto,
        dias_retiro: entero,
        proxima_fecha: z.preprocess(limpiar, fecha.optional()),
        cuartos: z.array(z.enum(["TDD", "TDI", "TTD", "TTI"])),
        veterinario: texto,
        tarjeta_profesional: texto,
        operario: texto,
        observaciones: texto,
      })
      .refine((d) => d.tipo !== "mastitis" || d.cuartos.length > 0, { path: ["cuartos"] }),
    (d, s) =>
      s.from("eventos_sanitarios").insert({
        ...d,
        cuartos: d.cuartos.length ? d.cuartos : undefined,
        estado: d.tipo === "tratamiento" ? "en_tratamiento" : "activo",
      }),
    "Registro de salud guardado",
  );
}

export async function registrarBaja(formData: FormData) {
  await procesar(
    formData,
    z.object({
      ...delAnimal,
      tipo: z.enum(["venta", "retiro", "muerte"]),
      causa: texto,
      responsable_traslado: texto,
      valor: numero,
    }),
    (d, s) => s.from("bajas").insert(d),
    "Salida del animal registrada",
  );
}

// ─────────────────────────── Registros de la finca ───────────────────────────
const deFinca = { finca_id: uuid, fecha };

export async function registrarRecoleccion(formData: FormData) {
  await procesar(
    formData,
    z.object({
      ...deFinca,
      litros: numeroRequerido,
      placa: texto,
      conductor: texto,
      celular_conductor: texto,
      entregado_por: texto,
    }),
    (d, s) => s.from("recolecciones_leche").insert(d),
    "Recolección del carro tanque guardada",
  );
}

export async function registrarMantenimiento(formData: FormData) {
  await procesar(
    formData,
    z.object({
      ...deFinca,
      tipo: z.enum(["equipo_ordeno", "tanque", "cercas", "equipos", "general"]),
      bien_id: uuidOpcional,
      detalle: requerido,
      potreros: texto,
      materiales: texto,
      responsable: texto,
      celular: texto,
    }),
    (d, s) => s.from("mantenimientos").insert(d),
    "Mantenimiento guardado",
  );
}

export async function registrarAplicacion(formData: FormData) {
  await procesar(
    formData,
    z.object({
      ...deFinca,
      tipo: z.enum(["fumigacion", "fertilizacion", "abonada", "encalada", "veneno_mosca", "veneno_roedores"]),
      producto: requerido,
      cantidad: numero,
      unidad: texto,
      potreros: texto,
      potrero_ids: z.array(uuid),
      area: texto,
      dias_retiro_pastoreo: entero,
      animales_tratados: entero,
      jornada: jornadaOpcional,
      personas: texto,
    }),
    async ({ potrero_ids, ...d }, s) => {
      if (!potrero_ids.length) return s.from("aplicaciones_campo").insert(d);
      // Se conserva el texto «potreros» (7, 8, 9) para los informes que lo leen.
      const { data: elegidos } = await s.from("potreros").select("numero").eq("finca_id", d.finca_id).in("id", potrero_ids).order("numero");
      const numeros = (elegidos ?? []).map((p) => String(p.numero));
      const escritos = (d.potreros ?? "").split(/[^0-9]+/).filter(Boolean);
      const potreros = [...new Set([...numeros, ...escritos])].sort((a, b) => Number(a) - Number(b)).join(", ");
      return s.from("aplicaciones_campo").insert({ ...d, potreros: potreros || d.potreros, potrero_ids });
    },
    "Aplicación guardada",
  );
}

export async function registrarRotacion(formData: FormData) {
  await procesar(
    formData,
    z.object({
      ...deFinca,
      grupo: requerido,
      animales: entero,
      potrero_id: uuidOpcional,
      confirmar: casilla,
      observaciones: texto,
    }),
    async (d, s) => {
      if (!d.potrero_id) return sacarGrupo(s, d);

      const [{ data: estados }, { data: finca }] = await Promise.all([
        s.rpc("estado_potreros", { p_finca: d.finca_id, p_corte: d.fecha }),
        s.from("fincas").select("dias_descanso_objetivo").eq("id", d.finca_id).single(),
      ]);
      const destino = estados?.find((p) => p.potrero_id === d.potrero_id);
      if (!destino) return aviso("Ese potrero no es de esta finca.");
      const alerta = destino.grupo === d.grupo ? null : avisoPotrero(destino, finca?.dias_descanso_objetivo ?? 35);
      if (alerta && !d.confirmar) return aviso(`${alerta} Si igual vas a entrar el grupo, marca «Entrar de todas formas».`);

      return moverGrupo(s, { ...d, potrero_id: d.potrero_id });
    },
    (d) => (d.potrero_id ? `«${d.grupo}» quedó en el potrero` : `«${d.grupo}» salió del potrero`),
  );
}

export async function registrarControl(formData: FormData) {
  await procesar(
    formData,
    z
      .object({
        ...deFinca,
        tipo: z.enum(["agua", "temperatura_tanque"]),
        jornada: jornadaOpcional,
        muestra: texto,
        ph: numero,
        cloro: numero,
        grados: z.preprocess(aNumero, z.number().optional()),
        estado: texto,
        tratamiento: texto,
        responsable: texto,
      })
      .refine((d) => d.tipo !== "temperatura_tanque" || d.grados !== undefined, { path: ["grados"] })
      .refine((d) => d.tipo !== "agua" || d.ph !== undefined || d.cloro !== undefined, { path: ["ph"] }),
    (d, s) => s.from("controles_calidad").insert(d),
    "Control guardado",
  );
}

export async function registrarMovimientoInsumo(formData: FormData) {
  await procesar(
    formData,
    z.object({
      ...deFinca,
      producto: requerido,
      tipo: z.enum(["ingreso", "salida"]),
      cantidad: numeroRequerido,
      hora: hora,
      entrega: texto,
      recibe: texto,
    }),
    async (d, s) => {
      const { data: insumo } = await s.from("insumos").select("id").eq("nombre", d.producto).limit(1).maybeSingle();
      return s.from("movimientos_insumos").insert({ ...d, insumo_id: insumo?.id });
    },
    "Movimiento de insumo guardado",
  );
}

export async function registrarConsumo(formData: FormData) {
  await procesar(
    formData,
    z
      .object({
        ...deFinca,
        kg_concentrado_vacas: numero,
        kg_sal_vacas: numero,
        kg_concentrado_terneras: numero,
        kg_sal_terneras: numero,
      })
      .refine((d) => [d.kg_concentrado_vacas, d.kg_sal_vacas, d.kg_concentrado_terneras, d.kg_sal_terneras].some((v) => v !== undefined), {
        path: ["kg_concentrado_vacas"],
      }),
    (d, s) => s.from("consumos_diarios").upsert(d, { onConflict: "finca_id,fecha" }),
    "Consumo del día guardado",
  );
}

export async function registrarVisita(formData: FormData) {
  await procesar(
    formData,
    z.object({
      ...deFinca,
      nombre: requerido,
      cedula: texto,
      empresa: texto,
      placa: texto,
      hora_ingreso: hora,
      motivo: texto,
    }),
    (d, s) => s.from("visitas").insert(d),
    "Visita registrada",
  );
}

// ─────────────────────────── Comentarios ───────────────────────────
export async function enviarComentario(formData: FormData) {
  const { organizacionId } = await obtenerSesion();
  await procesar(
    formData,
    z.object({
      finca_id: uuidOpcional,
      mensaje: requerido,
      urgencia: z.enum(["baja", "media", "alta"]),
    }),
    (d, s) => s.from("comentarios").insert({ ...d, organizacion_id: organizacionId }),
    "Tu comentario llegó al administrador",
  );
}

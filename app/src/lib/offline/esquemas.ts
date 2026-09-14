import { z } from "zod";
import { ACCIONES, type Accion } from "./tipos";

// Aceptan tanto valores de formulario ("12,5", "si", "on") como JSON ya limpio, para validar igual en el teléfono y en el servidor.
const limpiar = (v: unknown) => (typeof v === "string" ? (v.trim() === "" ? undefined : v.trim()) : (v ?? undefined));
const aNumero = (v: unknown) => {
  const x = limpiar(v);
  return typeof x === "string" ? Number(x.replace(",", ".")) : x;
};
const aBooleano = (v: unknown) => {
  const x = limpiar(v);
  if (x === true || x === "si" || x === "on" || x === "true") return true;
  if (x === false || x === "no" || x === "false") return false;
  return undefined;
};

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const uuid = z.string().regex(UUID);
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const texto = z.preprocess(limpiar, z.string().max(2000).optional());
const entero = z.preprocess(aNumero, z.number().int().min(0).max(100000).optional());
const booleano = z.preprocess(aBooleano, z.boolean().optional());
const kilos = z.preprocess(aNumero, z.number().min(0).max(100000).optional());
const jornada = z.enum(["am", "pm"]);
const jornadaOpcional = z.preprocess(limpiar, jornada.optional());
const litrosVaca = z.preprocess(aNumero, z.number().min(0).max(99));
const requerido = z.preprocess(limpiar, z.string().min(1).max(2000));
const cantidad = z.preprocess(aNumero, z.number().min(0).max(10000000).optional());
const hora = z.preprocess(limpiar, z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional());
const fechaOpcional = z.preprocess(limpiar, fecha.optional());
const uuidOpcional = z.preprocess(limpiar, uuid.optional());
const lista = <T extends z.ZodType>(item: T, max: number) =>
  z.preprocess((v) => (v == null || v === "" ? [] : Array.isArray(v) ? v : [v]), z.array(item).max(max));

export const TIPOS_SALUD = [
  "vacuna",
  "enfermedad",
  "tratamiento",
  "mastitis",
  "cojera",
  "fiebre",
  "entamborada",
  "fiebre_leche",
  "cirugia",
  "desparasitacion",
] as const;
export const CUARTOS = ["TDD", "TDI", "TTD", "TTI"] as const;

/** La cría solo se crea si se pidió, no fue aborto y nació viva. */
export const partoConCria = (d: { registrar_cria?: boolean; aborto?: boolean; nacido_vivo?: boolean }) =>
  d.registrar_cria === true && d.aborto !== true && d.nacido_vivo !== false;

const delAnimal = { animal_id: uuid, fecha };
const deFinca = { finca_id: uuid, fecha };

export const ESQUEMAS = {
  ordeno: z.object({ ...delAnimal, jornada, litros: litrosVaca }),
  ordeno_lista: z.object({
    fecha,
    jornada,
    items: z.array(z.object({ animal_id: uuid, litros: litrosVaca })).min(1).max(500),
  }),
  servicio: z.object({
    ...delAnimal,
    tipo: z.enum(["inseminacion", "monta"]),
    toro_nombre: texto,
    toro_raza: texto,
    inseminador: texto,
    jornada: z.preprocess(limpiar, jornada.optional()),
    observaciones: texto,
  }),
  palpacion: z.object({
    ...delAnimal,
    resultado: z.enum(["prenada", "vacia"]),
    dias_prenez: entero,
    veterinario: texto,
    observaciones: texto,
  }),
  parto: z
    .object({
      ...delAnimal,
      cria_sexo: z.preprocess(limpiar, z.enum(["hembra", "macho"]).optional()),
      cria_raza: texto,
      en_la_noche: booleano,
      nacido_vivo: booleano,
      aborto: booleano,
      toma_calostro: booleano,
      persona_calostro: texto,
      placenta_expulsada: booleano,
      lavado: booleano,
      observaciones: texto,
      registrar_cria: booleano,
      cria_nombre: z.preprocess(limpiar, z.string().max(120).optional()),
      cria_chapeta: z.preprocess(limpiar, z.string().max(30).optional()),
    })
    .refine((d) => !partoConCria(d) || d.cria_sexo !== undefined, { path: ["cria_sexo"] }),
  secado: z.object({ ...delAnimal, motivo: texto }),
  salud: z
    .object({
      ...delAnimal,
      tipo: z.enum(TIPOS_SALUD),
      diagnostico: texto,
      producto: texto,
      lote: texto,
      registro_ica: texto,
      dosis: texto,
      via_administracion: texto,
      dias_retiro: entero,
      proxima_fecha: fechaOpcional,
      cuartos: lista(z.enum(CUARTOS), 4),
      veterinario: texto,
      tarjeta_profesional: texto,
      operario: texto,
      observaciones: texto,
    })
    .refine((d) => d.tipo !== "mastitis" || d.cuartos.length > 0, { path: ["cuartos"] }),
  destete: z.object(delAnimal),
  baja: z.object({
    ...delAnimal,
    tipo: z.enum(["muerte", "venta", "retiro"]),
    causa: texto,
    responsable_traslado: texto,
    valor: cantidad,
  }),
  pesaje: z.object({ ...delAnimal, peso_kg: z.preprocess(aNumero, z.number().gt(0).max(2000)) }),
  carro_tanque: z.object({
    ...deFinca,
    litros: z.preprocess(aNumero, z.number().gt(0).max(1000000)),
    placa: texto,
    conductor: texto,
    celular_conductor: texto,
    entregado_por: texto,
  }),
  mantenimiento: z.object({
    ...deFinca,
    tipo: z.enum(["equipo_ordeno", "tanque", "cercas", "equipos", "general"]),
    bien_id: uuidOpcional,
    detalle: requerido,
    potreros: texto,
    materiales: texto,
    responsable: texto,
    celular: texto,
  }),
  aplicacion: z.object({
    ...deFinca,
    tipo: z.enum(["fumigacion", "fertilizacion", "abonada", "encalada", "veneno_mosca", "veneno_roedores"]),
    producto: requerido,
    cantidad,
    unidad: texto,
    potreros: texto,
    potrero_ids: lista(uuid, 200),
    area: texto,
    dias_retiro_pastoreo: entero,
    animales_tratados: entero,
    jornada: jornadaOpcional,
    personas: texto,
  }),
  control_calidad: z
    .object({
      ...deFinca,
      tipo: z.enum(["agua", "temperatura_tanque"]),
      jornada: jornadaOpcional,
      muestra: texto,
      ph: z.preprocess(aNumero, z.number().min(0).max(14).optional()),
      cloro: cantidad,
      grados: z.preprocess(aNumero, z.number().min(-30).max(100).optional()),
      estado: texto,
      tratamiento: texto,
      responsable: texto,
    })
    .refine((d) => d.tipo !== "temperatura_tanque" || d.grados !== undefined, { path: ["grados"] })
    .refine((d) => d.tipo !== "agua" || d.ph !== undefined || d.cloro !== undefined, { path: ["ph"] }),
  movimiento_insumo: z.object({
    ...deFinca,
    producto: requerido,
    tipo: z.enum(["ingreso", "salida"]),
    cantidad: z.preprocess(aNumero, z.number().gt(0).max(10000000)),
    hora,
    entrega: texto,
    recibe: texto,
  }),
  visita: z.object({
    ...deFinca,
    nombre: requerido,
    cedula: texto,
    empresa: texto,
    placa: texto,
    hora_ingreso: hora,
    motivo: texto,
  }),
  rotacion: z.object({
    ...deFinca,
    grupo: requerido,
    animales: entero,
    /** Sin potrero destino: solo se saca el grupo del potrero donde está. */
    potrero_id: uuidOpcional,
    observaciones: texto,
  }),
  consumo_diario: z
    .object({
      ...deFinca,
      kg_concentrado_vacas: kilos,
      kg_sal_vacas: kilos,
      kg_concentrado_terneras: kilos,
      kg_sal_terneras: kilos,
    })
    .refine((d) => [d.kg_concentrado_vacas, d.kg_sal_vacas, d.kg_concentrado_terneras, d.kg_sal_terneras].some((v) => v !== undefined), {
      path: ["kg_concentrado_vacas"],
    }),
} satisfies Record<Accion, z.ZodType>;

export type DatosDe<A extends Accion> = z.output<(typeof ESQUEMAS)[A]>;

export function esAccion(valor: unknown): valor is Accion {
  return typeof valor === "string" && (ACCIONES as readonly string[]).includes(valor);
}

const ETIQUETAS: Record<string, string> = {
  animal_id: "animal",
  finca_id: "finca",
  toro_nombre: "nombre del toro",
  toro_raza: "raza del toro",
  dias_prenez: "días de preñez",
  cria_sexo: "sexo de la cría",
  dias_retiro: "días de retiro",
  cuartos: "cuartos afectados",
  peso_kg: "peso",
  kg_concentrado_vacas: "consumo del día",
  items: "litros por vaca",
  proxima_fecha: "próxima dosis",
  via_administracion: "vía",
  bien_id: "equipo o bien",
  potrero_ids: "potreros",
  potrero_id: "potrero destino",
  dias_retiro_pastoreo: "días de retiro del pastoreo",
  animales_tratados: "animales tratados",
  hora_ingreso: "hora de ingreso",
  ph: "pH o cloro",
  grados: "grados",
  cria_nombre: "nombre de la cría",
  cria_chapeta: "chapeta de la cría",
};

export function mensajeValidacion(error: z.ZodError) {
  const ruta = error.issues[0]?.path ?? [];
  const campo = String([...ruta].reverse().find((p) => typeof p === "string") ?? "formulario");
  return `Revisa el campo «${ETIQUETAS[campo] ?? campo.replaceAll("_", " ")}»: falta o no es válido.`;
}

/** Valida los datos de una acción; devuelve los datos limpios o el mensaje para el trabajador. */
export function validarDatos(accion: Accion, datos: unknown): { ok: true; datos: Record<string, unknown> } | { ok: false; mensaje: string } {
  const r = (ESQUEMAS[accion] as z.ZodType<Record<string, unknown>>).safeParse(datos);
  return r.success ? { ok: true, datos: r.data } : { ok: false, mensaje: mensajeValidacion(r.error) };
}

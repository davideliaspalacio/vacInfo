import type { Database } from "@/lib/database.types";

type E = Database["public"]["Enums"];

export const CATEGORIAS: Record<E["categoria_animal"], string> = {
  vaca: "Vaca",
  novilla: "Novilla",
  novillo: "Novillo",
  ternera: "Ternera",
  // Etapa eliminada: la base convierte cualquier "ternerona" en novilla. Se conserva solo para el tipo del enum.
  ternerona: "Novilla",
  ternero: "Ternero",
  toro: "Toro",
  caballo: "Caballo",
  perro: "Perro",
  otro: "Otro",
};

export const CATEGORIAS_PLURAL: Record<E["categoria_animal"], string> = {
  vaca: "Vacas",
  novilla: "Novillas",
  novillo: "Novillos",
  ternera: "Terneras",
  ternerona: "Novillas",
  ternero: "Terneros",
  toro: "Toros",
  caballo: "Caballos",
  perro: "Perros",
  otro: "Otros",
};

export const ESPECIES: Record<E["especie"], string> = {
  bovino: "Bovino",
  equino: "Equino",
  canino: "Canino",
  ave: "Ave",
  otro: "Otro",
};

export const SEXOS: Record<E["sexo"], string> = { hembra: "Hembra", macho: "Macho" };

export const ESTADOS_ANIMAL: Record<E["estado_animal"], string> = {
  activo: "Activo",
  vendido: "Vendido",
  retirado: "Retirado",
  muerto: "Muerto",
};

export const TIPOS_BIEN: Record<E["tipo_bien"], string> = {
  equipo: "Equipo",
  vehiculo: "Vehículo",
  herramienta: "Herramienta",
  maquinaria: "Maquinaria",
  infraestructura: "Infraestructura",
  otro: "Otro",
};

export const TIPOS_BIEN_PLURAL: Record<E["tipo_bien"], string> = {
  equipo: "Equipos",
  vehiculo: "Vehículos",
  herramienta: "Herramientas",
  maquinaria: "Maquinaria",
  infraestructura: "Infraestructura",
  otro: "Otros bienes",
};

export const ESTADOS_BIEN: Record<E["estado_bien"], { texto: string; tono: "verde" | "amarillo" | "rojo" }> = {
  bueno: { texto: "Bueno", tono: "verde" },
  mantenimiento: { texto: "Necesita mantenimiento", tono: "amarillo" },
  malo: { texto: "Malo", tono: "rojo" },
};

export const TIPOS_MANTENIMIENTO: Record<E["tipo_mantenimiento"], string> = {
  equipo_ordeno: "Equipo de ordeño",
  tanque: "Tanque",
  cercas: "Cercas y zanjas",
  equipos: "Equipos",
  general: "General",
};

export const TIPOS_APLICACION: Record<E["tipo_aplicacion"], string> = {
  fumigacion: "Fumigación",
  fertilizacion: "Fertilización",
  abonada: "Abonada",
  encalada: "Encalada",
  veneno_mosca: "Veneno mosca",
  veneno_roedores: "Veneno roedores",
};

export const TIPOS_SANITARIOS: Record<E["tipo_evento_sanitario"], string> = {
  enfermedad: "Enfermedad",
  tratamiento: "Tratamiento",
  vacuna: "Vacuna",
  mastitis: "Mastitis",
  cojera: "Cojera",
  fiebre: "Fiebre",
  entamborada: "Entamborada",
  fiebre_leche: "Fiebre de leche",
  cirugia: "Cirugía",
  desparasitacion: "Desparasitación",
};

export const ESTADOS_SANITARIOS: Record<E["estado_sanitario"], { texto: string; tono: "verde" | "amarillo" | "rojo" }> = {
  activo: { texto: "Activo", tono: "rojo" },
  en_tratamiento: { texto: "En tratamiento", tono: "amarillo" },
  resuelto: { texto: "Resuelto", tono: "verde" },
};

export const TIPOS_BAJA: Record<E["tipo_baja"], string> = { venta: "Venta", retiro: "Retiro", muerte: "Muerte" };

export const URGENCIAS: Record<E["urgencia"], { texto: string; tono: "verde" | "amarillo" | "rojo" }> = {
  alta: { texto: "Alta", tono: "rojo" },
  media: { texto: "Media", tono: "amarillo" },
  baja: { texto: "Baja", tono: "verde" },
};

export const TIPOS_ALERTA: Record<string, string> = {
  palpar: "Palpar",
  secar: "Secar",
  parto: "Parto",
  mora_prenez: "Mora de preñez",
  retiro_leche: "Retiro de leche",
  vacuna: "Vacuna",
  destete: "Destete",
  insumo: "Insumo",
  novilla_lista: "Novilla lista",
  programado: "Evento agendado",
};

/** La especie se deduce de la categoría: el formulario solo pide la categoría. */
export const ESPECIE_DE_CATEGORIA: Record<E["categoria_animal"], E["especie"]> = {
  vaca: "bovino",
  novilla: "bovino",
  novillo: "bovino",
  ternerona: "bovino",
  ternera: "bovino",
  ternero: "bovino",
  toro: "bovino",
  caballo: "equino",
  perro: "canino",
  otro: "otro",
};

export const GRUPOS_CATEGORIA: { titulo: string; categorias: E["categoria_animal"][] }[] = [
  { titulo: "Hembras bovinas", categorias: ["ternera", "novilla", "vaca"] },
  { titulo: "Machos bovinos", categorias: ["ternero", "novillo", "toro"] },
  { titulo: "Otros animales", categorias: ["caballo", "perro", "otro"] },
];

/** Categorías que se muestran, en orden de etapa (sin "ternerona"). */
export const ORDEN_CATEGORIAS: E["categoria_animal"][] = GRUPOS_CATEGORIA.flatMap((g) => g.categorias);

export const METODOS_ADQUISICION = ["Nacido en la finca", "Compra", "Donación / regalo", "Traslado desde otra finca", "Otro"];

/** Prefijo de códigos de una finca: el más usado en sus códigos, o las 3 primeras letras del nombre. */
export function prefijoFinca(nombre: string, codigos: string[] = []) {
  const conteo = new Map<string, number>();
  for (const c of codigos) {
    const p = c.split("-")[0];
    if (p && p !== c) conteo.set(p, (conteo.get(p) ?? 0) + 1);
  }
  const masUsado = [...conteo.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (masUsado) return masUsado;
  const base = nombre
    .replace(/^finca\s+/i, "")
    .normalize("NFD")
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase();
  return base.slice(0, 3) || "FIN";
}

/** Las 4 letras de la finca para el código: «Finca Toneles» → TONE. */
export function letrasFinca(nombre: string) {
  const base = nombre
    .replace(/^finca\s+/i, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase();
  return (base.slice(0, 4) || "FINC").padEnd(4, "X");
}

const sinTildes = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toUpperCase();

/**
 * Código automático del animal: 4 letras de la finca, nombre y número de chapeta.
 * «Finca Toneles» + «Josefina» + 2079 → TONE-JOSEFINA-2079. Si falta nombre o chapeta,
 * se arma con lo que haya; quien llama resuelve los repetidos.
 */
export function codigoAnimal(nombreFinca: string, nombreAnimal: string, chapeta?: string | null) {
  const partes = [letrasFinca(nombreFinca), sinTildes(nombreAnimal ?? ""), sinTildes(String(chapeta ?? ""))];
  return partes.filter(Boolean).join("-");
}

/**
 * Etapa reproductiva que se muestra. Manda la **categoría** del animal: una vaca que no está
 * en ordeño está seca, aunque no tenga partos registrados (al cargar el hato con la plantilla
 * nadie trae el historial). Antes se deducía solo de los partos y toda vaca sin historial
 * aparecía como «novilla», sin importar su edad.
 *
 * Sigue siendo coherente con la regla híbrida de la base (`etapa_de_animal`): un animal solo
 * queda en categoría «vaca» si parió, si da leche o si pasa de 36 meses sin un solo dato, así
 * que confiar en la categoría ya no asciende sola a la novilla que nunca ha parido: mientras sea
 * novilla aquí aparece «Novilla», tenga 15 meses o 30, con servicio o sin él.
 */
export function etapaReproductiva(a: { en_ordeno: boolean; ultimo_parto: string | null; categoria: string }) {
  if (a.en_ordeno) return "ordeno" as const;
  if (a.ultimo_parto || a.categoria === "vaca") return "seca" as const;
  return "novilla" as const;
}

export const ETIQUETA_ETAPA_REPRODUCTIVA = { ordeno: "Ordeño", seca: "Seca", novilla: "Novilla" } as const;

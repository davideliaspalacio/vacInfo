import type { Evento } from "./tipos";

export const TIPOS_PROGRAMABLES = [
  "vacunacion",
  "palpacion",
  "secado",
  "parto",
  "tratamiento",
  "mantenimiento",
  "fumigacion",
  "abonada",
  "visita_veterinario",
  "reunion",
  "otro",
] as const;
export type TipoProgramable = (typeof TIPOS_PROGRAMABLES)[number];

export const ETIQUETA_PROGRAMADO: Record<TipoProgramable, string> = {
  vacunacion: "Vacunación",
  palpacion: "Palpación",
  secado: "Secado",
  parto: "Parto",
  tratamiento: "Tratamiento",
  mantenimiento: "Mantenimiento",
  fumigacion: "Fumigación",
  abonada: "Abonada",
  visita_veterinario: "Visita del veterinario",
  reunion: "Reunión",
  otro: "Otro",
};

export const ESTADOS_PROGRAMADO = ["pendiente", "hecho", "cancelado"] as const;

export const SELECT_PROGRAMADO = "id, fecha, hora, titulo, tipo, animal_id, descripcion, estado, recordar_dias, registrado_en, animales(nombre, chapeta)";

export type EventoProgramado = {
  id: string;
  fecha: string;
  hora: string | null;
  titulo: string;
  tipo: string;
  animal_id: string | null;
  descripcion: string | null;
  estado: string;
  recordar_dias: number;
  registrado_en: string;
  animales: { nombre: string; chapeta: string | null } | null;
};

export const etiquetaProgramado = (tipo: string | undefined) => ETIQUETA_PROGRAMADO[tipo as TipoProgramable] ?? "Evento";

export const horaCorta = (hora: string | null | undefined) => (hora ? hora.slice(0, 5) : null);

export function aEvento(e: EventoProgramado): Evento {
  return {
    fecha: e.fecha,
    tipo: "programado",
    realizado: e.estado === "hecho",
    animal_id: e.animal_id,
    nombre: e.animales?.nombre ?? null,
    chapeta: e.animales?.chapeta ?? null,
    detalle: e.titulo,
    id: e.id,
    hora: e.hora,
    subtipo: e.tipo,
    estado: e.estado,
  };
}

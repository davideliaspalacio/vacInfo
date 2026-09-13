export const ESTADOS_LEVANTE = {
  lactante: { texto: "Lactante", plural: "Terneras lactantes", tono: "azul" },
  destetar: { texto: "Por destetar", plural: "Por destetar", tono: "amarillo" },
  levante: { texto: "Levante", plural: "Levante", tono: "gris" },
  lista_servicio: { texto: "Lista para servicio", plural: "Listas para servicio", tono: "verde" },
  servida: { texto: "Servida", plural: "Novillas servidas y preñadas", tono: "azul" },
  prenada: { texto: "Preñada", plural: "Novillas servidas y preñadas", tono: "verde" },
} as const;

export type EstadoLevante = keyof typeof ESTADOS_LEVANTE;

export const CATEGORIAS_LEVANTE = ["ternera", "ternero", "ternerona", "novilla"] as const;

export const esLevante = (categoria: string) => (CATEGORIAS_LEVANTE as readonly string[]).includes(categoria);

/** Ganancia diaria: verde ≥ 600 g, ámbar 400–599, rojo < 400. */
export function tonoGanancia(g: number | null | undefined) {
  if (g == null) return "text-tinta-suave";
  if (g >= 600) return "font-bold text-pasto-oscuro";
  if (g >= 400) return "font-bold text-[#8a6100]";
  return "font-bold text-alerta";
}

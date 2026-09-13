export type Evento = {
  fecha: string;
  tipo: string;
  realizado: boolean;
  animal_id: string | null;
  nombre: string | null;
  chapeta: string | null;
  detalle: string | null;
};

type Tipo = {
  etiqueta: string;
  realizado: boolean;
  /** Chip lleno (evento realizado) */
  solido: string;
  /** Chip con borde (evento programado) */
  contorno: string;
  punto: string;
};

// Cada programado comparte color con el realizado que lo origina (palpar ↔ palpación, secar ↔ secado…).
export const TIPOS: Record<string, Tipo> = {
  parto: { etiqueta: "Parto", realizado: true, solido: "border-pink-700 bg-pink-700 text-white", contorno: "", punto: "bg-pink-700" },
  servicio: { etiqueta: "Servicio", realizado: true, solido: "border-violet-700 bg-violet-700 text-white", contorno: "", punto: "bg-violet-700" },
  palpacion: { etiqueta: "Palpación", realizado: true, solido: "border-sky-700 bg-sky-700 text-white", contorno: "", punto: "bg-sky-700" },
  secado: { etiqueta: "Secado", realizado: true, solido: "border-amber-600 bg-amber-600 text-white", contorno: "", punto: "bg-amber-600" },
  sanidad: { etiqueta: "Sanidad", realizado: true, solido: "border-teal-700 bg-teal-700 text-white", contorno: "", punto: "bg-teal-700" },
  pesaje: { etiqueta: "Pesaje", realizado: true, solido: "border-stone-600 bg-stone-600 text-white", contorno: "", punto: "bg-stone-600" },
  destete: { etiqueta: "Destete", realizado: true, solido: "border-pasto-oscuro bg-pasto-oscuro text-white", contorno: "", punto: "bg-pasto-oscuro" },
  palpar: { etiqueta: "Palpar", realizado: false, solido: "", contorno: "border-sky-700 bg-white text-sky-800", punto: "border-2 border-sky-700" },
  secar: { etiqueta: "Secar", realizado: false, solido: "", contorno: "border-amber-600 bg-white text-amber-800", punto: "border-2 border-amber-600" },
  parto_esperado: { etiqueta: "Parto esperado", realizado: false, solido: "", contorno: "border-pink-700 bg-white text-pink-800", punto: "border-2 border-pink-700" },
  vacuna: { etiqueta: "Vacuna", realizado: false, solido: "", contorno: "border-teal-700 bg-white text-teal-800", punto: "border-2 border-teal-700" },
  fin_retiro: { etiqueta: "Fin de retiro", realizado: false, solido: "", contorno: "border-orange-600 bg-white text-orange-800", punto: "border-2 border-orange-600" },
  destetar: { etiqueta: "Destetar", realizado: false, solido: "", contorno: "border-pasto-oscuro bg-white text-pasto-oscuro", punto: "border-2 border-pasto-oscuro" },
};

export const TIPO_DESCONOCIDO: Tipo = { etiqueta: "Evento", realizado: true, solido: "border-tinta-suave bg-tinta-suave text-white", contorno: "border-tinta-suave bg-white text-tinta", punto: "bg-tinta-suave" };

export const VENCIDO = "border-alerta bg-[#fbe9e5] text-alerta";

export const tipoDe = (t: string) => TIPOS[t] ?? TIPO_DESCONOCIDO;

/** Clases del chip según si se hizo, está programado o ya se pasó la fecha. */
export function claseEvento(e: Evento, corte: string) {
  const t = tipoDe(e.tipo);
  if (e.realizado) return t.solido || t.contorno;
  if (e.fecha < corte) return VENCIDO;
  return t.contorno || t.solido;
}

export const nombreAnimal = (e: Evento) => e.nombre || e.chapeta || "Animal";

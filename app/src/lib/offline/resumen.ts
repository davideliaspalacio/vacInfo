import type { Accion, AnimalCatalogo } from "./tipos";

const numero = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });
const fechaHoraFmt = new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export const ETIQUETA_ACCION: Record<Accion, string> = {
  ordeno: "Ordeño",
  ordeno_lista: "Ordeño por lista",
  servicio: "Servicio",
  palpacion: "Palpación",
  parto: "Parto",
  secado: "Secado",
  salud: "Salud",
  destete: "Destete",
  baja: "Muerte / venta / retiro",
  pesaje: "Pesaje",
  carro_tanque: "Carro tanque",
  consumo_diario: "Consumo del día",
  mantenimiento: "Mantenimiento",
  aplicacion: "Fumigación y abonos",
  control_calidad: "Agua y tanque",
  movimiento_insumo: "Insumos",
  visita: "Visitantes",
  rotacion: "Rotación de potrero",
};

export const formatoNumero = (v: number) => numero.format(v);

export function fechaHora(iso: string | null | undefined) {
  return iso ? fechaHoraFmt.format(new Date(iso)) : "—";
}

/** 'YYYY-MM-DD' → '29/04' */
export function diaMes(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export function nombreAnimal(a: Pick<AnimalCatalogo, "chapeta" | "codigo" | "nombre">) {
  return `${a.chapeta ?? a.codigo} · ${a.nombre}`;
}

/** Texto corto para reconocer el registro en la lista de pendientes. */
export function resumir(accion: Accion, datos: Record<string, unknown>, animal?: AnimalCatalogo) {
  const partes = [ETIQUETA_ACCION[accion]];
  if (typeof datos.jornada === "string") partes[0] += ` ${datos.jornada.toUpperCase()}`;
  if (animal) partes.push(nombreAnimal(animal));
  if (typeof datos.fecha === "string") partes.push(diaMes(datos.fecha));

  if (accion === "ordeno_lista" && Array.isArray(datos.items)) {
    const items = datos.items as { litros: number }[];
    partes.push(`${items.length} vacas · ${formatoNumero(items.reduce((s, i) => s + i.litros, 0))} L`);
  } else if (typeof datos.litros === "number") partes.push(`${formatoNumero(datos.litros)} L`);
  else if (typeof datos.peso_kg === "number") partes.push(`${formatoNumero(datos.peso_kg)} kg`);
  else if (typeof datos.cantidad === "number" && typeof datos.producto === "string") partes.push(`${datos.producto} ${formatoNumero(datos.cantidad)}`);
  else if (typeof datos.grupo === "string") partes.push(datos.grupo);
  else if (typeof datos.nombre === "string") partes.push(datos.nombre);
  else if (typeof datos.tipo === "string") partes.push(datos.tipo.replaceAll("_", " "));
  else if (typeof datos.resultado === "string") partes.push(datos.resultado === "prenada" ? "preñada" : "vacía");

  return partes.join(" · ");
}

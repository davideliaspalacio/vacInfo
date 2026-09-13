import { headers } from "next/headers";
import QRCode from "qrcode";

export async function origenActual() {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000").split(",")[0].trim();
  const local = /^(localhost|127\.|192\.168\.|10\.)/.test(host);
  const protocolo = (h.get("x-forwarded-proto") ?? (local ? "http" : "https")).split(",")[0].trim();
  return `${protocolo}://${host}`;
}

export async function datosCodigo(codigo: string, origen: string) {
  const enlace = `${origen}/unirse?codigo=${codigo}`;
  const svg = await QRCode.toString(enlace, { type: "svg", margin: 1, color: { dark: "#0d291c", light: "#ffffff" } });
  return { codigo, enlace, svg };
}

const formatoVence = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Bogota" });

export function estadoInvitacion(inv: { expira_en: string; usos: number; usos_max: number }) {
  if (Date.parse(inv.expira_en) <= Date.now()) return "vencida" as const;
  return inv.usos >= inv.usos_max ? ("agotada" as const) : ("vigente" as const);
}

export const textoVence =(iso: string) => formatoVence.format(new Date(iso));

import type { Metadata } from "next";
import { RegistroRapido } from "@/components/offline/registro-rapido";

export const metadata: Metadata = { title: { absolute: "Registro rápido · VacDaTa" } };

export default async function RegistroRapidoPage({ searchParams }: PageProps<"/campo/rapido">) {
  const { vista } = await searchParams;
  return <RegistroRapido vistaInicial={typeof vista === "string" ? vista : undefined} />;
}

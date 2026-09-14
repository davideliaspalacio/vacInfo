import { redirect } from "next/navigation";
import { param } from "@/components/campo/ui";

/** Los registros de la finca ahora están en Registrar › Finca. */
export default async function FincaPage({ searchParams }: PageProps<"/campo/finca">) {
  const finca = param((await searchParams).finca);
  redirect(`/campo/registrar?${new URLSearchParams({ vista: "finca", ...(finca ? { finca } : {}) })}`);
}

import { redirect } from "next/navigation";

/** Registro rápido y Registrar datos ahora son una sola opción. */
export default async function RegistroRapidoPage({ searchParams }: PageProps<"/campo/rapido">) {
  const { vista } = await searchParams;
  redirect(typeof vista === "string" ? `/campo/registrar?${new URLSearchParams({ vista })}` : "/campo/registrar");
}

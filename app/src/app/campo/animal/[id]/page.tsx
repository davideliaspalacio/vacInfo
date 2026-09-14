import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/sesion";

/** Enlaces viejos (y QR de chapetas) a la ficha del animal: abren Registrar con el animal elegido. */
export default async function AnimalPage({ params }: PageProps<"/campo/animal/[id]">) {
  const { id } = await params;
  const { supabase } = await obtenerSesion();
  const { data: animal } = await supabase.from("animales").select("id, finca_id").eq("id", id).maybeSingle();
  redirect(animal ? `/campo/registrar?${new URLSearchParams({ finca: animal.finca_id, animal: animal.id })}` : "/campo/registrar");
}

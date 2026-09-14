import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { MENSAJE_SOLO_LECTURA, soloLectura } from "@/lib/permisos";
import type { Rol } from "@/lib/sesion";
import { MAX_REGISTROS, leerLote, procesarRegistros } from "@/lib/offline/servidor";

const SIN_CACHE = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  // Solo JSON: un formulario de otro sitio no puede enviar este tipo de contenido sin permiso previo del navegador.
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Se esperaba JSON." }, { status: 415, headers: SIN_CACHE });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Tu sesión se cerró. Vuelve a entrar." }, { status: 401, headers: SIN_CACHE });

  const { data: membresia } = await supabase.from("miembros").select("rol").eq("usuario_id", user.id).limit(1).maybeSingle();
  if (membresia && soloLectura(membresia.rol as Rol)) {
    return NextResponse.json({ error: `${MENSAJE_SOLO_LECTURA} Los registros no se enviaron.` }, { status: 403, headers: SIN_CACHE });
  }

  const cuerpo: unknown = await request.json().catch(() => null);
  const registros = leerLote(cuerpo);
  if (!registros) {
    return NextResponse.json({ error: `Formato inválido: se esperan hasta ${MAX_REGISTROS} registros.` }, { status: 400, headers: SIN_CACHE });
  }

  const resultados = await procesarRegistros(supabase, registros);
  if (resultados.some((r) => r.estado === "ok")) revalidatePath("/", "layout");

  return NextResponse.json({ resultados }, { headers: SIN_CACHE });
}

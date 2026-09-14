import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { leerBandeja } from "@/lib/offline/mensajes";

const SIN_CACHE = { "Cache-Control": "no-store" };

async function usuario() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

const sinSesion = () => NextResponse.json({ error: "Tu sesión se cerró. Vuelve a entrar." }, { status: 401, headers: SIN_CACHE });

export async function GET() {
  const { supabase, user } = await usuario();
  if (!user) return sinSesion();
  try {
    return NextResponse.json(await leerBandeja(supabase, user.id), { headers: SIN_CACHE });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudieron leer los mensajes." }, { status: 500, headers: SIN_CACHE });
  }
}

const esquemaLeido = z.object({ ids: z.array(z.uuid()).min(1).max(50) });

/** Marca como leídos los mensajes dirigidos al usuario. Los mensajes para todos se marcan solo en el teléfono. */
export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Se esperaba JSON." }, { status: 415, headers: SIN_CACHE });
  }
  const { supabase, user } = await usuario();
  if (!user) return sinSesion();

  const leido = esquemaLeido.safeParse(await request.json().catch(() => null));
  if (!leido.success) return NextResponse.json({ error: "Formato inválido." }, { status: 400, headers: SIN_CACHE });

  const { data, error } = await supabase.from("mensajes").update({ leido: true }).in("id", leido.data.ids).eq("destinatario_id", user.id).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: SIN_CACHE });
  return NextResponse.json({ marcados: (data ?? []).map((m) => m.id) }, { headers: SIN_CACHE });
}

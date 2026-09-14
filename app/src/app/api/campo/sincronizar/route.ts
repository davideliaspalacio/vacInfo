import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { MENSAJE_SOLO_LECTURA, soloLectura } from "@/lib/permisos";
import type { Rol } from "@/lib/sesion";
import { MAX_REGISTROS, leerLote, procesarRegistros } from "@/lib/offline/servidor";
import { REGLAS, limitar, respuestaLimite } from "@/lib/limites";

const SIN_CACHE = { "Cache-Control": "no-store" };
const MAX_BYTES = 1024 * 1024;

const demasiadoGrande = () =>
  NextResponse.json({ error: "El envío es muy grande. Sincroniza en partes más pequeñas." }, { status: 413, headers: SIN_CACHE });

/** Lee el cuerpo sin pasar de MAX_BYTES aunque no venga content-length. null = demasiado grande. */
async function leerCuerpo(request: Request): Promise<string | null> {
  if (!request.body) return "";
  const lector = request.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await lector.cancel().catch(() => undefined);
      return null;
    }
    partes.push(value);
  }
  return Buffer.concat(partes).toString("utf8");
}

export async function POST(request: Request) {
  // Solo JSON: un formulario de otro sitio no puede enviar este tipo de contenido sin permiso previo del navegador.
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Se esperaba JSON." }, { status: 415, headers: SIN_CACHE });
  }
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BYTES) return demasiadoGrande();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Tu sesión se cerró. Vuelve a entrar." }, { status: 401, headers: SIN_CACHE });

  const limite = await limitar(supabase, user.id, REGLAS.sincronizar);
  if (!limite.permitido) return respuestaLimite(limite, SIN_CACHE);

  const { data: membresia } = await supabase.from("miembros").select("rol").eq("usuario_id", user.id).limit(1).maybeSingle();
  if (membresia && soloLectura(membresia.rol as Rol)) {
    return NextResponse.json({ error: `${MENSAJE_SOLO_LECTURA} Los registros no se enviaron.` }, { status: 403, headers: SIN_CACHE });
  }

  const texto = await leerCuerpo(request);
  if (texto === null) return demasiadoGrande();

  let cuerpo: unknown = null;
  try {
    cuerpo = JSON.parse(texto);
  } catch {
    // Se responde abajo como formato inválido.
  }
  const registros = leerLote(cuerpo);
  if (!registros) {
    return NextResponse.json({ error: `Formato inválido: se esperan hasta ${MAX_REGISTROS} registros.` }, { status: 400, headers: SIN_CACHE });
  }

  const resultados = await procesarRegistros(supabase, registros);
  if (resultados.some((r) => r.estado === "ok")) revalidatePath("/", "layout");

  return NextResponse.json({ resultados }, { headers: SIN_CACHE });
}

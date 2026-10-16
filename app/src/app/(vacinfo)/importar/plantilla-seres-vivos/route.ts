import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generarPlantillaSeresVivos, NOMBRE_ARCHIVO_PLANTILLA } from "@/lib/importador/seres-vivos-plantilla";

const TIPO = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Descarga la plantilla en blanco de la planilla de implementación de seres vivos. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Tu sesión se cerró. Vuelve a entrar." }, { status: 401, headers: { "Cache-Control": "no-store" } });

  const libro = await generarPlantillaSeresVivos();
  return new NextResponse(new Uint8Array(libro), {
    headers: {
      "Content-Type": TIPO,
      "Content-Disposition": `attachment; filename="${NOMBRE_ARCHIVO_PLANTILLA}"`,
      "Content-Length": String(libro.byteLength),
      "Cache-Control": "private, max-age=3600",
    },
  });
}

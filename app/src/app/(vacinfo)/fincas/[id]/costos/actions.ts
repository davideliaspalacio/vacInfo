"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Json } from "@/lib/database.types";
import { MENSAJE_SOLO_LECTURA, soloLectura } from "@/lib/permisos";
import { obtenerSesion, ROLES_GESTORES } from "@/lib/sesion";
import type { ParametrosCostos } from "@/lib/finanzas";
import type { EstadoFormulario } from "@/components/fincas/campo";
import { mensajeErrorBD } from "@/components/fincas/validacion";

const valor = z.coerce.number({ error: "Número inválido" }).finite("Número inválido").min(0, "No puede ser negativo");

const esquemaParametros = z.object({
  precio_litro: valor,
  valorizacion_mensual_por_animal: valor,
  animales: z.object({
    vacas_produccion: valor,
    vacas_horras: valor,
    novillas: valor,
    terneronas: valor,
    terneras: valor,
    toros: valor,
    caballos: valor,
    perros: valor,
    otros: valor,
  }),
  litros_dia: z.object({ venta: valor, terneras: valor, consumo_humano: valor }),
  costos: z.array(
    z.object({
      categoria: z.string().trim().min(1, "Categoría sin nombre"),
      items: z.array(
        z.object({
          nombre: z.string().trim().min(1, "Hay un ítem de costo sin nombre"),
          mes: valor,
          caja: z.boolean().optional(),
        }),
      ),
    }),
  ),
}) satisfies z.ZodType<ParametrosCostos>;

export async function guardarCostos(fincaId: string, periodo: string, _: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const { supabase, rol, user } = await obtenerSesion();
  if (soloLectura(rol)) return { mensaje: MENSAJE_SOLO_LECTURA };
  if (!ROLES_GESTORES.includes(rol)) return { mensaje: "Solo propietarios y administradores pueden cambiar los parámetros de costos." };
  if (!/^\d{4}-\d{2}-01$/.test(periodo)) return { mensaje: "Periodo inválido." };

  let crudo: unknown;
  try {
    crudo = JSON.parse(String(formData.get("datos") ?? ""));
  } catch {
    return { mensaje: "No se pudieron leer los parámetros." };
  }

  const resultado = esquemaParametros.safeParse(crudo);
  if (!resultado.success) return { mensaje: resultado.error.issues[0]?.message ?? "Revisa los valores." };

  const datos: ParametrosCostos = {
    ...resultado.data,
    costos: resultado.data.costos.map((c) => ({
      categoria: c.categoria,
      items: c.items.map(({ nombre, mes, caja }) => (caja === false ? { nombre, mes, caja } : { nombre, mes })),
    })),
  };

  const { error } = await supabase.from("parametros_costos").upsert(
    {
      finca_id: fincaId,
      periodo,
      datos: datos as unknown as Json,
      registrado_por: user.id,
      registrado_en: new Date().toISOString(),
    },
    { onConflict: "finca_id,periodo" },
  );
  if (error) return { mensaje: mensajeErrorBD(error) };

  revalidatePath(`/fincas/${fincaId}/costos`);
  revalidatePath("/informes", "layout");
  redirect(`/fincas/${fincaId}/costos?periodo=${periodo}&guardado=1`);
}

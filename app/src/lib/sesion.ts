import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export { ETIQUETA_ROL, ROLES_CAMPO, ROLES_GESTORES, type Rol } from "@/components/equipo/roles";
import type { Rol } from "@/components/equipo/roles";

/** Sesión del usuario con su organización y fincas. Sin sesión → /login; sin empresa → /registro/empresa. */
export const obtenerSesion = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: perfil }, { data: membresia }, { data: fincas }] = await Promise.all([
    supabase.from("perfiles").select("nombre_completo").eq("id", user.id).single(),
    supabase
      .from("miembros")
      .select("rol, organizacion_id, fincas, organizaciones(nombre, plan, prueba_hasta)")
      .eq("usuario_id", user.id)
      .limit(1)
      .maybeSingle(),
    supabase.from("fincas").select("id, nombre, municipio, departamento, area_cuadras, precio_litro").order("nombre"),
  ]);

  if (!membresia) redirect("/registro/empresa");

  return {
    supabase,
    user,
    nombre: perfil?.nombre_completo || user.email || "",
    rol: membresia.rol as Rol,
    organizacionId: membresia.organizacion_id,
    organizacion: membresia.organizaciones?.nombre ?? "",
    plan: membresia.organizaciones?.plan ?? "prueba",
    /** 'YYYY-MM-DD' o null */
    pruebaHasta: membresia.organizaciones?.prueba_hasta ?? null,
    /** null = acceso a todas las fincas de la organización */
    fincasPermitidas: membresia.fincas,
    fincas: fincas ?? [],
  };
});

export type Sesion = Awaited<ReturnType<typeof obtenerSesion>>;

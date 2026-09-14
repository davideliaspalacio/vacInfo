// Abre sesión contra el Supabase LOCAL con las cuentas demo de la semilla y devuelve las cookies
// que usa la app (@supabase/ssr). Solo para pruebas locales.
import { createServerClient } from "@supabase/ssr";

const URL = "http://127.0.0.1:55321";
const LLAVE = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const CLAVE_DEMO = "vacinfo123"; // contraseña de las cuentas demo definidas en supabase/seed_datos.sql

export async function cookiesDe(email) {
  const jarra = new Map();
  const supabase = createServerClient(URL, LLAVE, {
    cookies: {
      getAll: () => [...jarra].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => cookies.forEach((c) => (c.value ? jarra.set(c.name, c.value) : jarra.delete(c.name))),
    },
  });
  const { error } = await supabase.auth.signInWithPassword({ email, password: CLAVE_DEMO });
  if (error) throw new Error(`No se pudo abrir sesión para ${email}: ${error.message}`);
  return [...jarra].map(([name, value]) => ({ name, value }));
}

import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ETIQUETA_ROL, type Rol } from "@/components/equipo/roles";
import { MarcoPublico } from "@/components/registro/marco";
import { MensajeError } from "@/components/fincas/campo";
import { BotonUnirme, FormularioUnirse } from "@/components/registro/unirse";
import { rutaInicio, usuarioDeCorreo } from "@/components/registro/cuentas";
import { salirParaUnirme } from "./actions";

export const metadata: Metadata = { title: "Unirme a un equipo" };

function FormularioCodigo({ codigo = "" }: { codigo?: string }) {
  return (
    <form action="/unirse" className="mt-5 space-y-3">
      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-bosque">Código de invitación</span>
        <input
          name="codigo"
          defaultValue={codigo}
          required
          maxLength={12}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="ABC123"
          className="campo-control text-center font-mono text-3xl font-bold uppercase tracking-[0.3em]"
        />
      </label>
      <button className="boton-accion w-full rounded-xl bg-bosque px-5 py-3 font-bold text-leche">Buscar invitación</button>
    </form>
  );
}

const PASOS = ["Escribe el código que te dio el administrador", "Crea tu usuario y un PIN, sin correo", "Registra desde el celular con VacDaTa"];

export default async function UnirsePage({ searchParams }: PageProps<"/unirse">) {
  const { codigo: crudo } = await searchParams;
  const codigo = (typeof crudo === "string" ? crudo : "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);

  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    consulta,
  ] = await Promise.all([supabase.auth.getUser(), codigo ? supabase.rpc("ver_invitacion", { p_codigo: codigo }) : null]);
  const invitacion = consulta?.data?.[0] ?? null;

  const { data: membresia } = user
    ? await supabase.from("miembros").select("rol, organizaciones(nombre)").eq("usuario_id", user.id).limit(1).maybeSingle()
    : { data: null };

  let contenido: React.ReactNode;
  if (!codigo) {
    contenido = (
      <>
        <h2 className="font-display text-2xl font-bold text-bosque">Tengo un código</h2>
        <p className="mt-1 text-sm text-tinta-suave">Son 6 letras y números. También puedes escanear el QR que te muestren.</p>
        <FormularioCodigo />
      </>
    );
  } else if (!invitacion || !invitacion.valida) {
    contenido = (
      <>
        <h2 className="font-display text-2xl font-bold text-bosque">Revisa el código</h2>
        <div className="mt-4">
          <MensajeError>
            {invitacion
              ? "Este código ya venció o se usó el máximo de veces. Pide uno nuevo al administrador de la finca."
              : `No encontramos el código ${codigo}. Revisa que esté bien escrito.`}
          </MensajeError>
        </div>
        <FormularioCodigo codigo={codigo} />
      </>
    );
  } else {
    const rol = invitacion.rol as Rol;
    const nombreSesion = user ? String(user.user_metadata?.nombre_completo || usuarioDeCorreo(user.email) || user.email) : "";

    contenido = (
      <>
        <div className="rounded-2xl border border-[#cadba8] bg-lima-suave p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-pasto-oscuro">Invitación {codigo}</p>
          <p className="font-display mt-1 text-xl font-bold leading-snug text-bosque">
            Te invitan a {invitacion.organizacion}
            {invitacion.finca ? ` · ${invitacion.finca}` : ""} como {ETIQUETA_ROL[rol].toLowerCase()}
          </p>
        </div>

        {user && membresia ? (
          <div className="mt-5 space-y-4">
            <p className="text-tinta-suave">
              Ingresaste como <strong className="text-bosque">{nombreSesion}</strong>, que ya pertenece a{" "}
              <strong className="text-bosque">{membresia.organizaciones?.nombre}</strong> como {ETIQUETA_ROL[membresia.rol as Rol].toLowerCase()}. Cada
              cuenta pertenece a una sola empresa: para usar este código, cierra sesión y crea una cuenta nueva.
            </p>
            <div className="flex flex-wrap gap-3">
              <form action={salirParaUnirme.bind(null, codigo)}>
                <button className="boton-accion rounded-xl bg-bosque px-5 py-3 font-bold text-leche">Cerrar sesión y crear cuenta</button>
              </form>
              <Link href={rutaInicio(membresia.rol)} className="rounded-xl border border-tinta/15 px-5 py-3 font-bold text-bosque">
                Ir a mi inicio
              </Link>
            </div>
          </div>
        ) : user ? (
          <>
            <p className="mt-5 text-tinta-suave">
              Ingresaste como <strong className="text-bosque">{nombreSesion}</strong>.
            </p>
            <BotonUnirme codigo={codigo} />
          </>
        ) : (
          <>
            <h2 className="font-display mt-6 text-2xl font-bold text-bosque">Crea tu cuenta</h2>
            <FormularioUnirse codigo={codigo} />
            <p className="mt-6 border-t border-tinta/10 pt-4 text-sm text-tinta-suave">
              ¿Ya tienes cuenta?{" "}
              <Link href={`/login?siguiente=${encodeURIComponent(`/unirse?codigo=${codigo}`)}`} className="font-bold text-bosque underline">
                Ingresa y únete
              </Link>
            </p>
          </>
        )}
      </>
    );
  }

  return (
    <MarcoPublico
      eyebrow="Invitación al equipo"
      titulo="Únete a tu equipo"
      descripcion="Con el código de tu finca creas tu cuenta en un minuto. No necesitas correo."
      lateral={
        <ol className="space-y-3">
          {PASOS.map((paso, i) => (
            <li key={paso} className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-lima font-bold text-bosque">{i + 1}</span>
              <span className="text-leche/90">{paso}</span>
            </li>
          ))}
        </ol>
      }
    >
      {contenido}
    </MarcoPublico>
  );
}

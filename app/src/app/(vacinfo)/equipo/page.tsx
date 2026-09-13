import type { Metadata } from "next";
import { obtenerSesion, ROLES_GESTORES, type Rol } from "@/lib/sesion";
import { Encabezado, Tarjeta, TituloTarjeta } from "@/components/ui";
import { CajaPlan } from "@/components/equipo/plan";
import { TablaMiembros, type MiembroEquipo } from "@/components/equipo/miembros";
import { FormularioInvitacion, ListaInvitaciones, type InvitacionLista } from "@/components/equipo/invitaciones";
import { datosCodigo, estadoInvitacion, origenActual, textoVence } from "@/components/equipo/enlace";
import { usuarioDeCorreo } from "@/components/registro/cuentas";

export const metadata: Metadata = { title: "Equipo" };

const ORDEN_ROL: Record<Rol, number> = { propietario: 0, administrador: 1, mayordomo: 2, veterinario: 3, consultor: 4, trabajador: 5 };

export default async function EquipoPage() {
  const sesion = await obtenerSesion();
  const { supabase, organizacionId } = sesion;
  const esGestor = ROLES_GESTORES.includes(sesion.rol);

  const [{ data: filas }, consultaInvitaciones] = await Promise.all([
    supabase.from("miembros").select("usuario_id, rol, fincas").eq("organizacion_id", organizacionId).order("creado_en"),
    esGestor
      ? supabase
          .from("invitaciones")
          .select("id, codigo, rol, finca_id, usos, usos_max, expira_en")
          .eq("organizacion_id", organizacionId)
          .eq("activa", true)
          .order("creado_en", { ascending: false })
          .limit(50)
      : null,
  ]);

  const ids = (filas ?? []).map((f) => f.usuario_id);
  const { data: perfiles } = ids.length ? await supabase.from("perfiles").select("id, nombre_completo").in("id", ids) : { data: [] };
  const nombrePorId = new Map((perfiles ?? []).map((p) => [p.id, p.nombre_completo]));

  const miembros: MiembroEquipo[] = (filas ?? [])
    .map((f) => {
      const esYo = f.usuario_id === sesion.user.id;
      return {
        usuarioId: f.usuario_id,
        nombre: nombrePorId.get(f.usuario_id) || (esYo ? sesion.nombre : "Sin nombre"),
        usuario: esYo ? usuarioDeCorreo(sesion.user.email) : null,
        rol: f.rol as Rol,
        fincas: f.fincas,
      };
    })
    .sort((a, b) => ORDEN_ROL[a.rol] - ORDEN_ROL[b.rol] || a.nombre.localeCompare(b.nombre, "es"));

  const fincas = sesion.fincas.map((f) => ({ id: f.id, nombre: f.nombre }));
  const nombreFinca = new Map(fincas.map((f) => [f.id, f.nombre]));
  const origen = await origenActual();

  const invitaciones: InvitacionLista[] = await Promise.all(
    (consultaInvitaciones?.data ?? []).map(async (inv) => {
      const estado = estadoInvitacion(inv);
      const { enlace, svg } = await datosCodigo(inv.codigo, origen);
      return {
        id: inv.id,
        codigo: inv.codigo,
        rol: inv.rol as Rol,
        finca: inv.finca_id ? (nombreFinca.get(inv.finca_id) ?? "Finca") : "Todas las fincas",
        usos: inv.usos,
        usosMax: inv.usos_max,
        vence: textoVence(inv.expira_en),
        estado,
        enlace,
        svg: estado === "vigente" ? svg : null,
      };
    }),
  );

  return (
    <div className="space-y-8">
      <Encabezado
        eyebrow={sesion.organizacion}
        titulo="Equipo"
        descripcion={
          esGestor
            ? "Invita a mayordomos y trabajadores con un código, define su rol y a qué fincas tienen acceso."
            : "Las personas que trabajan en tu empresa y su rol."
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Tarjeta>
          <TituloTarjeta detalle={`${miembros.length} ${miembros.length === 1 ? "persona" : "personas"}`}>Miembros</TituloTarjeta>
          <TablaMiembros miembros={miembros} fincas={fincas} yo={sesion.user.id} rolActor={sesion.rol} puedeGestionar={esGestor} />
        </Tarjeta>
        <Tarjeta className="self-start">
          <CajaPlan plan={sesion.plan} pruebaHasta={sesion.pruebaHasta} />
        </Tarjeta>
      </div>

      {esGestor && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Tarjeta>
            <TituloTarjeta>Invitar con código</TituloTarjeta>
            <p className="mb-4 text-sm text-tinta-suave">
              Quien reciba el código entra a <strong>/unirse</strong> y crea su cuenta con usuario y PIN, sin necesidad de correo.
            </p>
            <FormularioInvitacion fincas={fincas} />
          </Tarjeta>
          <Tarjeta>
            <TituloTarjeta detalle={invitaciones.length ? `${invitaciones.length} activas` : undefined}>Invitaciones activas</TituloTarjeta>
            <ListaInvitaciones invitaciones={invitaciones} />
          </Tarjeta>
        </div>
      )}
    </div>
  );
}

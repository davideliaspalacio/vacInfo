import clsx from "clsx";
import { AlertTriangle, BellRing, CheckCheck, MessageSquareText } from "lucide-react";
import { obtenerSesion, ETIQUETA_ROL, ROLES_GESTORES, type Rol } from "@/lib/sesion";
import { corteDeFinca } from "@/lib/datos";
import { fecha } from "@/lib/formato";
import { Encabezado, Etiqueta, Tarjeta, TituloTarjeta, Vacio } from "@/components/ui";
import { cambiarEstadoComentario, marcarMensajeLeido } from "./actions";
import { FormularioMensaje } from "./formulario-mensaje";

export const metadata = { title: "Mensajes" };

const URGENCIAS = [
  { id: "alta", titulo: "Urgente", tono: "rojo", clase: "border-alerta/25 bg-[#fbe9e5]" },
  { id: "media", titulo: "Esta semana", tono: "amarillo", clase: "border-dorado/50 bg-[#fdf4dc]" },
  { id: "baja", titulo: "Para tener en cuenta", tono: "gris", clase: "border-[#cadba8] bg-lima-suave" },
] as const;

const TONO_URGENCIA = { alta: "rojo", media: "amarillo", baja: "verde" } as const;
const TONO_ESTADO = { nuevo: "azul", leido: "gris", resuelto: "verde" } as const;
const ETIQUETA_ESTADO = { nuevo: "Nuevo", leido: "Leído", resuelto: "Resuelto" } as const;

const fechaHora = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" });

export default async function MensajesPage() {
  const { supabase, user, rol, organizacionId, fincas } = await obtenerSesion();
  const esGestor = ROLES_GESTORES.includes(rol);

  const [alertasPorFinca, { data: comentarios }, { data: mensajes }, { data: miembros }] = await Promise.all([
    Promise.all(
      fincas.map(async (f) => {
        const corte = await corteDeFinca(supabase, f.id);
        const { data } = await supabase.rpc("alertas_finca", { p_finca: f.id, p_corte: corte });
        return (data ?? []).map((a) => ({ ...a, finca: f.nombre, corte }));
      }),
    ),
    supabase
      .from("comentarios")
      .select("id, mensaje, urgencia, estado, registrado_por, registrado_en, fincas(nombre)")
      .eq("organizacion_id", organizacionId)
      .order("registrado_en", { ascending: false })
      .limit(50),
    supabase
      .from("mensajes")
      .select("id, texto, remitente_id, destinatario_id, leido, creado_en")
      .eq("organizacion_id", organizacionId)
      .order("creado_en", { ascending: false })
      .limit(50),
    supabase.from("miembros").select("usuario_id, rol").eq("organizacion_id", organizacionId),
  ]);

  const ids = (miembros ?? []).map((m) => m.usuario_id);
  const { data: perfiles } = ids.length ? await supabase.from("perfiles").select("id, nombre_completo").in("id", ids) : { data: [] };
  const nombres = new Map((perfiles ?? []).map((p) => [p.id, p.nombre_completo]));
  const nombre = (id: string | null) => (id ? (nombres.get(id) || "Usuario") : "—");

  const alertas = alertasPorFinca.flat();
  const opciones = (miembros ?? [])
    .filter((m) => m.usuario_id !== user.id)
    .map((m) => ({ id: m.usuario_id, nombre: nombre(m.usuario_id), rol: ETIQUETA_ROL[m.rol as Rol] }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  const pendientes = (comentarios ?? []).filter((c) => c.estado === "nuevo").length;

  return (
    <div className="space-y-7">
      <Encabezado
        eyebrow="Mensajes y notificaciones"
        titulo="Mensajes"
        descripcion="Alertas automáticas de todas las fincas, comentarios que llegan desde VacDaTa y mensajes para el equipo."
      />

      <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <Tarjeta className="h-fit">
          <TituloTarjeta detalle={`${alertas.length} activas`}>
            <span className="inline-flex items-center gap-2">
              <BellRing className="h-5 w-5" aria-hidden /> Notificaciones
            </span>
          </TituloTarjeta>
          {alertas.length === 0 ? (
            <Vacio>No hay alertas pendientes en ninguna finca.</Vacio>
          ) : (
            <div className="space-y-5">
              {URGENCIAS.map((u) => {
                const grupo = alertas.filter((a) => a.prioridad === u.id);
                if (grupo.length === 0) return null;
                return (
                  <section key={u.id}>
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-tinta-suave">
                      {u.id === "alta" && <AlertTriangle className="h-4 w-4 text-alerta" aria-hidden />}
                      {u.titulo} <Etiqueta tono={u.tono}>{grupo.length}</Etiqueta>
                    </h3>
                    <ul className="space-y-2">
                      {grupo.map((a, i) => (
                        <li key={`${a.tipo}-${a.animal_id}-${i}`} className={clsx("rounded-2xl border p-3", u.clase)}>
                          <div className="flex items-start justify-between gap-3">
                            <strong className="text-bosque">
                              {a.chapeta ? `${a.chapeta} · ` : ""}
                              {a.nombre}
                            </strong>
                            <span className="shrink-0 text-xs font-bold text-tinta-suave">{fecha(a.fecha)}</span>
                          </div>
                          <p className="text-sm">{a.detalle}</p>
                          <p className="mt-1 text-xs text-tinta-suave">{a.finca}</p>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
              <p className="text-xs text-tinta-suave">
                Calculadas al corte de cada finca: {[...new Map(alertas.map((a) => [a.finca, a.corte])).entries()].map(([f, c]) => `${f} ${fecha(c)}`).join(" · ")}
              </p>
            </div>
          )}
        </Tarjeta>

        <div className="space-y-5">
          <Tarjeta>
            <TituloTarjeta detalle={pendientes ? `${pendientes} sin leer` : undefined}>
              <span className="inline-flex items-center gap-2">
                <MessageSquareText className="h-5 w-5" aria-hidden /> Comentarios del equipo
              </span>
            </TituloTarjeta>
            {(comentarios ?? []).length === 0 ? (
              <Vacio>Nadie ha enviado comentarios desde VacDaTa.</Vacio>
            ) : (
              <ul className="divide-y divide-[#d6ddcf]">
                {(comentarios ?? []).map((c) => (
                  <li key={c.id} className={clsx("py-3", c.estado === "resuelto" && "opacity-70")}>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <strong className="text-bosque">{nombre(c.registrado_por)}</strong>
                      {c.fincas?.nombre && <span className="text-tinta-suave">· {c.fincas.nombre}</span>}
                      <Etiqueta tono={TONO_URGENCIA[c.urgencia]}>Urgencia {c.urgencia}</Etiqueta>
                      <Etiqueta tono={TONO_ESTADO[c.estado]}>{ETIQUETA_ESTADO[c.estado]}</Etiqueta>
                      <span className="ml-auto text-xs text-tinta-suave">{fechaHora.format(new Date(c.registrado_en))}</span>
                    </div>
                    <p className="mt-1">{c.mensaje}</p>
                    {esGestor && c.estado !== "resuelto" && (
                      <div className="mt-2 flex gap-2 print:hidden">
                        {c.estado === "nuevo" && (
                          <form action={cambiarEstadoComentario}>
                            <input type="hidden" name="id" value={c.id} />
                            <input type="hidden" name="estado" value="leido" />
                            <button className="rounded-lg border border-tinta/15 px-3 py-1 text-xs font-bold text-tinta-suave hover:bg-black/5">
                              Marcar leído
                            </button>
                          </form>
                        )}
                        <form action={cambiarEstadoComentario}>
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="estado" value="resuelto" />
                          <button className="inline-flex items-center gap-1 rounded-lg bg-lima px-3 py-1 text-xs font-bold text-bosque">
                            <CheckCheck className="h-3.5 w-3.5" aria-hidden /> Resuelto
                          </button>
                        </form>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>

          <Tarjeta>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-xl font-bold text-bosque">Mensajes</h2>
            </div>
            {(mensajes ?? []).length === 0 ? (
              <Vacio>Todavía no hay mensajes.</Vacio>
            ) : (
              <ul className="divide-y divide-[#d6ddcf]">
                {(mensajes ?? []).map((m) => {
                  const paraMi = m.destinatario_id === user.id;
                  const mio = m.remitente_id === user.id;
                  return (
                    <li key={m.id} className="py-3">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <strong className="text-bosque">{mio ? "Tú" : nombre(m.remitente_id)}</strong>
                        <span className="text-tinta-suave">
                          → {m.destinatario_id == null ? "Todos los trabajadores" : paraMi ? "ti" : nombre(m.destinatario_id)}
                        </span>
                        {paraMi && !m.leido && <Etiqueta tono="azul">Nuevo</Etiqueta>}
                        <span className="ml-auto text-xs text-tinta-suave">{fechaHora.format(new Date(m.creado_en))}</span>
                      </div>
                      <p className="mt-1">{m.texto}</p>
                      {paraMi && !m.leido && (
                        <form action={marcarMensajeLeido} className="mt-2 print:hidden">
                          <input type="hidden" name="id" value={m.id} />
                          <button className="rounded-lg border border-tinta/15 px-3 py-1 text-xs font-bold text-tinta-suave hover:bg-black/5">
                            Marcar leído
                          </button>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="mt-5">
              <FormularioMensaje miembros={opciones} />
            </div>
          </Tarjeta>
        </div>
      </div>
    </div>
  );
}

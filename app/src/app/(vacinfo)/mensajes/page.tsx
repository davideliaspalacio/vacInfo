import clsx from "clsx";
import { BellRing, CheckCheck, MessageSquareText } from "lucide-react";
import { obtenerSesion, ETIQUETA_ROL, ROLES_GESTORES, type Rol } from "@/lib/sesion";
import { corteDeFinca } from "@/lib/datos";
import { MENSAJE_SOLO_LECTURA, soloLectura } from "@/lib/permisos";
import { fecha } from "@/lib/formato";
import { consultarPagina, leerPagina } from "@/lib/paginacion";
import { Encabezado, Etiqueta, Tarjeta, TituloTarjeta, Vacio } from "@/components/ui";
import { Paginacion } from "@/components/paginacion";
import { cambiarEstadoComentario, marcarMensajeLeido } from "./actions";
import { FormularioMensaje } from "./formulario-mensaje";
import { Notificaciones } from "./notificaciones";
import { conClave, descartesVigentes, separarAlertas } from "./alertas";

export const metadata = { title: "Mensajes" };

const POR_PAGINA = 20;

const TONO_URGENCIA = { alta: "rojo", media: "amarillo", baja: "verde" } as const;
const TONO_ESTADO = { nuevo: "azul", leido: "gris", resuelto: "verde" } as const;
const ETIQUETA_ESTADO = { nuevo: "Nuevo", leido: "Leído", resuelto: "Resuelto" } as const;

const fechaHora = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" });

export default async function MensajesPage({ searchParams }: PageProps<"/mensajes">) {
  const sp = await searchParams;
  const { supabase, user, rol, organizacionId, fincas } = await obtenerSesion();
  const esGestor = ROLES_GESTORES.includes(rol);

  const verDescartadas = sp.descartadas === "1";

  const [alertasPorFinca, descartes, comentarios, mensajes, { data: miembros }, { count: pendientes }] = await Promise.all([
    Promise.all(
      fincas.map(async (f) => {
        const corte = await corteDeFinca(supabase, f.id);
        const { data } = await supabase.rpc("alertas_finca", { p_finca: f.id, p_corte: corte });
        return conClave(data, f, corte);
      }),
    ),
    descartesVigentes(
      supabase,
      fincas.map((f) => f.id),
    ),
    consultarPagina(
      (desde, hasta) =>
        supabase
          .from("comentarios")
          .select("id, mensaje, urgencia, estado, registrado_por, registrado_en, fincas(nombre)", { count: "exact" })
          .eq("organizacion_id", organizacionId)
          .order("registrado_en", { ascending: false })
          .order("id")
          .range(desde, hasta),
      leerPagina(sp, { param: "pcom", tamano: POR_PAGINA }),
    ),
    consultarPagina(
      (desde, hasta) =>
        supabase
          .from("mensajes")
          .select("id, texto, remitente_id, destinatario_id, leido, creado_en", { count: "exact" })
          .eq("organizacion_id", organizacionId)
          .order("creado_en", { ascending: false })
          .order("id")
          .range(desde, hasta),
      leerPagina(sp, { param: "pmen", tamano: POR_PAGINA }),
    ),
    supabase.from("miembros").select("usuario_id, rol").eq("organizacion_id", organizacionId),
    supabase.from("comentarios").select("id", { count: "exact", head: true }).eq("organizacion_id", organizacionId).eq("estado", "nuevo"),
  ]);

  const ids = (miembros ?? []).map((m) => m.usuario_id);
  const { data: perfiles } = ids.length ? await supabase.from("perfiles").select("id, nombre_completo").in("id", ids) : { data: [] };
  const nombres = new Map((perfiles ?? []).map((p) => [p.id, p.nombre_completo]));
  const nombre = (id: string | null) => (id ? (nombres.get(id) || "Usuario") : "—");

  const alertas = alertasPorFinca.flat();
  const { visibles, descartadas } = separarAlertas(alertas, descartes);
  const opciones = (miembros ?? [])
    .filter((m) => m.usuario_id !== user.id)
    .map((m) => ({ id: m.usuario_id, nombre: nombre(m.usuario_id), rol: ETIQUETA_ROL[m.rol as Rol] }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  return (
    <div className="space-y-7">
      <Encabezado
        eyebrow="Mensajes y notificaciones"
        titulo="Mensajes"
        descripcion="Alertas automáticas de todas las fincas, comentarios que llegan desde VacDaTa y mensajes para el equipo."
      />

      <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <Tarjeta id="notificaciones" className="h-fit scroll-mt-6">
          <TituloTarjeta detalle={`${visibles.length} activas${descartadas.length ? ` · ${descartadas.length} descartadas` : ""}`}>
            <span className="inline-flex items-center gap-2">
              <BellRing className="h-5 w-5" aria-hidden /> Notificaciones
            </span>
          </TituloTarjeta>
          <Notificaciones
            // Remonta al cambiar la lista del servidor para limpiar lo ocultado de forma optimista.
            key={`${visibles.length}-${descartadas.length}`}
            visibles={visibles}
            descartadas={descartadas}
            verDescartadas={verDescartadas}
          />
          {alertas.length > 0 && (
            <p className="mt-4 text-xs text-tinta-suave">
              Calculadas al corte de cada finca: {[...new Map(alertas.map((a) => [a.finca, a.corte])).entries()].map(([f, c]) => `${f} ${fecha(c)}`).join(" · ")}.
              Descartar solo las oculta para ti; las que cambian a diario (mora de preñez, insumos, novillas listas) vuelven en 7 días si siguen pendientes.
            </p>
          )}
        </Tarjeta>

        <div className="space-y-5">
          <Tarjeta id="comentarios" className="scroll-mt-6">
            <TituloTarjeta detalle={pendientes ? `${pendientes} sin leer` : undefined}>
              <span className="inline-flex items-center gap-2">
                <MessageSquareText className="h-5 w-5" aria-hidden /> Comentarios del equipo
              </span>
            </TituloTarjeta>
            {comentarios.filas.length === 0 ? (
              <Vacio>Nadie ha enviado comentarios desde VacDaTa.</Vacio>
            ) : (
              <ul className="divide-y divide-[#d6ddcf]">
                {comentarios.filas.map((c) => (
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
            <Paginacion
              ruta="/mensajes"
              searchParams={sp}
              param="pcom"
              pagina={comentarios.pagina.pagina}
              tamano={comentarios.pagina.tamano}
              total={comentarios.total}
              unidad="comentarios"
              etiqueta="Páginas de comentarios"
              ancla="comentarios"
            />
          </Tarjeta>

          <Tarjeta id="mensajes-equipo" className="scroll-mt-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-xl font-bold text-bosque">Mensajes</h2>
            </div>
            {mensajes.filas.length === 0 ? (
              <Vacio>Todavía no hay mensajes.</Vacio>
            ) : (
              <ul className="divide-y divide-[#d6ddcf]">
                {mensajes.filas.map((m) => {
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
            <Paginacion
              ruta="/mensajes"
              searchParams={sp}
              param="pmen"
              pagina={mensajes.pagina.pagina}
              tamano={mensajes.pagina.tamano}
              total={mensajes.total}
              unidad="mensajes"
              etiqueta="Páginas de mensajes"
              ancla="mensajes-equipo"
            />
            <div className="mt-5">
              {soloLectura(rol) ? <p className="text-sm text-tinta-suave">{MENSAJE_SOLO_LECTURA}</p> : <FormularioMensaje miembros={opciones} />}
            </div>
          </Tarjeta>
        </div>
      </div>
    </div>
  );
}

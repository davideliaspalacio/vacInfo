import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRightLeft, CalendarDays, Lightbulb, LogOut, Settings2 } from "lucide-react";
import { puedeRegistrar } from "@/lib/permisos";
import { obtenerSesion, ROLES_GESTORES } from "@/lib/sesion";
import { corteDeFinca } from "@/lib/datos";
import { fecha, num } from "@/lib/formato";
import { consultarPagina, leerPagina } from "@/lib/paginacion";
import { BotonVolver, Encabezado, Etiqueta, Metrica, Tarjeta, TituloTarjeta, Vacio } from "@/components/ui";
import { Paginacion } from "@/components/paginacion";
import { guardarReglasFinca } from "@/app/(vacinfo)/fincas/actions";
import { ESTADOS_POTRERO, gruposDeFinca, nombrePotrero } from "@/components/potreros/rotacion";
import { APLICACIONES, TarjetaPotrero } from "@/components/potreros/tarjeta-potrero";
import {
  FormularioCrearPotreros,
  FormularioDescanso,
  FormularioMoverGrupo,
  FormularioPotrero,
  FormularioSacarGrupo,
} from "@/components/potreros/formularios-potreros";
import { crearPotreros, guardarPotrero, moverGrupo, sacarGrupo } from "./actions";

export const metadata = { title: "Potreros" };

const ROTACIONES_POR_PAGINA = 40;

export default async function PotrerosFinca({ params, searchParams }: PageProps<"/fincas/[id]/potreros">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const pedido = typeof sp.corte === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.corte) ? sp.corte : null;

  const { supabase, rol } = await obtenerSesion();
  const gestor = ROLES_GESTORES.includes(rol);

  const { data: finca } = await supabase.from("fincas").select("id, nombre, dias_descanso_objetivo").eq("id", id).maybeSingle();
  if (!finca) notFound();

  const corte = await corteDeFinca(supabase, id, pedido);
  const [{ data: estados }, rotaciones, { data: aplicaciones }, grupos] = await Promise.all([
    supabase.rpc("estado_potreros", { p_finca: id, p_corte: corte }),
    consultarPagina(
      (desde, hasta) =>
        supabase
          .from("rotaciones_potrero")
          .select("id, grupo, animales, fecha_entrada, fecha_salida, observaciones, potreros(numero, nombre)", { count: "exact" })
          .eq("finca_id", id)
          .lte("fecha_entrada", corte)
          .order("fecha_entrada", { ascending: false })
          .order("registrado_en", { ascending: false })
          .order("id")
          .range(desde, hasta),
      leerPagina(sp, { param: "prot", tamano: ROTACIONES_POR_PAGINA }),
    ),
    supabase
      .from("aplicaciones_campo")
      .select("id, fecha, tipo, producto, potreros, potrero_ids, dias_retiro_pastoreo")
      .eq("finca_id", id)
      .lte("fecha", corte)
      .order("fecha", { ascending: false })
      .limit(12),
    gruposDeFinca(supabase, id),
  ]);

  const potreros = estados ?? [];
  const objetivo = finca.dias_descanso_objetivo;
  const porId = new Map(potreros.map((p) => [p.potrero_id, p]));
  const cuenta = (e: string) => potreros.filter((p) => p.estado === e).length;
  const sugeridos = potreros.filter((p) => p.estado === "listo").sort((a, b) => (b.dias_descanso ?? 0) - (a.dias_descanso ?? 0));
  const ocupados = potreros.filter((p) => p.ocupado);
  const gruposActivos = [...new Map(ocupados.map((p) => [p.grupo, { grupo: p.grupo, potrero: nombrePotrero(p) }])).values()];

  return (
    <div className="space-y-8">
      <BotonVolver href={`/fincas/${id}`}>{finca.nombre}</BotonVolver>

      <Encabezado
        eyebrow={`Rotación de potreros · ${finca.nombre}`}
        titulo="Potreros"
        descripcion={`Ocupación, descanso (objetivo ${objetivo} días) y bloqueos por días de retiro después de fumigar o abonar.`}
      />

      <Tarjeta>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <p className="text-sm text-tinta-suave">
            Datos al <strong className="text-bosque">{fecha(corte, true)}</strong> · {potreros.length} potreros
          </p>
          <form className="flex items-center gap-2">
            <label htmlFor="corte" className="flex items-center gap-1 text-sm font-bold text-bosque">
              <CalendarDays className="h-4 w-4" aria-hidden />
              Fecha de corte
            </label>
            <input id="corte" type="date" name="corte" defaultValue={corte} className="campo-control w-auto py-2" />
            <button className="rounded-xl bg-bosque px-4 py-2 text-sm font-bold text-leche">Ver</button>
          </form>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Metrica valor={num(cuenta("ocupado"))} etiqueta="Ocupados" tono="crema" />
          <Metrica valor={num(cuenta("bloqueado"))} etiqueta="Bloqueados por retiro" tono={cuenta("bloqueado") ? "alerta" : "crema"} />
          <Metrica valor={num(cuenta("listo"))} etiqueta="Listos para pastorear" />
          <Metrica valor={num(cuenta("descansando"))} etiqueta="Descansando" tono="crema" />
          <Metrica valor={num(cuenta("sin_datos"))} etiqueta="Sin datos" tono="crema" />
        </div>
      </Tarjeta>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Tarjeta>
          <TituloTarjeta
            detalle={
              <span className="flex flex-wrap gap-1.5">
                {Object.entries(ESTADOS_POTRERO).map(([k, e]) => (
                  <Etiqueta key={k} tono={e.tono}>
                    {e.texto}
                  </Etiqueta>
                ))}
              </span>
            }
          >
            Mapa de potreros
          </TituloTarjeta>
          {potreros.length === 0 ? (
            <Vacio>{gestor ? "La finca no tiene potreros. Créalos en «Administrar potreros»." : "La finca no tiene potreros registrados."}</Vacio>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {potreros.map((p) => (
                <TarjetaPotrero key={p.potrero_id} p={p} objetivo={objetivo} />
              ))}
            </div>
          )}
        </Tarjeta>

        <div className="space-y-6">
          <Tarjeta className="border-2 border-pasto">
            <TituloTarjeta>
              <span className="inline-flex items-center gap-2">
                <Lightbulb className="h-5 w-5" aria-hidden />
                Siguiente potrero sugerido
              </span>
            </TituloTarjeta>
            {sugeridos.length === 0 ? (
              <p className="text-sm text-tinta-suave">Ningún potrero ha cumplido {objetivo} días de descanso sin bloqueo.</p>
            ) : (
              <ol className="space-y-2">
                {sugeridos.slice(0, 5).map((p, i) => (
                  <li key={p.potrero_id} className={i === 0 ? "rounded-2xl bg-lima px-4 py-3" : "rounded-2xl bg-lima-suave px-4 py-2"}>
                    <span className={i === 0 ? "font-display text-xl font-bold text-bosque" : "font-bold text-bosque"}>{nombrePotrero(p)}</span>
                    <span className="block text-sm text-tinta-suave">
                      {p.dias_descanso} días de descanso{p.area_cuadras != null && ` · ${num(p.area_cuadras)} cuadras`}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Tarjeta>

          <Tarjeta>
            <TituloTarjeta
              detalle={
                <Link href={`/fincas/${id}?tab=historial`} className="font-bold text-pasto-oscuro hover:underline">
                  Ver historial
                </Link>
              }
            >
              Aplicaciones recientes
            </TituloTarjeta>
            {!aplicaciones?.length ? (
              <p className="text-sm text-tinta-suave">Sin fumigaciones ni abonos registrados.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {aplicaciones.map((a) => {
                  const nums = (a.potrero_ids ?? []).map((pid) => porId.get(pid)?.numero).filter((n) => n != null);
                  const lugares = nums.length ? nums.join(", ") : a.potreros;
                  const hasta = a.dias_retiro_pastoreo ? a.fecha && new Date(Date.parse(`${a.fecha}T12:00:00`) + a.dias_retiro_pastoreo * 86400000).toISOString().slice(0, 10) : null;
                  return (
                    <li key={a.id} className="rounded-xl border border-black/5 bg-white/70 px-3 py-2">
                      <span className="font-bold text-bosque">
                        {fecha(a.fecha)} · {APLICACIONES[a.tipo] ?? a.tipo}
                      </span>{" "}
                      {a.producto}
                      <span className="block text-xs text-tinta-suave">
                        {lugares ? `Potreros ${lugares}` : "Sin potreros"}
                        {hasta && (
                          <span className={hasta > corte ? "font-bold text-alerta" : undefined}> · retiro hasta {fecha(hasta)}</span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Tarjeta>
        </div>
      </div>

      {puedeRegistrar(rol) && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Tarjeta>
            <TituloTarjeta>
              <span className="inline-flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5" aria-hidden />
                Mover grupo
              </span>
            </TituloTarjeta>
            <p className="mb-3 text-sm text-tinta-suave">Cierra la estadía actual del grupo y lo entra al potrero destino en la misma fecha.</p>
            {potreros.length ? (
              <FormularioMoverGrupo accion={moverGrupo.bind(null, id)} potreros={potreros} grupos={grupos} objetivo={objetivo} corte={corte} />
            ) : (
              <Vacio>Primero hay que crear los potreros.</Vacio>
            )}
          </Tarjeta>
          <Tarjeta>
            <TituloTarjeta>
              <span className="inline-flex items-center gap-2">
                <LogOut className="h-5 w-5" aria-hidden />
                Sacar grupo
              </span>
            </TituloTarjeta>
            <p className="mb-3 text-sm text-tinta-suave">Registra la salida sin entrar a otro potrero (establo, venta, otra finca).</p>
            <FormularioSacarGrupo accion={sacarGrupo.bind(null, id)} grupos={gruposActivos} corte={corte} />
          </Tarjeta>
        </div>
      )}

      <Tarjeta id="rotaciones" className="scroll-mt-6">
        <TituloTarjeta detalle={rotaciones.total ? `${num(rotaciones.total)} rotaciones` : undefined}>Historial de rotaciones</TituloTarjeta>
        {!rotaciones.filas.length ? (
          <Vacio>Sin rotaciones registradas.</Vacio>
        ) : (
          <div className="overflow-x-auto">
            <table className="matriz w-full border-collapse bg-white text-sm">
              <thead>
                <tr>
                  <th>Potrero</th>
                  <th>Grupo</th>
                  <th>Animales</th>
                  <th>Entrada</th>
                  <th>Salida</th>
                  <th>Días</th>
                  <th>Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {rotaciones.filas.map((r) => {
                  const hasta = r.fecha_salida && r.fecha_salida <= corte ? r.fecha_salida : corte;
                  const dias = Math.round((Date.parse(`${hasta}T12:00:00`) - Date.parse(`${r.fecha_entrada}T12:00:00`)) / 86400000);
                  const abierta = !r.fecha_salida || r.fecha_salida > corte;
                  return (
                    <tr key={r.id} className={abierta ? "bg-blue-50" : undefined}>
                      <td className="font-bold">{r.potreros ? nombrePotrero(r.potreros) : "—"}</td>
                      <td>{r.grupo}</td>
                      <td>{num(r.animales)}</td>
                      <td>{fecha(r.fecha_entrada)}</td>
                      <td>{abierta ? <Etiqueta tono="azul">En el potrero</Etiqueta> : fecha(r.fecha_salida)}</td>
                      <td>{dias}</td>
                      <td className="!whitespace-normal !text-left">{r.observaciones ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Paginacion
          ruta={`/fincas/${id}/potreros`}
          searchParams={sp}
          param="prot"
          pagina={rotaciones.pagina.pagina}
          tamano={rotaciones.pagina.tamano}
          total={rotaciones.total}
          unidad="rotaciones"
          etiqueta="Páginas del historial de rotaciones"
          ancla="rotaciones"
        />
      </Tarjeta>

      {gestor && (
        <Tarjeta>
          <details open={potreros.length === 0}>
            <summary className="flex cursor-pointer items-center gap-2 font-display text-xl font-bold text-bosque">
              <Settings2 className="h-5 w-5" aria-hidden />
              Administrar potreros
            </summary>
            <div className="mt-5 space-y-6">
              <div className="grid gap-6 md:grid-cols-3">
                <div>
                  <p className="mb-2 text-sm font-bold text-bosque">Descanso</p>
                  <FormularioDescanso accion={guardarReglasFinca.bind(null, id)} objetivo={objetivo} />
                </div>
                <div>
                  <p className="mb-2 text-sm font-bold text-bosque">Crear varios</p>
                  <FormularioCrearPotreros accion={crearPotreros.bind(null, id)} sugerido={Math.max(potreros.length, 10)} />
                </div>
                <div>
                  <p className="mb-2 text-sm font-bold text-bosque">Agregar uno</p>
                  <FormularioPotrero key={`nuevo-${potreros.length}`} accion={guardarPotrero.bind(null, id, null)} />
                </div>
              </div>
              {potreros.length > 0 && (
                <div className="grid gap-3 border-t border-black/10 pt-4 md:grid-cols-2">
                  {potreros.map((p) => (
                    <div key={p.potrero_id} className="rounded-2xl border border-black/5 bg-white/60 p-3">
                      <FormularioPotrero accion={guardarPotrero.bind(null, id, p.potrero_id)} potrero={p} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </details>
        </Tarjeta>
      )}
    </div>
  );
}

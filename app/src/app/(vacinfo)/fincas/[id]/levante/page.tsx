import Link from "next/link";
import { notFound } from "next/navigation";
import { LineChart, Scale, Settings2 } from "lucide-react";
import { puedeRegistrar } from "@/lib/permisos";
import { obtenerSesion, ROLES_GESTORES } from "@/lib/sesion";
import { corteDeFinca } from "@/lib/datos";
import { fecha, num } from "@/lib/formato";
import { consultarPagina, leerPagina, recortar } from "@/lib/paginacion";
import { atajosDias, completarRango, leerRangoPedido, textoRango } from "@/lib/rango";
import { BotonVolver, Encabezado, Etiqueta, Metrica, Tarjeta, TituloTarjeta, Vacio } from "@/components/ui";
import { Paginacion } from "@/components/paginacion";
import { RangoFechas } from "@/components/rango-fechas";
import { guardarReglasFinca } from "@/app/(vacinfo)/fincas/actions";
import { ESTADOS_LEVANTE, tonoGanancia, type EstadoLevante } from "@/components/levante/etiquetas";
import { FormularioDestete, FormularioPesaje, FormularioReglasLevante } from "@/components/levante/formularios-levante";
import { SeccionCrecimiento } from "@/components/levante/seccion-crecimiento";
import { registrarDestete, registrarPesaje } from "./actions";

export const metadata = { title: "Levante" };

const POR_GRUPO = 50;
const PESAJES_POR_PAGINA = 20;
const DESTETES_POR_PAGINA = 20;
const DESC = { ascending: false } as const;

const GRUPOS: { clave: string; titulo: string; estados: EstadoLevante[]; vacio: string }[] = [
  { clave: "lactante", titulo: "Terneras lactantes", estados: ["lactante"], vacio: "No hay crías lactantes." },
  { clave: "destetar", titulo: "Por destetar", estados: ["destetar"], vacio: "Ninguna cría cumplió los días de destete." },
  { clave: "levante", titulo: "Levante", estados: ["levante"], vacio: "No hay animales en levante." },
  { clave: "lista_servicio", titulo: "Listas para servicio", estados: ["lista_servicio"], vacio: "Ninguna novilla cumple edad y peso para servicio." },
  { clave: "servidas", titulo: "Novillas servidas y preñadas", estados: ["servida", "prenada"], vacio: "No hay novillas servidas." },
];

export default async function LevanteFinca({ params, searchParams }: PageProps<"/fincas/[id]/levante">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const pedido = leerRangoPedido(sp);
  const seleccion = typeof sp.animal === "string" ? sp.animal : undefined;

  const { supabase, rol } = await obtenerSesion();
  const gestor = ROLES_GESTORES.includes(rol);

  const { data: finca } = await supabase
    .from("fincas")
    .select("id, nombre, dias_destete, edad_servicio_meses, peso_servicio_kg")
    .eq("id", id)
    .maybeSingle();
  if (!finca) notFound();

  // hasta = fecha de corte del estado de levante; desde–hasta filtra pesajes y destetes.
  const referencia = await corteDeFinca(supabase, id);
  const rango = completarRango(pedido, referencia);
  const hasta = rango.hasta;

  const [{ data }, pesajesRango, destetesRango] = await Promise.all([
    supabase.rpc("levante_finca", { p_finca: id, p_corte: hasta }),
    consultarPagina(
      (a, b) =>
        supabase
          .from("pesajes")
          .select("id, fecha, peso_kg, observaciones, animales!inner(id, nombre, chapeta, codigo, finca_id)", { count: "exact" })
          .eq("animales.finca_id", id)
          .gte("fecha", rango.desde)
          .lte("fecha", hasta)
          .order("fecha", DESC)
          .order("registrado_en", DESC)
          .order("id")
          .range(a, b),
      leerPagina(sp, { param: "ppes", tamano: PESAJES_POR_PAGINA }),
    ),
    consultarPagina(
      (a, b) =>
        supabase
          .from("animales")
          .select("id, nombre, chapeta, codigo, categoria, fecha_nacimiento, fecha_destete", { count: "exact" })
          .eq("finca_id", id)
          .gte("fecha_destete", rango.desde)
          .lte("fecha_destete", hasta)
          .order("fecha_destete", DESC)
          .order("id")
          .range(a, b),
      leerPagina(sp, { param: "pdes", tamano: DESTETES_POR_PAGINA }),
    ),
  ]);
  const filas = data ?? [];

  const elegido = filas.find((f) => f.animal_id === seleccion);
  // La curva de crecimiento usa todos los pesajes hasta la fecha «hasta» (necesita la historia desde el nacimiento).
  const pesajes = elegido
    ? ((await supabase.from("pesajes").select("id, fecha, peso_kg, altura_cm, condicion_corporal, observaciones").eq("animal_id", elegido.animal_id).lte("fecha", hasta)).data ?? [])
    : [];

  const cuenta = (...estados: string[]) => filas.filter((f) => estados.includes(f.estado)).length;
  // Conserva rango y páginas de los grupos al abrir o cerrar la curva de un animal.
  const enlace = (extra: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (!(k in extra) && typeof v === "string") q.set(k, v);
    for (const [k, v] of Object.entries(extra)) if (v) q.set(k, v);
    const s = q.toString();
    return `/fincas/${id}/levante${s ? `?${s}` : ""}`;
  };
  const sinDestetar = filas.filter((f) => !f.fecha_destete && ["ternera", "ternero"].includes(f.categoria));
  const ruta = `/fincas/${id}/levante`;

  return (
    <div className="space-y-8">
      <BotonVolver href={`/fincas/${id}`}>{finca.nombre}</BotonVolver>

      <Encabezado
        eyebrow={`Terneras y novillas · ${finca.nombre}`}
        titulo="Levante"
        descripcion={`Destete a los ${finca.dias_destete} días · servicio desde los ${finca.edad_servicio_meses} meses con ${num(finca.peso_servicio_kg)} kg.`}
      />

      <Tarjeta>
        <RangoFechas
          ruta={ruta}
          searchParams={sp}
          desde={rango.todo ? "" : rango.desde}
          hasta={hasta}
          texto={textoRango(rango)}
          atajos={atajosDias(referencia, rango)}
          referencia={referencia}
          nota="El estado de cada animal se calcula a la fecha «hasta»; pesajes y destetes se filtran por el rango."
        />
        <p className="mt-4 border-t border-black/10 pt-4 text-sm text-tinta-suave">
          Datos al <strong className="text-bosque">{fecha(hasta, true)}</strong> · {filas.length} animales de levante
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          <Metrica valor={num(cuenta("lactante"))} etiqueta="Lactantes" tono="crema" />
          <Metrica valor={num(cuenta("destetar"))} etiqueta="Por destetar" tono={cuenta("destetar") ? "alerta" : "crema"} />
          <Metrica valor={num(cuenta("levante"))} etiqueta="En levante" tono="crema" />
          <Metrica valor={num(cuenta("lista_servicio"))} etiqueta="Listas para servicio" />
          <Metrica valor={`${num(cuenta("servida"))} / ${num(cuenta("prenada"))}`} etiqueta="Servidas / preñadas" />
          <Metrica valor={num(pesajesRango.total)} etiqueta="Pesajes en el rango" tono="crema" />
          <Metrica valor={num(destetesRango.total)} etiqueta="Destetes en el rango" tono="crema" />
        </div>
      </Tarjeta>

      {elegido && (
        <Tarjeta id="crecimiento">
          <TituloTarjeta
            detalle={
              <Link href={enlace({ animal: undefined })} scroll={false} className="font-bold text-bosque hover:underline">
                Cerrar
              </Link>
            }
          >
            <span className="inline-flex items-center gap-2">
              <LineChart className="h-5 w-5" aria-hidden />
              Crecimiento de{" "}
              <Link href={`/animales/${elegido.animal_id}`} className="hover:underline">
                {elegido.nombre}
              </Link>
            </span>
          </TituloTarjeta>
          <SeccionCrecimiento
            pesajes={pesajes}
            nacimiento={elegido.fecha_nacimiento}
            fechaDestete={elegido.fecha_destete}
            reglas={finca}
            levante={elegido}
          />
        </Tarjeta>
      )}

      {puedeRegistrar(rol) && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Tarjeta>
            <TituloTarjeta>
              <span className="inline-flex items-center gap-2">
                <Scale className="h-5 w-5" aria-hidden />
                Registrar pesaje
              </span>
            </TituloTarjeta>
            {filas.length ? (
              <FormularioPesaje accion={registrarPesaje.bind(null, id)} animales={filas} corte={hasta} animal={elegido?.animal_id} />
            ) : (
              <Vacio>No hay animales de levante.</Vacio>
            )}
          </Tarjeta>
          <Tarjeta>
            <TituloTarjeta detalle={`${sinDestetar.length} sin destetar`}>Registrar destete</TituloTarjeta>
            <FormularioDestete accion={registrarDestete.bind(null, id)} animales={sinDestetar} corte={hasta} animal={elegido?.animal_id} />
            {gestor && (
              <div className="mt-6 border-t border-black/10 pt-4">
                <p className="mb-3 flex items-center gap-2 text-sm font-bold text-bosque">
                  <Settings2 className="h-4 w-4" aria-hidden />
                  Reglas de la finca
                </p>
                <FormularioReglasLevante accion={guardarReglasFinca.bind(null, id)} finca={finca} />
              </div>
            )}
          </Tarjeta>
        </div>
      )}

      {GRUPOS.map((g) => {
        // levante_finca devuelve todo el levante (hace falta para los conteos y formularios); aquí solo se pinta una página por grupo.
        const param = `p${g.clave}`;
        const ancla = `grupo-${g.clave}`;
        const { filas: grupo, total, pagina } = recortar(
          filas.filter((f) => g.estados.includes(f.estado as EstadoLevante)),
          leerPagina(sp, { param, tamano: POR_GRUPO }),
        );
        return (
          <Tarjeta key={g.clave} id={ancla} className="scroll-mt-6">
            <TituloTarjeta detalle={`${num(total)} animales`}>{g.titulo}</TituloTarjeta>
            {grupo.length === 0 ? (
              <Vacio>{g.vacio}</Vacio>
            ) : (
              <div className="overflow-x-auto">
                <table className="matriz w-full border-collapse bg-white text-sm">
                  <thead>
                    <tr>
                      <th>Chapeta</th>
                      <th>Nombre</th>
                      <th>Categoría</th>
                      <th>Edad (meses)</th>
                      <th>Madre</th>
                      <th>Último peso</th>
                      <th>Fecha peso</th>
                      <th>Ganancia g/día</th>
                      <th>Destete</th>
                      {g.clave === "servidas" && <th>Servicio</th>}
                      <th>Estado</th>
                      <th>Curva</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grupo.map((f) => {
                      const estado = ESTADOS_LEVANTE[f.estado as EstadoLevante];
                      return (
                        <tr key={f.animal_id} className={f.animal_id === seleccion ? "bg-lima-suave" : "hover:bg-lima-suave"}>
                          <td className="font-mono font-bold">{f.chapeta ?? f.codigo}</td>
                          <td className="!text-left">
                            <Link href={`/animales/${f.animal_id}`} className="font-bold text-bosque hover:underline">
                              {f.nombre}
                            </Link>
                          </td>
                          <td className="capitalize">{f.categoria}</td>
                          <td>{num(f.edad_meses)}</td>
                          <td>{f.madre_nombre ?? "—"}</td>
                          <td className="font-bold">{f.ultimo_peso != null ? `${num(f.ultimo_peso)} kg` : "—"}</td>
                          <td>{fecha(f.fecha_ultimo_peso)}</td>
                          <td className={tonoGanancia(f.ganancia_diaria_g)}>{f.ganancia_diaria_g != null ? num(f.ganancia_diaria_g) : "—"}</td>
                          <td className={f.estado === "destetar" ? "font-bold text-alerta" : undefined}>
                            {f.fecha_destete ? `Destetada ${fecha(f.fecha_destete)}` : f.destetar_el ? `Destetar ${fecha(f.destetar_el)}` : "—"}
                          </td>
                          {g.clave === "servidas" && <td>{fecha(f.ultimo_servicio)}</td>}
                          <td>{estado ? <Etiqueta tono={estado.tono}>{estado.texto}</Etiqueta> : f.estado}</td>
                          <td>
                            <Link href={`${enlace({ animal: f.animal_id })}#crecimiento`} scroll={false} className="font-bold text-bosque underline-offset-2 hover:underline">
                              Ver
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <Paginacion
              ruta={ruta}
              searchParams={sp}
              param={param}
              pagina={pagina.pagina}
              tamano={pagina.tamano}
              total={total}
              unidad="animales"
              etiqueta={`Páginas de ${g.titulo.toLowerCase()}`}
              ancla={ancla}
            />
          </Tarjeta>
        );
      })}

      <div className="grid gap-6 lg:grid-cols-2">
        <Tarjeta id="pesajes-rango" className="scroll-mt-6">
          <TituloTarjeta detalle={`${num(pesajesRango.total)} · ${textoRango(rango).toLowerCase()}`}>Pesajes del rango</TituloTarjeta>
          {!pesajesRango.filas.length ? (
            <Vacio>No hay pesajes registrados en este rango de fechas.</Vacio>
          ) : (
            <div className="overflow-x-auto">
              <table className="matriz w-full border-collapse bg-white text-sm">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Animal</th>
                    <th>Peso</th>
                    <th>Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {pesajesRango.filas.map((p) => (
                    <tr key={p.id}>
                      <td>{fecha(p.fecha)}</td>
                      <td className="!text-left">
                        <Link href={`/animales/${p.animales.id}`} className="font-bold text-bosque hover:underline">
                          {p.animales.nombre}
                        </Link>{" "}
                        <span className="font-mono text-xs text-tinta-suave">{p.animales.chapeta ?? p.animales.codigo}</span>
                      </td>
                      <td className="font-bold">{num(p.peso_kg)} kg</td>
                      <td className="!whitespace-normal !text-left">{p.observaciones ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Paginacion
            ruta={ruta}
            searchParams={sp}
            param="ppes"
            pagina={pesajesRango.pagina.pagina}
            tamano={pesajesRango.pagina.tamano}
            total={pesajesRango.total}
            unidad="pesajes"
            etiqueta="Páginas de pesajes del rango"
            ancla="pesajes-rango"
          />
        </Tarjeta>

        <Tarjeta id="destetes-rango" className="scroll-mt-6">
          <TituloTarjeta detalle={`${num(destetesRango.total)} · ${textoRango(rango).toLowerCase()}`}>Destetes del rango</TituloTarjeta>
          {!destetesRango.filas.length ? (
            <Vacio>No hay destetes registrados en este rango de fechas.</Vacio>
          ) : (
            <div className="overflow-x-auto">
              <table className="matriz w-full border-collapse bg-white text-sm">
                <thead>
                  <tr>
                    <th>Fecha destete</th>
                    <th>Animal</th>
                    <th>Categoría</th>
                    <th>Nacimiento</th>
                  </tr>
                </thead>
                <tbody>
                  {destetesRango.filas.map((d) => (
                    <tr key={d.id}>
                      <td>{fecha(d.fecha_destete)}</td>
                      <td className="!text-left">
                        <Link href={`/animales/${d.id}`} className="font-bold text-bosque hover:underline">
                          {d.nombre}
                        </Link>{" "}
                        <span className="font-mono text-xs text-tinta-suave">{d.chapeta ?? d.codigo}</span>
                      </td>
                      <td className="capitalize">{d.categoria}</td>
                      <td>{fecha(d.fecha_nacimiento)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Paginacion
            ruta={ruta}
            searchParams={sp}
            param="pdes"
            pagina={destetesRango.pagina.pagina}
            tamano={destetesRango.pagina.tamano}
            total={destetesRango.total}
            unidad="destetes"
            etiqueta="Páginas de destetes del rango"
            ancla="destetes-rango"
          />
        </Tarjeta>
      </div>
    </div>
  );
}

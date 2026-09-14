import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, LineChart, Scale, Settings2 } from "lucide-react";
import { puedeRegistrar } from "@/lib/permisos";
import { obtenerSesion, ROLES_GESTORES } from "@/lib/sesion";
import { corteDeFinca } from "@/lib/datos";
import { fecha, num } from "@/lib/formato";
import { BotonVolver, Encabezado, Etiqueta, Metrica, Tarjeta, TituloTarjeta, Vacio } from "@/components/ui";
import { guardarReglasFinca } from "@/app/(vacinfo)/fincas/actions";
import { ESTADOS_LEVANTE, tonoGanancia, type EstadoLevante } from "@/components/levante/etiquetas";
import { FormularioDestete, FormularioPesaje, FormularioReglasLevante } from "@/components/levante/formularios-levante";
import { SeccionCrecimiento } from "@/components/levante/seccion-crecimiento";
import { registrarDestete, registrarPesaje } from "./actions";

export const metadata = { title: "Levante" };

const GRUPOS: { clave: string; titulo: string; estados: EstadoLevante[]; vacio: string }[] = [
  { clave: "lactante", titulo: "Terneras lactantes", estados: ["lactante"], vacio: "No hay crías lactantes." },
  { clave: "destetar", titulo: "Por destetar", estados: ["destetar"], vacio: "Ninguna cría cumplió los días de destete." },
  { clave: "levante", titulo: "Levante", estados: ["levante"], vacio: "No hay animales en levante." },
  { clave: "lista_servicio", titulo: "Listas para servicio", estados: ["lista_servicio"], vacio: "Ninguna novilla cumple edad y peso para servicio." },
  { clave: "servidas", titulo: "Novillas servidas y preñadas", estados: ["servida", "prenada"], vacio: "No hay novillas servidas." },
];

export default async function LevanteFinca({ params, searchParams }: PageProps<"/fincas/[id]/levante">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const pedido = typeof sp.corte === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.corte) ? sp.corte : null;
  const seleccion = typeof sp.animal === "string" ? sp.animal : undefined;

  const { supabase, rol } = await obtenerSesion();
  const gestor = ROLES_GESTORES.includes(rol);

  const { data: finca } = await supabase
    .from("fincas")
    .select("id, nombre, dias_destete, edad_servicio_meses, peso_servicio_kg")
    .eq("id", id)
    .maybeSingle();
  if (!finca) notFound();

  const corte = await corteDeFinca(supabase, id, pedido);
  const { data } = await supabase.rpc("levante_finca", { p_finca: id, p_corte: corte });
  const filas = data ?? [];

  const elegido = filas.find((f) => f.animal_id === seleccion);
  const pesajes = elegido
    ? ((await supabase.from("pesajes").select("id, fecha, peso_kg, altura_cm, condicion_corporal, observaciones").eq("animal_id", elegido.animal_id).lte("fecha", corte)).data ?? [])
    : [];

  const cuenta = (...estados: string[]) => filas.filter((f) => estados.includes(f.estado)).length;
  const enlace = (extra: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    if (pedido) q.set("corte", pedido);
    for (const [k, v] of Object.entries(extra)) if (v) q.set(k, v);
    const s = q.toString();
    return `/fincas/${id}/levante${s ? `?${s}` : ""}`;
  };
  const sinDestetar = filas.filter((f) => !f.fecha_destete && ["ternera", "ternero"].includes(f.categoria));

  return (
    <div className="space-y-8">
      <BotonVolver href={`/fincas/${id}`}>{finca.nombre}</BotonVolver>

      <Encabezado
        eyebrow={`Terneras y novillas · ${finca.nombre}`}
        titulo="Levante"
        descripcion={`Destete a los ${finca.dias_destete} días · servicio desde los ${finca.edad_servicio_meses} meses con ${num(finca.peso_servicio_kg)} kg.`}
      />

      <Tarjeta>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <p className="text-sm text-tinta-suave">
            Datos al <strong className="text-bosque">{fecha(corte, true)}</strong> · {filas.length} animales de levante
          </p>
          <form className="flex items-center gap-2">
            {seleccion && <input type="hidden" name="animal" value={seleccion} />}
            <label htmlFor="corte" className="flex items-center gap-1 text-sm font-bold text-bosque">
              <CalendarDays className="h-4 w-4" aria-hidden />
              Fecha de corte
            </label>
            <input id="corte" type="date" name="corte" defaultValue={corte} className="campo-control w-auto py-2" />
            <button className="rounded-xl bg-bosque px-4 py-2 text-sm font-bold text-leche">Ver</button>
          </form>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Metrica valor={num(cuenta("lactante"))} etiqueta="Lactantes" tono="crema" />
          <Metrica valor={num(cuenta("destetar"))} etiqueta="Por destetar" tono={cuenta("destetar") ? "alerta" : "crema"} />
          <Metrica valor={num(cuenta("levante"))} etiqueta="En levante" tono="crema" />
          <Metrica valor={num(cuenta("lista_servicio"))} etiqueta="Listas para servicio" />
          <Metrica valor={`${num(cuenta("servida"))} / ${num(cuenta("prenada"))}`} etiqueta="Servidas / preñadas" />
        </div>
      </Tarjeta>

      {elegido && (
        <Tarjeta id="crecimiento">
          <TituloTarjeta
            detalle={
              <Link href={enlace({})} scroll={false} className="font-bold text-bosque hover:underline">
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
              <FormularioPesaje accion={registrarPesaje.bind(null, id)} animales={filas} corte={corte} animal={elegido?.animal_id} />
            ) : (
              <Vacio>No hay animales de levante.</Vacio>
            )}
          </Tarjeta>
          <Tarjeta>
            <TituloTarjeta detalle={`${sinDestetar.length} sin destetar`}>Registrar destete</TituloTarjeta>
            <FormularioDestete accion={registrarDestete.bind(null, id)} animales={sinDestetar} corte={corte} animal={elegido?.animal_id} />
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
        const grupo = filas.filter((f) => g.estados.includes(f.estado as EstadoLevante));
        return (
          <Tarjeta key={g.clave}>
            <TituloTarjeta detalle={`${grupo.length} animales`}>{g.titulo}</TituloTarjeta>
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
          </Tarjeta>
        );
      })}
    </div>
  );
}

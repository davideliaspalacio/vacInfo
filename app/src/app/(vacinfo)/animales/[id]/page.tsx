import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { puedeRegistrar } from "@/lib/permisos";
import { obtenerSesion, ROLES_GESTORES } from "@/lib/sesion";
import { corteDeFinca } from "@/lib/datos";
import { fecha, litros, num } from "@/lib/formato";
import { consultarPagina, leerPagina, paginarUnion } from "@/lib/paginacion";
import { atajosDias, completarRango, leerRangoPedido, textoRango } from "@/lib/rango";
import { BotonVolver, Encabezado, Etiqueta, Metrica, Tarjeta, TituloTarjeta, Vacio } from "@/components/ui";
import { Paginacion } from "@/components/paginacion";
import { RangoFechas } from "@/components/rango-fechas";
import { todasLasFilas } from "@/components/informes/consultas";
import { Dato } from "@/components/fincas/campo";
import { CodigoQR } from "@/components/fincas/codigo-qr";
import { GraficoProduccion } from "@/components/fincas/grafico-produccion";
import { edad } from "@/components/fincas/consultas";
import { esLevante } from "@/components/levante/etiquetas";
import { SeccionCrecimiento } from "@/components/levante/seccion-crecimiento";
import { CATEGORIAS, ESPECIES, ESTADOS_ANIMAL, ESTADOS_SANITARIOS, SEXOS, TIPOS_BAJA, TIPOS_SANITARIOS } from "@/components/fincas/etiquetas";

/** Rango por defecto de la ficha: el último año (producción e historiales). */
const DIAS_POR_DEFECTO = 365;
const POR_PAGINA = 20;
const BAJAS_POR_PAGINA = 10;
const CLAVES = "id, fecha, registrado_en";
const DESC = { ascending: false } as const;

type EventoReproductivo = {
  clave: string;
  fecha: string;
  evento: React.ReactNode;
  detalle: React.ReactNode;
  responsable: string | null;
};

export default async function FichaAnimal({ params, searchParams }: PageProps<"/animales/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const { supabase, rol } = await obtenerSesion();
  const gestor = ROLES_GESTORES.includes(rol);

  const { data: animal } = await supabase
    .from("animales")
    .select("*, fincas(id, nombre, dias_destete, edad_servicio_meses, peso_servicio_kg)")
    .eq("id", id)
    .maybeSingle();
  if (!animal) notFound();

  // hasta = fecha de corte del estado reproductivo y del levante; desde–hasta filtra producción e historiales.
  const referencia = await corteDeFinca(supabase, animal.finca_id);
  const rango = completarRango(leerRangoPedido(sp), referencia, { dias: DIAS_POR_DEFECTO });
  const { desde, hasta: corte } = rango;

  const [pesajes, levante] = await Promise.all([
    supabase.from("pesajes").select("id, fecha, peso_kg, altura_cm, condicion_corporal, observaciones").eq("animal_id", id).lte("fecha", corte),
    esLevante(animal.categoria)
      ? supabase.rpc("levante_finca", { p_finca: animal.finca_id, p_corte: corte }).eq("animal_id", id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const mostrarCrecimiento = animal.fincas && (esLevante(animal.categoria) || (pesajes.data?.length ?? 0) > 0);

  const [madre, crias, ordenos, estadoRep, historial, sanidad, bajas, ultimaBaja] = await Promise.all([
    animal.madre_id ? supabase.from("animales").select("id, nombre, chapeta").eq("id", animal.madre_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("animales").select("id, nombre, chapeta, sexo, fecha_nacimiento").eq("madre_id", id).order("fecha_nacimiento", { ascending: false }),
    todasLasFilas((a, b) => supabase.from("ordenos").select("id, fecha, litros").eq("animal_id", id).gte("fecha", desde).lte("fecha", corte).order("fecha").order("id").range(a, b)),
    supabase.rpc("estado_reproductivo", { p_finca: animal.finca_id, p_corte: corte }).eq("animal_id", id).maybeSingle(),
    paginarUnion(
      {
        servicios: (a, b) => supabase.from("servicios").select(CLAVES, { count: "exact" }).eq("animal_id", id).gte("fecha", desde).lte("fecha", corte).order("fecha", DESC).order("registrado_en", DESC).order("id").range(a, b),
        palpaciones: (a, b) => supabase.from("palpaciones").select(CLAVES, { count: "exact" }).eq("animal_id", id).gte("fecha", desde).lte("fecha", corte).order("fecha", DESC).order("registrado_en", DESC).order("id").range(a, b),
        partos: (a, b) => supabase.from("partos").select(CLAVES, { count: "exact" }).eq("animal_id", id).gte("fecha", desde).lte("fecha", corte).order("fecha", DESC).order("registrado_en", DESC).order("id").range(a, b),
        secados: (a, b) => supabase.from("secados").select(CLAVES, { count: "exact" }).eq("animal_id", id).gte("fecha", desde).lte("fecha", corte).order("fecha", DESC).order("registrado_en", DESC).order("id").range(a, b),
      },
      leerPagina(sp, { param: "prep", tamano: POR_PAGINA }),
    ),
    consultarPagina(
      (a, b) => supabase.from("eventos_sanitarios").select("*", { count: "exact" }).eq("animal_id", id).gte("fecha", desde).lte("fecha", corte).order("fecha", DESC).order("registrado_en", DESC).order("id").range(a, b),
      leerPagina(sp, { param: "psan", tamano: POR_PAGINA }),
    ),
    consultarPagina(
      (a, b) => supabase.from("bajas").select("*", { count: "exact" }).eq("animal_id", id).gte("fecha", desde).lte("fecha", corte).order("fecha", DESC).order("registrado_en", DESC).order("id").range(a, b),
      leerPagina(sp, { param: "pbajas", tamano: BAJAS_POR_PAGINA }),
    ),
    supabase.from("bajas").select("fecha, tipo, causa").eq("animal_id", id).order("fecha", DESC).order("registrado_en", DESC).limit(1).maybeSingle(),
  ]);

  // Del historial reproductivo solo se traen completas las filas de la página visible.
  const sinFilas = Promise.resolve({ data: [] });
  const [servicios, palpaciones, partos, secados] = await Promise.all([
    historial.ids("servicios").length ? supabase.from("servicios").select("*").in("id", historial.ids("servicios")) : sinFilas,
    historial.ids("palpaciones").length ? supabase.from("palpaciones").select("*").in("id", historial.ids("palpaciones")) : sinFilas,
    historial.ids("partos").length ? supabase.from("partos").select("*, cria:animales!partos_cria_id_fkey(id, nombre)").in("id", historial.ids("partos")) : sinFilas,
    historial.ids("secados").length ? supabase.from("secados").select("*").in("id", historial.ids("secados")) : sinFilas,
  ]);

  const porDia = new Map<string, number>();
  for (const o of ordenos) porDia.set(o.fecha, (porDia.get(o.fecha) ?? 0) + Number(o.litros));
  const produccion = [...porDia.entries()].map(([f, l]) => ({ fecha: f, litros: Math.round(l * 10) / 10 }));
  const promedio = produccion.length ? produccion.reduce((s, p) => s + p.litros, 0) / produccion.length : null;
  const maximo = produccion.length ? Math.max(...produccion.map((p) => p.litros)) : null;

  const reproduccion: EventoReproductivo[] = [
    ...(servicios.data ?? []).map((s) => ({
      clave: `s-${s.id}`,
      fecha: s.fecha,
      evento: <Etiqueta tono="azul">Servicio · {s.tipo === "monta" ? "monta" : "inseminación"}</Etiqueta>,
      detalle: [s.toro_nombre && `Toro ${s.toro_nombre}`, s.toro_raza, s.jornada?.toUpperCase(), s.observaciones].filter(Boolean).join(" · "),
      responsable: s.inseminador,
    })),
    ...(palpaciones.data ?? []).map((p) => ({
      clave: `p-${p.id}`,
      fecha: p.fecha,
      evento: <Etiqueta tono={p.resultado === "prenada" ? "verde" : "amarillo"}>Palpación · {p.resultado === "prenada" ? "preñada" : "vacía"}</Etiqueta>,
      detalle: [p.dias_prenez != null && `${p.dias_prenez} días de preñez`, p.observaciones].filter(Boolean).join(" · "),
      responsable: p.veterinario,
    })),
    ...(partos.data ?? []).map((p) => ({
      clave: `pa-${p.id}`,
      fecha: p.fecha,
      evento: <Etiqueta tono={p.aborto || !p.nacido_vivo ? "rojo" : "verde"}>{p.aborto ? "Aborto" : "Parto"}</Etiqueta>,
      detalle: (
        <>
          {[
            p.cria_sexo && `Cría ${SEXOS[p.cria_sexo].toLowerCase()}`,
            p.cria_raza,
            !p.nacido_vivo && "nació muerta",
            p.toma_calostro != null && (p.toma_calostro ? "tomó calostro" : "sin calostro"),
            p.placenta_expulsada === false && "placenta retenida",
            p.observaciones,
          ]
            .filter(Boolean)
            .join(" · ")}
          {p.cria && (
            <>
              {" · "}
              <Link href={`/animales/${p.cria.id}`} className="font-bold text-bosque hover:underline">
                {p.cria.nombre}
              </Link>
            </>
          )}
        </>
      ),
      responsable: p.persona_calostro,
    })),
    ...(secados.data ?? []).map((s) => ({
      clave: `se-${s.id}`,
      fecha: s.fecha,
      evento: <Etiqueta tono="gris">Secado</Etiqueta>,
      detalle: s.motivo ?? "",
      responsable: null,
    })),
  ];
  const porClave = new Map(reproduccion.map((r) => [r.clave, r]));
  const prefijo = { servicios: "s", palpaciones: "p", partos: "pa", secados: "se" } as const;
  const eventos = historial.claves.flatMap((c) => porClave.get(`${prefijo[c.fuente]}-${c.id}`) ?? []);

  const er = estadoRep.data;
  const baja = ultimaBaja.data;

  return (
    <div className="space-y-8">
      <BotonVolver href={`/fincas/${animal.finca_id}`}>{animal.fincas?.nombre ?? "Finca"}</BotonVolver>

      <Encabezado
        eyebrow="Hoja informativa ser vivo"
        titulo={animal.nombre}
        descripcion={
          <>
            {CATEGORIAS[animal.categoria]} · {animal.chapeta ? `chapeta ${animal.chapeta}` : "sin chapeta"} · {animal.fincas?.nombre}
          </>
        }
        acciones={
          gestor && (
            <Link href={`/animales/${id}/editar`} className="boton-accion inline-flex items-center gap-2 rounded-xl bg-lima px-5 py-3 font-bold text-bosque">
              <Pencil className="h-5 w-5" aria-hidden />
              Editar
            </Link>
          )
        }
      />

      {baja && (
        <p className="rounded-2xl bg-[#fbe9e5] px-4 py-3 font-bold text-alerta">
          {ESTADOS_ANIMAL[animal.estado]} el {fecha(baja.fecha, true)} · {TIPOS_BAJA[baja.tipo]}
          {baja.causa && `: ${baja.causa}`}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <Tarjeta>
          <TituloTarjeta detalle={<Etiqueta tono={animal.estado === "activo" ? "verde" : "rojo"}>{ESTADOS_ANIMAL[animal.estado]}</Etiqueta>}>
            Datos generales
          </TituloTarjeta>
          <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Dato etiqueta="Código">
              <span className="font-mono">{animal.codigo}</span>
            </Dato>
            <Dato etiqueta="Especie">{ESPECIES[animal.especie]}</Dato>
            <Dato etiqueta="Sexo">{SEXOS[animal.sexo]}</Dato>
            <Dato etiqueta="Raza">{animal.raza}</Dato>
            <Dato etiqueta="Color">{animal.color}</Dato>
            <Dato etiqueta="Nacimiento">
              {animal.fecha_nacimiento && `${fecha(animal.fecha_nacimiento, true)} (${edad(animal.fecha_nacimiento) ?? "—"})`}
            </Dato>
            <Dato etiqueta="Peso">{animal.peso_kg != null && `${num(animal.peso_kg)} kg`}</Dato>
            <Dato etiqueta="Método de adquisición">{animal.metodo_adquisicion}</Dato>
            <Dato etiqueta="Padre">{animal.padre_nombre}</Dato>
            <Dato etiqueta="Madre">
              {madre.data ? (
                <Link href={`/animales/${madre.data.id}`} className="underline-offset-2 hover:underline">
                  {madre.data.nombre}
                  {madre.data.chapeta && ` · ${madre.data.chapeta}`}
                </Link>
              ) : (
                animal.madre_nombre
              )}
            </Dato>
            <Dato etiqueta="Crías registradas">
              {crias.data?.length
                ? crias.data.map((c, i) => (
                    <span key={c.id}>
                      {i > 0 && ", "}
                      <Link href={`/animales/${c.id}`} className="hover:underline">
                        {c.nombre}
                      </Link>
                    </span>
                  ))
                : null}
            </Dato>
          </dl>
          {animal.notas && <p className="mt-4 rounded-2xl bg-crema p-4 text-sm text-tinta">{animal.notas}</p>}
        </Tarjeta>

        <Tarjeta className="flex flex-col items-center justify-center">
          <CodigoQR codigo={animal.codigo} nombre={animal.nombre} detalle={animal.fincas?.nombre} />
        </Tarjeta>
      </div>

      <Tarjeta>
        <RangoFechas
          ruta={`/animales/${id}`}
          searchParams={sp}
          desde={rango.todo ? "" : desde}
          hasta={corte}
          texto={textoRango(rango)}
          atajos={atajosDias(referencia, rango)}
          referencia={referencia}
          nota="El estado reproductivo y el crecimiento se calculan a la fecha «hasta»; la producción y los historiales se filtran por el rango."
        />
      </Tarjeta>

      <Tarjeta>
        <TituloTarjeta detalle={`al ${fecha(corte, true)}`}>Estado reproductivo</TituloTarjeta>
        {er ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metrica
              valor={er.en_ordeno ? "Ordeño" : er.ultimo_parto ? "Seca" : "Novilla"}
              etiqueta={er.en_ordeno ? `${er.dias_ordeno} días en ordeño` : er.dias_seca != null ? `${er.dias_seca} días seca` : "Sin partos"}
            />
            <Metrica
              valor={er.prenada ? "Preñada" : er.ultimo_servicio ? "Servida" : "Vacía"}
              etiqueta={er.ultimo_servicio ? `Servicio ${fecha(er.ultimo_servicio)}${er.toro_nombre ? ` · ${er.toro_nombre}` : ""}` : "Sin servicio"}
              tono={er.prenada ? "lima" : "crema"}
            />
            <Metrica valor={er.mora_prenez ? `${er.mora_prenez} d` : "—"} etiqueta="Mora de preñez" tono={(er.mora_prenez ?? 0) > 60 ? "alerta" : "crema"} />
            <Metrica valor={litros(er.litros_total || null)} etiqueta="Leche del último día" />
            <Metrica valor={fecha(er.palpar_el)} etiqueta="Palpar el" tono={er.palpar_el && er.palpar_el <= corte ? "alerta" : "crema"} />
            <Metrica valor={fecha(er.secar_el)} etiqueta="Secar el" tono={er.en_ordeno && er.secar_el && er.secar_el <= corte ? "alerta" : "crema"} />
            <Metrica valor={fecha(er.parto_esperado)} etiqueta="Parto esperado" tono="crema" />
            <Metrica valor={fecha(er.ultimo_parto)} etiqueta="Último parto" tono="crema" />
          </div>
        ) : (
          <Vacio>El estado reproductivo aplica a vacas y novillas activas.</Vacio>
        )}
      </Tarjeta>

      {mostrarCrecimiento && animal.fincas && (
        <Tarjeta>
          <TituloTarjeta
            detalle={
              puedeRegistrar(rol) && (
                <Link href={`/fincas/${animal.finca_id}/levante?animal=${id}#crecimiento`} className="font-bold text-bosque hover:underline">
                  Registrar pesaje o destete
                </Link>
              )
            }
          >
            Crecimiento
          </TituloTarjeta>
          <SeccionCrecimiento
            pesajes={pesajes.data ?? []}
            nacimiento={levante.data?.fecha_nacimiento ?? animal.fecha_nacimiento}
            fechaDestete={animal.fecha_destete}
            reglas={animal.fincas}
            levante={levante.data}
          />
        </Tarjeta>
      )}

      <Tarjeta>
        <TituloTarjeta detalle={textoRango(rango)}>Producción</TituloTarjeta>
        {produccion.length === 0 ? (
          <Vacio>Sin ordeños registrados en este rango de fechas.</Vacio>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-3 gap-3">
              <Metrica valor={litros(promedio)} etiqueta="Promedio diario" />
              <Metrica valor={litros(maximo)} etiqueta="Máximo" tono="crema" />
              <Metrica valor={num(produccion.length)} etiqueta="Días con registro" tono="crema" />
            </div>
            <GraficoProduccion datos={produccion} />
          </>
        )}
      </Tarjeta>

      <Tarjeta id="reproduccion" className="scroll-mt-6">
        <TituloTarjeta detalle={`${num(historial.total)} eventos`}>Reproducción</TituloTarjeta>
        {eventos.length === 0 ? (
          <Vacio>Sin servicios, palpaciones, partos ni secados registrados en este rango de fechas.</Vacio>
        ) : (
          <div className="overflow-x-auto">
            <table className="matriz w-full border-collapse bg-white text-sm">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Evento</th>
                  <th>Detalle</th>
                  <th>Responsable</th>
                </tr>
              </thead>
              <tbody>
                {eventos.map((r) => (
                  <tr key={r.clave}>
                    <td>{fecha(r.fecha)}</td>
                    <td>{r.evento}</td>
                    <td className="!whitespace-normal !text-left">{r.detalle || "—"}</td>
                    <td>{r.responsable ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Paginacion
          ruta={`/animales/${id}`}
          searchParams={sp}
          param="prep"
          pagina={historial.pagina.pagina}
          tamano={historial.pagina.tamano}
          total={historial.total}
          unidad="eventos"
          etiqueta="Páginas del historial reproductivo"
          ancla="reproduccion"
        />
      </Tarjeta>

      <Tarjeta id="sanidad" className="scroll-mt-6">
        <TituloTarjeta detalle={`${num(sanidad.total)} registros`}>Sanidad</TituloTarjeta>
        {!sanidad.filas.length ? (
          <Vacio>Sin enfermedades, tratamientos ni vacunas registrados en este rango de fechas.</Vacio>
        ) : (
          <div className="overflow-x-auto">
            <table className="matriz w-full border-collapse bg-white text-sm">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Diagnóstico</th>
                  <th>Producto</th>
                  <th>Dosis / vía</th>
                  <th>Cuartos</th>
                  <th>Retiro</th>
                  <th>Próxima</th>
                  <th>Estado</th>
                  <th>Responsable</th>
                </tr>
              </thead>
              <tbody>
                {sanidad.filas.map((s) => (
                  <tr key={s.id}>
                    <td>{fecha(s.fecha)}</td>
                    <td>{TIPOS_SANITARIOS[s.tipo]}</td>
                    <td className="!whitespace-normal !text-left">{s.diagnostico ?? "—"}</td>
                    <td className="!text-left">
                      {s.producto ?? "—"}
                      {s.lote && <span className="block text-xs text-tinta-suave">Lote {s.lote}</span>}
                    </td>
                    <td>{[s.dosis, s.via_administracion].filter(Boolean).join(" · ") || "—"}</td>
                    <td>{s.cuartos?.join(", ") || "—"}</td>
                    <td>{s.dias_retiro ? `${s.dias_retiro} d` : "—"}</td>
                    <td>{fecha(s.proxima_fecha)}</td>
                    <td>
                      <Etiqueta tono={ESTADOS_SANITARIOS[s.estado].tono}>{ESTADOS_SANITARIOS[s.estado].texto}</Etiqueta>
                    </td>
                    <td>{s.veterinario ?? s.operario ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Paginacion
          ruta={`/animales/${id}`}
          searchParams={sp}
          param="psan"
          pagina={sanidad.pagina.pagina}
          tamano={sanidad.pagina.tamano}
          total={sanidad.total}
          etiqueta="Páginas del historial de sanidad"
          ancla="sanidad"
        />
      </Tarjeta>

      {bajas.total > 0 && (
        <Tarjeta id="bajas" className="scroll-mt-6">
          <TituloTarjeta detalle={bajas.total > 1 ? `${num(bajas.total)} registros` : undefined}>Bajas</TituloTarjeta>
          <div className="overflow-x-auto">
            <table className="matriz w-full border-collapse bg-white text-sm">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Causa</th>
                  <th>Responsable traslado</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {bajas.filas.map((b) => (
                  <tr key={b.id}>
                    <td>{fecha(b.fecha)}</td>
                    <td>{TIPOS_BAJA[b.tipo]}</td>
                    <td className="!whitespace-normal !text-left">{b.causa ?? "—"}</td>
                    <td>{b.responsable_traslado ?? "—"}</td>
                    <td>{b.valor != null ? `$ ${num(b.valor)}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Paginacion
            ruta={`/animales/${id}`}
            searchParams={sp}
            param="pbajas"
            pagina={bajas.pagina.pagina}
            tamano={bajas.pagina.tamano}
            total={bajas.total}
            etiqueta="Páginas de bajas"
            ancla="bajas"
          />
        </Tarjeta>
      )}
    </div>
  );
}

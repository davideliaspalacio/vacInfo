import clsx from "clsx";
import { fecha, litros, num } from "@/lib/formato";
import { Etiqueta, Tarjeta, TituloTarjeta, Vacio } from "@/components/ui";
import { todasLasFilas, type PropsInforme } from "./consultas";

type Estado = {
  animal_id: string;
  chapeta: string | null;
  nombre: string;
  categoria: string;
  ultimo_parto: string | null;
  ultimo_secado: string | null;
  en_ordeno: boolean;
  dias_ordeno: number | null;
  dias_seca: number | null;
  ultimo_servicio: string | null;
  toro_nombre: string | null;
  toro_raza: string | null;
  tipo_servicio: string | null;
  inseminador: string | null;
  ultima_palpacion: string | null;
  palpador: string | null;
  prenada: boolean;
  mora_prenez: number | null;
  palpar_el: string | null;
  secar_el: string | null;
  parto_esperado: string | null;
};

type Fila = Estado & {
  partoAnterior: string | null;
  crioSexo: string | null;
  aborto: boolean;
  am: number | null;
  pm: number | null;
  total: number | null;
  sanidad: { cuartos: Set<string>; tipos: Set<string> };
};

const CUARTOS = ["TDD", "TDI", "TTD", "TTI"] as const;
const SANIDAD = [
  { tipo: "cojera", etiqueta: "Cojera" },
  { tipo: "fiebre", etiqueta: "Fiebre" },
  { tipo: "mastitis", etiqueta: "Mastitis" },
  { tipo: "entamborada", etiqueta: "Entamb." },
  { tipo: "fiebre_leche", etiqueta: "F. leche" },
] as const;

const INSEMINACION: Record<string, string> = { inseminacion: "IA", monta: "Monta" };

export async function InformeOperativo({ supabase, rango, finca }: PropsInforme) {
  const { fincaId, desde, hasta } = rango;

  const [estado, resumen, alertas, partos, ordenos, sanitarios, recolecciones, consumos] = await Promise.all([
    supabase.rpc("estado_reproductivo", { p_finca: fincaId, p_corte: hasta }),
    supabase.rpc("resumen_finca", { p_finca: fincaId, p_corte: hasta }).single(),
    supabase.rpc("alertas_finca", { p_finca: fincaId, p_corte: hasta, p_horizonte: 15 }),
    todasLasFilas((a, b) =>
      supabase
        .from("partos")
        .select("animal_id, fecha, cria_sexo, aborto, animales!partos_animal_id_fkey!inner(finca_id)")
        .eq("animales.finca_id", fincaId)
        .lte("fecha", hasta)
        .order("fecha", { ascending: false })
        .order("id")
        .range(a, b),
    ),
    todasLasFilas((a, b) =>
      supabase
        .from("ordenos")
        .select("animal_id, fecha, jornada, litros, animales!inner(finca_id)")
        .eq("animales.finca_id", fincaId)
        .gte("fecha", desde)
        .lte("fecha", hasta)
        .order("id")
        .range(a, b),
    ),
    supabase
      .from("eventos_sanitarios")
      .select("animal_id, tipo, cuartos, animales!inner(finca_id)")
      .eq("animales.finca_id", fincaId)
      .gte("fecha", desde)
      .lte("fecha", hasta),
    supabase.from("recolecciones_leche").select("fecha, litros").eq("finca_id", fincaId).gte("fecha", desde).lte("fecha", hasta),
    supabase
      .from("consumos_diarios")
      .select("fecha, kg_concentrado_vacas, kg_sal_vacas, kg_concentrado_terneras, kg_sal_terneras")
      .eq("finca_id", fincaId)
      .gte("fecha", desde)
      .lte("fecha", hasta),
  ]);

  // Partos por animal, del más reciente al más antiguo
  const partosPorAnimal = new Map<string, { fecha: string; cria_sexo: string | null; aborto: boolean }[]>();
  for (const p of partos) {
    const lista = partosPorAnimal.get(p.animal_id) ?? [];
    lista.push(p);
    partosPorAnimal.set(p.animal_id, lista);
  }

  // Leche: promedio diario por jornada en los días que cada vaca fue ordeñada
  const leche = new Map<string, { am: number; pm: number; diasAm: Set<string>; diasPm: Set<string> }>();
  const lechePorDia = new Map<string, number>();
  const vacaDias = new Set<string>();
  for (const o of ordenos) {
    const l = leche.get(o.animal_id) ?? { am: 0, pm: 0, diasAm: new Set(), diasPm: new Set() };
    const litrosOrdeno = Number(o.litros);
    if (o.jornada === "am") {
      l.am += litrosOrdeno;
      l.diasAm.add(o.fecha);
    } else {
      l.pm += litrosOrdeno;
      l.diasPm.add(o.fecha);
    }
    leche.set(o.animal_id, l);
    lechePorDia.set(o.fecha, (lechePorDia.get(o.fecha) ?? 0) + litrosOrdeno);
    vacaDias.add(`${o.animal_id}|${o.fecha}`);
  }

  const sanidad = new Map<string, Fila["sanidad"]>();
  for (const e of sanitarios.data ?? []) {
    const s = sanidad.get(e.animal_id) ?? { cuartos: new Set<string>(), tipos: new Set<string>() };
    s.tipos.add(e.tipo);
    e.cuartos?.forEach((c: string) => s.cuartos.add(c));
    sanidad.set(e.animal_id, s);
  }

  const filas: Fila[] = ((estado.data ?? []) as Estado[]).map((e) => {
    const ps = partosPorAnimal.get(e.animal_id) ?? [];
    const l = leche.get(e.animal_id);
    const am = l && l.diasAm.size ? l.am / l.diasAm.size : null;
    const pm = l && l.diasPm.size ? l.pm / l.diasPm.size : null;
    return {
      ...e,
      partoAnterior: ps[1]?.fecha ?? null,
      crioSexo: ps[0]?.cria_sexo ?? null,
      aborto: ps.some((p) => p.aborto && (!e.ultimo_servicio || p.fecha >= e.ultimo_servicio)),
      am,
      pm,
      total: am == null && pm == null ? null : (am ?? 0) + (pm ?? 0),
      sanidad: sanidad.get(e.animal_id) ?? { cuartos: new Set(), tipos: new Set() },
    };
  });

  const enOrdeno = filas.filter((f) => f.en_ordeno);
  const horras = filas.filter((f) => !f.en_ordeno);

  // Resumen de leche
  const totalOrdenado = [...lechePorDia.values()].reduce((s, v) => s + v, 0);
  const diasConOrdeno = lechePorDia.size;
  const recogidas = recolecciones.data ?? [];
  const totalRecogido = recogidas.reduce((s, r) => s + Number(r.litros), 0);
  const diasRecoleccion = new Set(recogidas.map((r) => r.fecha));
  const ordenadoEnDiasRecoleccion = [...diasRecoleccion].reduce((s, d) => s + (lechePorDia.get(d) ?? 0), 0);

  const r = resumen.data;
  const totalVacas = r ? r.vacas_ordeno + r.vacas_horras + r.novillas_vientre : 0;
  const porc = (n: number | undefined) => (totalVacas && n != null ? `${Math.round((n / totalVacas) * 100)}%` : "—");

  const cons = consumos.data ?? [];
  const suma = (k: "kg_concentrado_vacas" | "kg_sal_vacas" | "kg_concentrado_terneras" | "kg_sal_terneras") =>
    cons.reduce((s, c) => s + Number(c[k] ?? 0), 0);

  return (
    <div className="space-y-6">
      <Tarjeta className="print:rounded-none print:p-0">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-2xl font-bold uppercase text-bosque">{finca.nombre}</h2>
          <span className="text-sm font-bold text-tinta-suave">
            Leche promedio del {fecha(desde)} al {fecha(hasta)} · corte reproductivo {fecha(hasta)}
          </span>
        </div>
        {filas.length === 0 ? (
          <Vacio>No hay vacas ni novillas activas registradas en esta finca.</Vacio>
        ) : (
          <div className="space-y-6">
            <Matriz titulo="Vacas en ordeño" filas={enOrdeno} hasta={hasta} />
            <Matriz titulo="Vacas horras y novillas de vientre" filas={horras} hasta={hasta} horras />
          </div>
        )}
      </Tarjeta>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4 print:grid-cols-4">
        <Tarjeta>
          <TituloTarjeta>Resumen leche</TituloTarjeta>
          <Resumen
            filas={[
              ["Total leche ordeñada", litros(totalOrdenado)],
              ["Días con ordeño", num(diasConOrdeno)],
              ["Promedio vaca/día", litros(vacaDias.size ? totalOrdenado / vacaDias.size : null)],
              ["Promedio finca/día", litros(diasConOrdeno ? totalOrdenado / diasConOrdeno : null)],
              [`Recogida carro tanque (${diasRecoleccion.size} días)`, litros(totalRecogido)],
              ["Ordeñada esos días", litros(ordenadoEnDiasRecoleccion)],
              [
                "Diferencia ordeñado − recogido",
                diasRecoleccion.size ? (
                  <span className={clsx(ordenadoEnDiasRecoleccion - totalRecogido > 0 && "text-alerta")}>
                    {litros(ordenadoEnDiasRecoleccion - totalRecogido)}
                  </span>
                ) : (
                  "—"
                ),
              ],
            ]}
          />
        </Tarjeta>

        <Tarjeta>
          <TituloTarjeta detalle={`al ${fecha(hasta)}`}>Animales en la finca</TituloTarjeta>
          {r ? (
            <Resumen
              filas={[
                ["Vacas preñadas", <Con key="p" n={r.prenadas} p={porc(r.prenadas)} />],
                ["Vacas servidas", <Con key="s" n={r.servidas_sin_confirmar} p={porc(r.servidas_sin_confirmar)} />],
                ["Vacas vacías", <Con key="v" n={r.vacias} p={porc(r.vacias)} />],
                ["Vacas horras", <Con key="h" n={r.vacas_horras} p={porc(r.vacas_horras)} />],
                ["Vacas en ordeño", <Con key="o" n={r.vacas_ordeno} p={porc(r.vacas_ordeno)} />],
                ["Novillas de vientre", <Con key="n" n={r.novillas_vientre} p={porc(r.novillas_vientre)} />],
                ["Terneras", num(r.terneras)],
                ["Total", <strong key="t">{num(totalVacas)} · 100%</strong>],
              ]}
            />
          ) : (
            <Vacio>Sin datos.</Vacio>
          )}
        </Tarjeta>

        <Tarjeta>
          <TituloTarjeta detalle={`${cons.length} días`}>Consumos</TituloTarjeta>
          {cons.length === 0 ? (
            <Vacio>No se registraron consumos diarios de concentrado ni sal en el periodo.</Vacio>
          ) : (
            <Resumen
              filas={[
                ["Concentrado vacas", `${num(suma("kg_concentrado_vacas"))} kg`],
                ["Promedio día", `${num(suma("kg_concentrado_vacas") / cons.length)} kg`],
                ["Sal vacas", `${num(suma("kg_sal_vacas"))} kg`],
                ["Concentrado terneras", `${num(suma("kg_concentrado_terneras"))} kg`],
                ["Sal terneras", `${num(suma("kg_sal_terneras"))} kg`],
                [
                  "Kg concentrado por litro",
                  totalOrdenado ? num(suma("kg_concentrado_vacas") / totalOrdenado) : "—",
                ],
              ]}
            />
          )}
        </Tarjeta>

        <Tarjeta>
          <TituloTarjeta>Próximos eventos</TituloTarjeta>
          {(alertas.data ?? []).length === 0 ? (
            <Vacio>Sin eventos próximos.</Vacio>
          ) : (
            <ul className="space-y-2 text-sm">
              {(alertas.data ?? []).slice(0, 8).map((a, i) => (
                <li key={`${a.tipo}-${a.animal_id}-${i}`} className="flex items-start justify-between gap-2 border-b border-tinta/10 pb-2">
                  <span>
                    <strong className="text-bosque">
                      {a.chapeta ? `${a.chapeta} · ` : ""}
                      {a.nombre}
                    </strong>
                    <span className="block text-tinta-suave">{a.detalle}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <Etiqueta tono={a.prioridad === "alta" ? "rojo" : a.prioridad === "media" ? "amarillo" : "gris"}>{fecha(a.fecha)}</Etiqueta>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>
    </div>
  );
}

function Con({ n, p }: { n: number; p: string }) {
  return (
    <span>
      <strong>{n}</strong> <span className="inline-block w-10 text-right text-tinta-suave">{p}</span>
    </span>
  );
}

function Resumen({ filas }: { filas: [string, React.ReactNode][] }) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {filas.map(([etiqueta, valor], i) => (
          <tr key={etiqueta} className="border-b border-tinta/10 last:border-0">
            <td className="py-1.5 pr-2 text-tinta-suave">
              <span className="mr-1 text-xs text-tinta/40">{i + 1}</span>
              {etiqueta}
            </td>
            <td className="py-1.5 text-right font-bold text-tinta">{valor}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Matriz({ titulo, filas, hasta, horras = false }: { titulo: string; filas: Fila[]; hasta: string; horras?: boolean }) {
  const vencida = (f: string | null) => (f && f < hasta ? "bg-[#fbe0da] font-bold text-alerta" : undefined);
  const si = (v: boolean) => (v ? "✓" : "");

  return (
    <section>
      <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-tinta-suave">
        {titulo} · {filas.length}
      </h3>
      {filas.length === 0 ? (
        <Vacio>Ningún animal en este grupo.</Vacio>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#8291a0]/40">
          <table className="matriz w-full min-w-[1500px] border-collapse bg-white text-[11px] text-tinta">
            <thead>
              <tr>
                <th colSpan={3} className="!bg-bosque !text-leche">Identificación</th>
                <th colSpan={4}>Partos</th>
                <th colSpan={12}>Servicio de monta y fertilidad</th>
                <th colSpan={3} className="!bg-[#e7f0d4]">Medidas de leche</th>
                <th colSpan={9} className="!bg-[#f6e6c6]">Tratamientos</th>
                <th>Cría</th>
              </tr>
              <tr>
                <th>#</th>
                <th>Chapeta</th>
                <th className="text-left">Nombre</th>
                <th>Fecha parto anterior</th>
                <th>Fecha crío</th>
                <th>{horras ? "Días seca" : "Días ordeño"}</th>
                <th>Preñez más 40</th>
                <th>Fecha servida</th>
                <th>Palpar 33 días</th>
                <th>Nombre del toro</th>
                <th>Raza</th>
                <th>Insem.</th>
                <th>Palpada el</th>
                <th>Preñada</th>
                <th>Palpador</th>
                <th>Secar el día</th>
                <th>Cría el</th>
                <th>Fecha secado</th>
                <th>Aborto</th>
                <th className="!bg-[#e7f0d4]">Mañana</th>
                <th className="!bg-[#e7f0d4]">Tarde</th>
                <th className="!bg-[#e7f0d4]">Total</th>
                {CUARTOS.map((c) => (
                  <th key={c} className="!bg-[#f6e6c6]">
                    {c}
                  </th>
                ))}
                {SANIDAD.map((s) => (
                  <th key={s.tipo} className="!bg-[#f6e6c6]">
                    {s.etiqueta}
                  </th>
                ))}
                <th>Macho / hembra</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f, i) => (
                <tr key={f.animal_id} className="odd:bg-white even:bg-[#f5f8fb]">
                  <td className="text-tinta/50">{i + 1}</td>
                  <td className="font-bold">{f.chapeta ?? "—"}</td>
                  <td className="!text-left font-bold">{f.nombre}</td>
                  <td>{f.partoAnterior ? fecha(f.partoAnterior) : f.categoria === "novilla" || f.ultimo_parto ? "NOVILLA" : ""}</td>
                  <td>{fecha(f.ultimo_parto)}</td>
                  <td>{horras ? num(f.dias_seca) : num(f.dias_ordeno)}</td>
                  <td className={clsx(f.mora_prenez != null && f.mora_prenez > 0 && "font-bold text-alerta")}>
                    {f.mora_prenez ? f.mora_prenez : "-"}
                  </td>
                  <td>{f.ultimo_servicio ? fecha(f.ultimo_servicio) : ""}</td>
                  <td className={vencida(f.palpar_el)}>{f.palpar_el ? fecha(f.palpar_el) : ""}</td>
                  <td>{f.toro_nombre ?? ""}</td>
                  <td>{f.toro_raza ?? ""}</td>
                  <td>{f.tipo_servicio ? (INSEMINACION[f.tipo_servicio] ?? f.tipo_servicio) : ""}</td>
                  <td>{f.ultima_palpacion ? fecha(f.ultima_palpacion) : ""}</td>
                  <td className={clsx(f.prenada && "font-bold text-pasto-oscuro")}>{f.ultima_palpacion ? (f.prenada ? "SI" : "NO") : ""}</td>
                  <td>{f.palpador ?? ""}</td>
                  <td className={f.en_ordeno ? vencida(f.secar_el) : undefined}>{f.secar_el ? fecha(f.secar_el) : ""}</td>
                  <td>{f.parto_esperado ? fecha(f.parto_esperado) : ""}</td>
                  <td>{f.ultimo_secado && (!f.ultimo_parto || f.ultimo_secado > f.ultimo_parto) ? fecha(f.ultimo_secado) : ""}</td>
                  <td className={clsx(f.aborto && "font-bold text-alerta")}>{f.aborto ? "SI" : ""}</td>
                  <td>{f.am != null ? num(f.am) : ""}</td>
                  <td className="text-alerta">{f.pm != null ? num(f.pm) : ""}</td>
                  <td className="font-bold">{f.total != null ? num(f.total) : ""}</td>
                  {CUARTOS.map((c) => (
                    <td key={c} className="font-bold text-alerta">
                      {si(f.sanidad.cuartos.has(c))}
                    </td>
                  ))}
                  {SANIDAD.map((s) => (
                    <td key={s.tipo} className="font-bold text-alerta">
                      {si(f.sanidad.tipos.has(s.tipo))}
                    </td>
                  ))}
                  <td>{f.crioSexo ? f.crioSexo.toUpperCase() : ""}</td>
                </tr>
              ))}
            </tbody>
            {!horras && (
              <tfoot>
                <tr className="bg-[#e7f0d4] font-bold">
                  <td colSpan={19} className="!text-right">
                    Promedio por vaca (L/día)
                  </td>
                  <td>{num(promedio(filas.map((f) => f.am)))}</td>
                  <td>{num(promedio(filas.map((f) => f.pm)))}</td>
                  <td>{num(promedio(filas.map((f) => f.total)))}</td>
                  <td colSpan={10} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </section>
  );
}

function promedio(valores: (number | null)[]) {
  const v = valores.filter((x): x is number => x != null);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
}

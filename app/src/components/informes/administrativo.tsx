import { fecha, num, pesos } from "@/lib/formato";
import { todasLasFilas, type PropsInforme } from "./consultas";

async function todas<T>(consulta: Parameters<typeof todasLasFilas<T>>[0]) {
  return { data: await todasLasFilas(consulta) };
}

type Celda = React.ReactNode;
type Registro = { titulo: string; columnas: string[]; filas: Celda[][]; color?: string };

const COLORES = ["bg-[#8fd04f]", "bg-[#61e4df]", "bg-[#fff000]"];

const ok = (v: boolean | null | undefined) => (v ? "✓" : "");
const hora = (h: string | null) => (h ? h.slice(0, 5) : "");
const cantidad = (c: number | null, u: string | null) => (c == null ? "" : `${num(c)}${u ? ` ${u}` : ""}`);

const TIPO_APLICACION: Record<string, string> = {
  fumigacion: "Fumigación",
  fertilizacion: "Fertilización",
  abonada: "Abonada",
  encalada: "Encalada",
};

export async function InformeAdministrativo({ supabase, rango, finca }: PropsInforme) {
  const { fincaId, desde, hasta } = rango;
  // Un rango largo puede superar las 1000 filas que devuelve PostgREST por petición: se leen todas por bloques.
  const [movimientos, recolecciones, sanitarios, visitas, aplicaciones, consumos, mantenimientos, controles, bajas, secados, palpaciones, servicios, partos] =
    await Promise.all([
      todas((a, b) => supabase.from("movimientos_insumos").select("*").eq("finca_id", fincaId).gte("fecha", desde).lte("fecha", hasta).order("fecha").order("id").range(a, b)),
      todas((a, b) => supabase.from("recolecciones_leche").select("*").eq("finca_id", fincaId).gte("fecha", desde).lte("fecha", hasta).order("fecha").order("id").range(a, b)),
      todas((a, b) => supabase.from("eventos_sanitarios").select("*, animales!inner(nombre, chapeta, categoria, raza, finca_id)").eq("animales.finca_id", fincaId).gte("fecha", desde).lte("fecha", hasta).order("fecha").order("id").range(a, b)),
      todas((a, b) => supabase.from("visitas").select("*").eq("finca_id", fincaId).gte("fecha", desde).lte("fecha", hasta).order("fecha").order("id").range(a, b)),
      todas((a, b) => supabase.from("aplicaciones_campo").select("*").eq("finca_id", fincaId).gte("fecha", desde).lte("fecha", hasta).order("fecha").order("id").range(a, b)),
      todas((a, b) => supabase.from("consumos_diarios").select("*").eq("finca_id", fincaId).gte("fecha", desde).lte("fecha", hasta).order("fecha").order("id").range(a, b)),
      todas((a, b) => supabase.from("mantenimientos").select("*").eq("finca_id", fincaId).gte("fecha", desde).lte("fecha", hasta).order("fecha").order("id").range(a, b)),
      todas((a, b) => supabase.from("controles_calidad").select("*").eq("finca_id", fincaId).gte("fecha", desde).lte("fecha", hasta).order("fecha").order("id").range(a, b)),
      todas((a, b) => supabase.from("bajas").select("*, animales!inner(nombre, chapeta, categoria, raza, finca_id)").eq("animales.finca_id", fincaId).gte("fecha", desde).lte("fecha", hasta).order("fecha").order("id").range(a, b)),
      todas((a, b) => supabase.from("secados").select("*, animales!inner(nombre, chapeta, categoria, raza, finca_id, servicios(fecha))").eq("animales.finca_id", fincaId).gte("fecha", desde).lte("fecha", hasta).order("fecha").order("id").range(a, b)),
      todas((a, b) => supabase.from("palpaciones").select("*, animales!inner(nombre, chapeta, categoria, raza, finca_id)").eq("animales.finca_id", fincaId).gte("fecha", desde).lte("fecha", hasta).order("fecha").order("id").range(a, b)),
      todas((a, b) => supabase.from("servicios").select("*, animales!inner(nombre, chapeta, categoria, raza, finca_id)").eq("animales.finca_id", fincaId).gte("fecha", desde).lte("fecha", hasta).order("fecha").order("id").range(a, b)),
      todas((a, b) => supabase.from("partos").select("*, animales!partos_animal_id_fkey!inner(nombre, chapeta, categoria, raza, finca_id)").eq("animales.finca_id", fincaId).gte("fecha", desde).lte("fecha", hasta).order("fecha").order("id").range(a, b)),
    ]);

  const ev = sanitarios.data ?? [];
  const ap = aplicaciones.data ?? [];
  const mt = mantenimientos.data ?? [];
  const ctl = controles.data ?? [];
  const bj = bajas.data ?? [];

  const registros: Registro[] = [
    {
      titulo: "Registro de ingreso y salida de medicamentos, concentrados, abonos y maquinarias",
      columnas: ["Fecha", "Nombre del producto", "Cant. ingresa", "Cant. sale", "Persona que entrega", "Persona que recibe", "Hora de entrega"],
      filas: (movimientos.data ?? []).map((m) => [
        fecha(m.fecha),
        m.producto,
        m.tipo === "ingreso" ? num(m.cantidad) : "",
        m.tipo === "salida" ? num(m.cantidad) : "",
        m.entrega,
        m.recibe,
        hora(m.hora),
      ]),
    },
    {
      titulo: "Registro de leche recogida diario",
      columnas: ["Fecha", "Litros recogidos", "Placa del carro", "Conductor", "Celular", "Persona que entrega"],
      filas: (recolecciones.data ?? []).map((r) => [fecha(r.fecha), num(r.litros), r.placa, r.conductor, r.celular_conductor, r.entregado_por]),
    },
    {
      titulo: "Registro vacas con mastitis",
      columnas: ["Fecha", "Chapeta", "Nombre", "TDD", "TDI", "TTD", "TTI", "Tratamiento"],
      filas: ev
        .filter((e) => e.tipo === "mastitis")
        .map((e) => [
          fecha(e.fecha),
          e.animales.chapeta,
          e.animales.nombre,
          ...["TDD", "TDI", "TTD", "TTI"].map((c) => ok(e.cuartos?.includes(c))),
          e.producto ?? e.diagnostico,
        ]),
    },
    {
      titulo: "Registro de ingreso de personas a la finca",
      columnas: ["Fecha", "Hora", "Nombre", "Cédula", "Empresa", "Placa", "Motivo"],
      filas: (visitas.data ?? []).map((v) => [fecha(v.fecha), hora(v.hora_ingreso), v.nombre, v.cedula, v.empresa, v.placa, v.motivo]),
    },
    {
      titulo: "Registro de fumigación",
      columnas: ["Fecha", "Tipo", "Producto", "Cantidad por caneca", "Retiro vacas (días)", "Potreros", "Personas que fumigan"],
      filas: ap
        .filter((a) => a.tipo === "fumigacion" || a.tipo === "fertilizacion")
        .map((a) => [fecha(a.fecha), TIPO_APLICACION[a.tipo], a.producto, cantidad(a.cantidad, a.unidad), num(a.dias_retiro_pastoreo), a.potreros, a.personas]),
    },
    {
      titulo: "Consumo diario de concentrado y sal",
      columnas: ["Fecha", "Kg conc. vacas", "Kg sal vacas", "Kg conc. terneras", "Kg sal terneras"],
      filas: (consumos.data ?? []).map((c) => [
        fecha(c.fecha),
        num(c.kg_concentrado_vacas),
        num(c.kg_sal_vacas),
        num(c.kg_concentrado_terneras),
        num(c.kg_sal_terneras),
      ]),
    },
    {
      titulo: "Registro de mantenimiento equipo de ordeño y tanque de enfriamiento",
      columnas: ["Fecha", "Equipo", "Persona que lo realiza", "Detalle del mantenimiento", "Celular del operario"],
      filas: mt
        .filter((m) => m.tipo === "equipo_ordeno" || m.tipo === "tanque")
        .map((m) => [fecha(m.fecha), m.tipo === "tanque" ? "Tanque" : "Equipo de ordeño", m.responsable, m.detalle, m.celular]),
    },
    {
      titulo: "Registro de abonada y encalada",
      columnas: ["Fecha", "Tipo", "Abono o cal", "Cantidad por potrero", "Retiro vacas (días)", "Potreros", "Personas"],
      filas: ap
        .filter((a) => a.tipo === "abonada" || a.tipo === "encalada")
        .map((a) => [fecha(a.fecha), TIPO_APLICACION[a.tipo], a.producto, cantidad(a.cantidad, a.unidad), num(a.dias_retiro_pastoreo), a.potreros, a.personas]),
    },
    {
      titulo: "Registro de pH y cloro en el agua",
      columnas: ["Fecha", "Toma del agua", "pH", "Cloro", "Tratamiento"],
      filas: ctl.filter((c) => c.tipo === "agua").map((c) => [fecha(c.fecha), c.muestra, num(c.ph), num(c.cloro), c.tratamiento]),
    },
    {
      titulo: "Registro de mantenimiento de alambrados, rieles, zanjas y riego",
      columnas: ["Fecha", "Persona que lo realiza", "Detalle del mantenimiento", "Potreros", "Materiales utilizados"],
      filas: mt
        .filter((m) => m.tipo === "cercas" || m.tipo === "general" || m.tipo === "equipos")
        .map((m) => [fecha(m.fecha), m.responsable, m.detalle, m.potreros, m.materiales]),
    },
    {
      titulo: "Registro de tratamiento de animales en la finca",
      columnas: [
        "Fecha",
        "Animal tratado",
        "Nombre",
        "Chapeta",
        "Producto",
        "Lote",
        "Registro ICA",
        "Dosis",
        "Vía",
        "Días retiro",
        "Operario",
        "Médico veterinario (T.P.)",
      ],
      filas: ev
        .filter((e) => ["tratamiento", "enfermedad", "vacuna", "desparasitacion", "cirugia"].includes(e.tipo))
        .map((e) => [
          fecha(e.fecha),
          e.animales.categoria,
          e.animales.nombre,
          e.animales.chapeta,
          e.producto ?? e.diagnostico,
          e.lote,
          e.registro_ica,
          e.dosis,
          e.via_administracion,
          num(e.dias_retiro),
          e.operario,
          [e.veterinario, e.tarjeta_profesional && `T.P. ${e.tarjeta_profesional}`].filter(Boolean).join(" · "),
        ]),
    },
    {
      titulo: "Registro de animales vendidos o retirados de la finca",
      columnas: ["Fecha", "Chapeta", "Vaca, toro, ternero…", "Nombre", "Raza", "Lo lleva", "Motivo", "Valor"],
      filas: bj
        .filter((b) => b.tipo !== "muerte")
        .map((b) => [
          fecha(b.fecha),
          b.animales.chapeta,
          b.animales.categoria,
          b.animales.nombre,
          b.animales.raza,
          b.responsable_traslado,
          [b.tipo === "venta" ? "Venta" : "Retiro", b.causa].filter(Boolean).join(": "),
          b.valor != null ? pesos(b.valor) : "",
        ]),
    },
    {
      titulo: "Registro de vacas que se secan",
      columnas: ["Fecha", "Chapeta", "Nombre de la vaca", "Fecha de servida", "Motivo"],
      filas: (secados.data ?? []).map((s) => {
        const servida = s.animales.servicios
          .map((sv: { fecha: string }) => sv.fecha)
          .filter((f: string) => f <= s.fecha)
          .sort()
          .at(-1);
        return [fecha(s.fecha), s.animales.chapeta, s.animales.nombre, servida ? fecha(servida) : "", s.motivo];
      }),
    },
    {
      titulo: "Registro veneno mosca",
      columnas: ["Fecha", "Producto", "Cantidad", "Animales tratados", "Personas"],
      filas: ap
        .filter((a) => a.tipo === "veneno_mosca")
        .map((a) => [fecha(a.fecha), a.producto, cantidad(a.cantidad, a.unidad), num(a.animales_tratados), a.personas]),
    },
    {
      titulo: "Registro de palpación en la finca",
      columnas: ["Fecha", "Chapeta", "Nombre de la vaca", "Preñada", "Días de preñez", "Vacía", "Palpador", "Observaciones"],
      filas: (palpaciones.data ?? []).map((p) => [
        fecha(p.fecha),
        p.animales.chapeta,
        p.animales.nombre,
        ok(p.resultado === "prenada"),
        num(p.dias_prenez),
        ok(p.resultado === "vacia"),
        p.veterinario,
        p.observaciones,
      ]),
    },
    {
      titulo: "Registro de inseminación o monta",
      columnas: ["Fecha", "Chapeta", "Nombre de la vaca", "Nombre del toro", "Raza del toro", "AM", "PM", "Tipo", "Inseminador"],
      filas: (servicios.data ?? []).map((s) => [
        fecha(s.fecha),
        s.animales.chapeta,
        s.animales.nombre,
        s.toro_nombre,
        s.toro_raza,
        ok(s.jornada === "am"),
        ok(s.jornada === "pm"),
        s.tipo === "monta" ? "Monta" : "IA",
        s.inseminador,
      ]),
    },
    {
      titulo: "Registro veneno roedores",
      columnas: ["Fecha", "Producto", "Cantidad", "Lugar", "Personas"],
      filas: ap
        .filter((a) => a.tipo === "veneno_roedores")
        .map((a) => [fecha(a.fecha), a.producto, cantidad(a.cantidad, a.unidad), a.area ?? a.potreros, a.personas]),
    },
    {
      titulo: "Registro de vacas criadas",
      columnas: ["Fecha", "Chapeta", "Nombre de la vaca", "Cría macho o hembra", "Raza", "Cría día", "Cría noche", "Toma calostro", "Persona que la ve tomar"],
      filas: (partos.data ?? []).map((p) => [
        fecha(p.fecha),
        p.animales.chapeta,
        p.animales.nombre,
        p.aborto ? "ABORTO" : (p.cria_sexo ?? "").toUpperCase(),
        p.cria_raza,
        ok(p.en_la_noche === false),
        ok(p.en_la_noche === true),
        p.toma_calostro == null ? "" : p.toma_calostro ? "SI" : "NO",
        p.persona_calostro,
      ]),
    },
    {
      titulo: "Registro temperatura del tanque de enfriamiento",
      columnas: ["Fecha", "Hora del día", "Grados", "Persona que lo hizo"],
      filas: ctl
        .filter((c) => c.tipo === "temperatura_tanque")
        .map((c) => [fecha(c.fecha), c.jornada === "pm" ? "Tarde PM" : c.jornada === "am" ? "Mañana AM" : "", c.grados != null ? `${num(c.grados)} °C` : "", c.responsable]),
    },
    {
      titulo: "Animales muertos en la finca",
      columnas: ["Fecha", "Chapeta", "Nombre", "Enfermedad", "Vende"],
      filas: bj
        .filter((b) => b.tipo === "muerte")
        .map((b) => [fecha(b.fecha), b.animales.chapeta, b.animales.nombre, b.causa, b.valor != null ? pesos(b.valor) : ""]),
    },
  ];


  const coloreados = registros.map((r, i) => ({ ...r, color: (i + 1) % 5 === 0 ? COLORES[2] : (i + 1) % 3 === 0 ? COLORES[1] : COLORES[0] }));
  const conDatos = coloreados.filter((r) => r.filas.length > 0);
  const vacios = coloreados.filter((r) => r.filas.length === 0);
  const angostos = conDatos.filter((r) => r.columnas.length < COLUMNAS_ANCHO);
  const anchos = conDatos.filter((r) => r.columnas.length >= COLUMNAS_ANCHO);

  return (
    <section className="papel rounded-3xl p-4 sm:p-6 print:rounded-none print:p-0">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div>
          <h2 className="font-display text-2xl font-bold text-bosque">Informe administrativo · {finca.nombre}</h2>
          <p className="text-sm text-tinta-suave">
            {conDatos.length} de {registros.length} registros con movimientos en el periodo
          </p>
        </div>
        <span className="text-sm font-bold text-tinta-suave">
          Planilla del {fecha(desde, true)} al {fecha(hasta, true)}
        </span>
      </div>

      {conDatos.length === 0 && (
        <p className="mb-4 rounded-2xl border border-dashed border-tinta/20 p-6 text-center text-tinta-suave">
          Ningún registro administrativo tiene movimientos en este periodo.
        </p>
      )}

      {/* Mampostería: cada bloque ocupa solo su alto, sin huecos junto a las tablas largas */}
      {angostos.length > 0 && (
        <div className="columns-1 gap-3 lg:columns-2 print:columns-2 [&>*]:mb-3">
          {angostos.map((r) => (
            <BloqueRegistro key={r.titulo} registro={r} />
          ))}
        </div>
      )}
      {anchos.map((r) => (
        <div key={r.titulo} className="mb-3">
          <BloqueRegistro registro={r} />
        </div>
      ))}

      {vacios.length > 0 && (
        <div className="mt-2 break-inside-avoid rounded-2xl border border-tinta/10 bg-white/60 p-3">
          <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-tinta-suave">
            Registros sin movimientos en el periodo · {vacios.length}
          </h3>
          <ul className="flex flex-wrap gap-1.5">
            {vacios.map((r) => (
              <li key={r.titulo} className="inline-flex items-center gap-1.5 rounded-full border border-[#111]/15 bg-white px-2.5 py-1 text-[0.7rem] font-bold uppercase leading-tight text-tinta-suave">
                <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full border border-[#111]/40 ${r.color}`} />
                {r.titulo}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Registros con muchas columnas van a lo ancho debajo de la mampostería. */
const COLUMNAS_ANCHO = 9;

function BloqueRegistro({ registro }: { registro: Registro }) {
  const { titulo, columnas, filas, color } = registro;
  return (
    <section className="break-inside-avoid border-[3px] border-[#111] bg-white">
      <h3 className={`${color} px-2 py-1.5 text-center text-[0.78rem] font-extrabold uppercase leading-tight text-[#111]`}>{titulo}</h3>
      <div className="overflow-x-auto print:overflow-visible">
        <table className="w-full border-collapse text-[0.7rem] leading-tight">
          <thead>
            <tr>
              {columnas.map((c) => (
                <th key={c} className="border-2 border-[#111] bg-[#dedbc7] px-1 py-1 text-center text-[0.62rem] font-extrabold uppercase">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((fila, i) => (
              <tr key={i}>
                {fila.map((celda, j) => (
                  <td key={j} className="border-2 border-[#111] px-1 py-1 text-center align-middle">
                    {celda ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

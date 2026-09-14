import Link from "next/link";
import { ChevronLeft, ChevronRight, Crosshair } from "lucide-react";
import { obtenerSesion, ROLES_GESTORES } from "@/lib/sesion";
import { puedeRegistrar } from "@/lib/permisos";
import { corteDeFinca } from "@/lib/datos";
import { fecha, hoyISO } from "@/lib/formato";
import { Encabezado, Metrica, Tarjeta, TituloTarjeta, Vacio } from "@/components/ui";
import { BotonImprimir } from "@/components/informes/boton-imprimir";
import { fincaElegida, mesLargo, sumarMeses, uno } from "@/components/inventario/comun";
import { AgendaMes, CuadriculaMes } from "@/components/calendario/mes";
import { enlaceCalendario, FiltroTipos } from "@/components/calendario/filtros";
import { TIPOS, type Evento } from "@/components/calendario/tipos";
import { aEvento, SELECT_PROGRAMADO, type EventoProgramado } from "@/components/calendario/programados";
import { ProgramarEvento } from "@/components/calendario/programar";
import { DetalleEvento } from "@/components/calendario/detalle-evento";

export const metadata = { title: "Calendario" };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Días de la cuadrícula: de lunes anterior al 1 hasta el domingo posterior al último día. */
function diasCuadricula(mes: string) {
  const [y, m] = mes.split("-").map(Number);
  const primero = new Date(Date.UTC(y, m - 1, 1));
  const ultimo = new Date(Date.UTC(y, m, 0));
  const inicio = new Date(primero);
  inicio.setUTCDate(1 - ((primero.getUTCDay() + 6) % 7));
  const fin = new Date(ultimo);
  fin.setUTCDate(ultimo.getUTCDate() + (6 - ((ultimo.getUTCDay() + 6) % 7)));
  const dias: string[] = [];
  for (const d = new Date(inicio); d <= fin; d.setUTCDate(d.getUTCDate() + 1)) dias.push(iso(d));
  return dias;
}

export default async function CalendarioPage(props: PageProps<"/calendario">) {
  const sp = await props.searchParams;
  const sesion = await obtenerSesion();
  const { supabase, fincas, rol } = sesion;

  if (fincas.length === 0) {
    return (
      <div className="space-y-6">
        <Encabezado eyebrow="Calendario" titulo="Calendario de la finca" />
        <Tarjeta>
          <Vacio>Tu organización todavía no tiene fincas registradas.</Vacio>
        </Tarjeta>
      </div>
    );
  }

  const finca = await fincaElegida(sesion, uno(sp.finca));
  const corte = await corteDeFinca(supabase, finca.id);
  const pedido = uno(sp.mes);
  const mes = pedido && /^\d{4}-(0[1-9]|1[0-2])$/.test(pedido) ? pedido : corte.slice(0, 7);
  const activos = (uno(sp.tipos) ?? "").split(",").filter((t) => t in TIPOS);
  const eventoId = uno(sp.evento);
  const puedeEditar = puedeRegistrar(rol);

  const dias = diasCuadricula(mes);
  const [{ data, error }, { data: programadosData }, { data: animales }] = await Promise.all([
    supabase.rpc("eventos_calendario", { p_finca: finca.id, p_desde: dias[0], p_hasta: dias.at(-1)!, p_corte: corte }),
    supabase
      .from("eventos_programados")
      .select(SELECT_PROGRAMADO)
      .eq("finca_id", finca.id)
      .gte("fecha", dias[0])
      .lte("fecha", dias.at(-1)!)
      .order("fecha")
      .order("hora", { nullsFirst: true }),
    puedeEditar
      ? supabase.from("animales").select("id, nombre, chapeta, categoria").eq("finca_id", finca.id).eq("estado", "activo").order("nombre")
      : Promise.resolve({ data: null }),
  ]);

  const programados = (programadosData ?? []) as EventoProgramado[];
  let seleccionado = eventoId ? programados.find((e) => e.id === eventoId) : undefined;
  if (eventoId && !seleccionado && UUID.test(eventoId)) {
    const { data: unico } = await supabase.from("eventos_programados").select(SELECT_PROGRAMADO).eq("id", eventoId).eq("finca_id", finca.id).maybeSingle();
    seleccionado = (unico as EventoProgramado | null) ?? undefined;
  }

  // Lo agendado se toma de la tabla (trae id, hora y estado); el resto viene de eventos_calendario.
  const todos: Evento[] = [...((data ?? []) as Evento[]).filter((e) => e.tipo !== "programado"), ...programados.map(aEvento)].sort((a, b) =>
    a.fecha.localeCompare(b.fecha),
  );
  const eventos = activos.length ? todos.filter((e) => activos.includes(e.tipo)) : todos;

  const delMes = todos.filter((e) => e.fecha.startsWith(mes) && e.estado !== "cancelado");
  const conteo: Record<string, number> = {};
  for (const e of delMes) conteo[e.tipo] = (conteo[e.tipo] ?? 0) + 1;
  const filtradosMes = eventos.filter((e) => e.fecha.startsWith(mes) && e.estado !== "cancelado");
  const realizados = filtradosMes.filter((e) => e.realizado).length;
  const vencidos = filtradosMes.filter((e) => !e.realizado && e.fecha < corte).length;
  const programadosPendientes = filtradosMes.length - realizados - vencidos;

  const titulo = mesLargo(`${mes}-01`);
  const base = enlaceCalendario(finca.id, mes, activos);
  const detalle = (id: string) => `${base}&evento=${id}#evento`;
  const hoy = hoyISO();

  return (
    <div className="space-y-6 print:space-y-3">
      <style>{`@media print {
        body > div > header, .mancha { display: none !important; }
        .fondo-vacinfo { background: #fff !important; }
        .grano::before { display: none; }
        .papel { box-shadow: none !important; }
        main { max-width: none !important; padding: 0 !important; }
      }`}</style>

      <Encabezado
        eyebrow={`Calendario · ${finca.nombre}`}
        titulo="Calendario de la finca"
        descripcion={`Lo realizado, lo programado y lo agendado por el equipo. Las fechas programadas se calculan al corte del ${fecha(corte, true)}.`}
        acciones={<BotonImprimir />}
      />

      <div className="papel flex flex-wrap items-end justify-between gap-3 rounded-2xl p-4 print:hidden">
        <form action="/calendario" className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="mes" value={mes} />
          {activos.length > 0 && <input type="hidden" name="tipos" value={activos.join(",")} />}
          <label className="text-sm font-bold text-bosque">
            Finca
            <select name="finca" defaultValue={finca.id} className="campo-control mt-1 min-w-44">
              {fincas.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nombre}
                </option>
              ))}
            </select>
          </label>
          <button className="boton-accion rounded-xl bg-lima px-4 py-3 font-bold text-bosque">Ver finca</button>
        </form>
        <nav aria-label="Cambiar de mes" className="flex flex-wrap items-center gap-2">
          <Link
            href={enlaceCalendario(finca.id, sumarMeses(mes, -1), activos)}
            className="inline-flex items-center gap-1 rounded-xl border border-tinta/15 px-3 py-2.5 text-sm font-bold text-bosque hover:bg-lima-suave"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Anterior
          </Link>
          <Link
            href={enlaceCalendario(finca.id, sumarMeses(mes, 1), activos)}
            className="inline-flex items-center gap-1 rounded-xl border border-tinta/15 px-3 py-2.5 text-sm font-bold text-bosque hover:bg-lima-suave"
          >
            Siguiente
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
          {mes !== corte.slice(0, 7) && (
            <Link
              href={enlaceCalendario(finca.id, corte.slice(0, 7), activos)}
              className="inline-flex items-center gap-1 rounded-xl bg-dorado px-3 py-2.5 text-sm font-bold text-bosque"
            >
              <Crosshair className="h-4 w-4" aria-hidden />
              Ir al corte
            </Link>
          )}
        </nav>
      </div>

      {seleccionado && (
        <DetalleEvento
          evento={seleccionado}
          corte={corte}
          volver={`${base}&evento=${seleccionado.id}`}
          cerrar={base}
          puedeEditar={puedeEditar}
          puedeBorrar={ROLES_GESTORES.includes(rol)}
        />
      )}

      {puedeEditar && (
        <Tarjeta className="print:hidden">
          <ProgramarEvento key={finca.id} fincaId={finca.id} fechaInicial={hoy.startsWith(mes) ? hoy : `${mes}-01`} animales={animales ?? []} />
        </Tarjeta>
      )}

      <Tarjeta>
        <TituloTarjeta detalle={activos.length ? `Filtrado: ${activos.map((t) => TIPOS[t].etiqueta).join(", ")}` : undefined}>
          <span className="capitalize">{titulo}</span>
        </TituloTarjeta>

        {error ? (
          <Vacio>No se pudo cargar el calendario: {error.message}</Vacio>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <Metrica valor={realizados} etiqueta="Realizados en el mes" />
              <Metrica tono="crema" valor={programadosPendientes} etiqueta="Programados pendientes" />
              <Metrica tono={vencidos ? "alerta" : "lima"} valor={vencidos} etiqueta="Programados vencidos (antes del corte)" />
            </div>
            <div className="print:hidden">
              <FiltroTipos fincaId={finca.id} mes={mes} activos={activos} conteo={conteo} />
            </div>
            <CuadriculaMes dias={dias} mes={mes} corte={corte} eventos={eventos} detalle={detalle} />
          </div>
        )}
      </Tarjeta>

      {!error && (
        <Tarjeta className="print:break-before-page">
          <TituloTarjeta detalle={`${filtradosMes.length} eventos`}>Agenda del mes</TituloTarjeta>
          <AgendaMes mes={mes} corte={corte} eventos={eventos} detalle={detalle} />
        </Tarjeta>
      )}
    </div>
  );
}

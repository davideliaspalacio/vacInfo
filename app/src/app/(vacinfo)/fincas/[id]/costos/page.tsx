import { notFound } from "next/navigation";
import { CalendarRange, CircleCheck, Lock } from "lucide-react";
import { obtenerSesion, ROLES_GESTORES } from "@/lib/sesion";
import type { ParametrosCostos } from "@/lib/finanzas";
import { fecha } from "@/lib/formato";
import { BotonVolver, Encabezado, Tarjeta } from "@/components/ui";
import { EditorCostos } from "@/components/fincas/editor-costos";
import { guardarCostos } from "./actions";

const CATEGORIAS_BASE = [
  "Concentrados",
  "Fertilizantes",
  "Venenos",
  "Suministros de aseo",
  "Medicamentos",
  "Insumos equipo de ordeño",
  "Pagos a terceros",
  "Nómina",
  "Transporte de leche",
  "Otros transportes",
  "Varios",
  "Reproducción (semen)",
  "Gastos administrativos",
  "Préstamo inversión",
  "Provisiones y mortales",
];

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const nombrePeriodo = (p: string) => `${MESES[Number(p.slice(5, 7)) - 1]} ${p.slice(0, 4)}`;

function plantillaVacia(precio: number | null): ParametrosCostos {
  return {
    precio_litro: precio ?? 0,
    valorizacion_mensual_por_animal: 0,
    animales: { vacas_produccion: 0, vacas_horras: 0, novillas: 0, terneronas: 0, terneras: 0, toros: 0, caballos: 0, perros: 0, otros: 0 },
    litros_dia: { venta: 0, terneras: 0, consumo_humano: 0 },
    costos: CATEGORIAS_BASE.map((categoria) => ({ categoria, items: [] })),
  };
}

export default async function ParametrosCostosFinca({ params, searchParams }: PageProps<"/fincas/[id]/costos">) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, rol } = await obtenerSesion();
  const gestor = ROLES_GESTORES.includes(rol);

  const [{ data: finca }, { data: filas }] = await Promise.all([
    supabase.from("fincas").select("id, nombre, precio_litro").eq("id", id).maybeSingle(),
    supabase.from("parametros_costos").select("periodo, datos, registrado_en").eq("finca_id", id).order("periodo", { ascending: false }),
  ]);
  if (!finca) notFound();

  const periodos = filas ?? [];
  const hoy = new Date();
  const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`;
  const pedido = typeof sp.periodo === "string" ? /^(\d{4}-\d{2})(-\d{2})?$/.exec(sp.periodo)?.[1] : undefined;
  const periodo = pedido ? `${pedido}-01` : (periodos[0]?.periodo ?? mesActual);

  const actual = periodos.find((p) => p.periodo === periodo);
  const base = actual ?? periodos.find((p) => p.periodo < periodo) ?? periodos[0];
  const datos = base ? (base.datos as unknown as ParametrosCostos) : plantillaVacia(finca.precio_litro);

  return (
    <div className="space-y-8">
      <BotonVolver href={`/fincas/${id}`}>{finca.nombre}</BotonVolver>
      <Encabezado
        eyebrow={`Parámetros de costos · ${finca.nombre}`}
        titulo={`Costos de ${nombrePeriodo(periodo)}`}
        descripcion="Precios, animales, litros y costos mensuales que alimentan el informe contable. La vista previa se recalcula mientras escribes."
      />

      <Tarjeta className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <CalendarRange className="h-5 w-5 text-pasto-oscuro" aria-hidden />
          <span className="text-sm font-bold text-bosque">Periodos guardados:</span>
          {periodos.length === 0 && <span className="text-sm text-tinta-suave">ninguno todavía</span>}
          {periodos.map((p) => (
            <a
              key={p.periodo}
              href={`/fincas/${id}/costos?periodo=${p.periodo}`}
              className={`rounded-full px-3 py-1 text-sm font-bold ${p.periodo === periodo ? "bg-bosque text-leche" : "bg-lima-suave text-bosque hover:bg-lima"}`}
            >
              {nombrePeriodo(p.periodo)}
            </a>
          ))}
        </div>
        <form className="flex items-center gap-2">
          <label htmlFor="periodo" className="text-sm font-bold text-bosque">
            Ir a
          </label>
          <input id="periodo" type="month" name="periodo" defaultValue={periodo.slice(0, 7)} className="campo-control w-auto py-2" />
          <button className="rounded-xl bg-bosque px-4 py-2 text-sm font-bold text-leche">Abrir</button>
        </form>
      </Tarjeta>

      {sp.guardado === "1" && actual && (
        <p className="flex items-center gap-2 rounded-2xl bg-lima px-4 py-3 font-bold text-bosque">
          <CircleCheck className="h-5 w-5" aria-hidden />
          Parámetros de {nombrePeriodo(periodo)} guardados.
        </p>
      )}
      {!actual && (
        <p className="rounded-2xl bg-dorado/90 px-4 py-3 text-sm font-bold text-bosque">
          {base
            ? `No hay parámetros para ${nombrePeriodo(periodo)}: se copiaron los de ${nombrePeriodo(base.periodo)}. Ajusta y guarda para crear el periodo.`
            : `No hay parámetros guardados para esta finca. Llena la plantilla y guarda para crear ${nombrePeriodo(periodo)}.`}
        </p>
      )}
      {!gestor && (
        <p className="flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm text-leche">
          <Lock className="h-4 w-4" aria-hidden />
          Solo lectura: solo propietarios y administradores pueden modificar los costos.
        </p>
      )}
      {actual && <p className="text-sm text-leche/70">Última actualización: {fecha(actual.registrado_en.slice(0, 10), true)}</p>}

      <EditorCostos key={`${periodo}-${actual?.registrado_en ?? "nuevo"}`} inicial={datos} editable={gestor} accion={guardarCostos.bind(null, id, periodo)} />
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { BellRing, Pencil } from "lucide-react";
import { obtenerSesion, ROLES_GESTORES } from "@/lib/sesion";
import { fecha, hoyISO, num } from "@/lib/formato";
import { consultarPagina, leerPagina } from "@/lib/paginacion";
import { atajosDias, completarRango, leerRangoPedido, textoRango } from "@/lib/rango";
import { BotonVolver, Encabezado, Etiqueta, Tarjeta, TituloTarjeta, Vacio } from "@/components/ui";
import { Paginacion } from "@/components/paginacion";
import { RangoFechas } from "@/components/rango-fechas";
import { Dato } from "@/components/fincas/campo";
import { CodigoQR } from "@/components/fincas/codigo-qr";
import { ESTADOS_BIEN, TIPOS_BIEN, TIPOS_MANTENIMIENTO } from "@/components/fincas/etiquetas";

const POR_PAGINA = 20;

export default async function FichaBien({ params, searchParams }: PageProps<"/bienes/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const { supabase, rol } = await obtenerSesion();
  const gestor = ROLES_GESTORES.includes(rol);

  // Por defecto todo el historial hasta hoy (o hasta el último mantenimiento, si hay alguno con fecha futura).
  const hoy = hoyISO();
  const { data: ultimo } = await supabase.from("mantenimientos").select("fecha").eq("bien_id", id).order("fecha", { ascending: false }).limit(1).maybeSingle();
  const referencia = ultimo?.fecha && ultimo.fecha > hoy ? ultimo.fecha : hoy;
  const rango = completarRango(leerRangoPedido(sp), referencia, { todoPorDefecto: true });

  const [{ data: bien }, mantenimientos] = await Promise.all([
    supabase.from("bienes").select("*, fincas(id, nombre)").eq("id", id).maybeSingle(),
    consultarPagina(
      (desde, hasta) =>
        supabase
          .from("mantenimientos")
          .select("*", { count: "exact" })
          .eq("bien_id", id)
          .gte("fecha", rango.desde)
          .lte("fecha", rango.hasta)
          .order("fecha", { ascending: false })
          .order("registrado_en", { ascending: false })
          .order("id")
          .range(desde, hasta),
      leerPagina(sp, { tamano: POR_PAGINA }),
    ),
  ]);
  if (!bien) notFound();

  const estado = ESTADOS_BIEN[bien.estado];
  const garantiaVigente = bien.garantia_hasta ? bien.garantia_hasta >= hoyISO() : null;

  return (
    <div className="space-y-8">
      <BotonVolver href={`/fincas/${bien.finca_id}?tab=bienes`}>{bien.fincas?.nombre ?? "Finca"}</BotonVolver>

      <Encabezado
        eyebrow="Hoja informativa bien o servicio"
        titulo={bien.nombre}
        descripcion={`${TIPOS_BIEN[bien.tipo]}${bien.marca ? ` · ${bien.marca}` : ""} · ${bien.fincas?.nombre ?? ""}`}
        acciones={
          gestor && (
            <Link href={`/bienes/${id}/editar`} className="boton-accion inline-flex items-center gap-2 rounded-xl bg-lima px-5 py-3 font-bold text-bosque">
              <Pencil className="h-5 w-5" aria-hidden />
              Editar
            </Link>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <Tarjeta>
          <TituloTarjeta detalle={<Etiqueta tono={estado.tono}>{estado.texto}</Etiqueta>}>Datos generales</TituloTarjeta>
          <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Dato etiqueta="Código">
              <span className="font-mono">{bien.codigo}</span>
            </Dato>
            <Dato etiqueta="Tipo">{TIPOS_BIEN[bien.tipo]}</Dato>
            <Dato etiqueta="Marca">{bien.marca}</Dato>
            <Dato etiqueta="Método de adquisición">{bien.metodo_adquisicion}</Dato>
            <Dato etiqueta="Fecha de adquisición">{bien.fecha_adquisicion && fecha(bien.fecha_adquisicion, true)}</Dato>
            <Dato etiqueta="Garantía hasta">
              {bien.garantia_hasta && (
                <span className="flex flex-wrap items-center gap-2">
                  {fecha(bien.garantia_hasta, true)}
                  <Etiqueta tono={garantiaVigente ? "verde" : "gris"}>{garantiaVigente ? "Vigente" : "Vencida"}</Etiqueta>
                </span>
              )}
            </Dato>
          </dl>
          {bien.descripcion && (
            <div className="mt-4">
              <p className="text-xs font-bold uppercase tracking-wider text-tinta-suave">Descripción</p>
              <p className="mt-1 whitespace-pre-line">{bien.descripcion}</p>
            </div>
          )}
          {bien.recordatorio && (
            <p className="mt-4 flex items-start gap-3 rounded-2xl bg-dorado/40 p-4 font-bold text-[#6b4a09]">
              <BellRing className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              {bien.recordatorio}
            </p>
          )}
        </Tarjeta>

        <Tarjeta className="flex flex-col items-center justify-center">
          <CodigoQR codigo={bien.codigo} nombre={bien.nombre} detalle={bien.fincas?.nombre} />
        </Tarjeta>
      </div>

      <Tarjeta id="mantenimientos" className="scroll-mt-6">
        <TituloTarjeta detalle={`${num(mantenimientos.total)} registros`}>Historial de mantenimientos</TituloTarjeta>
        <RangoFechas
          ruta={`/bienes/${id}`}
          searchParams={sp}
          desde={rango.todo ? "" : rango.desde}
          hasta={rango.hasta}
          texto={textoRango(rango)}
          atajos={atajosDias(referencia, rango)}
          ancla="mantenimientos"
          className="mb-4"
        />
        {!mantenimientos.filas.length ? (
          <Vacio>{rango.todo ? "Este bien aún no tiene mantenimientos registrados." : "No hay mantenimientos registrados en este rango de fechas."}</Vacio>
        ) : (
          <div className="overflow-x-auto">
            <table className="matriz w-full border-collapse bg-white text-sm">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Detalle</th>
                  <th>Materiales</th>
                  <th>Responsable</th>
                  <th>Celular</th>
                </tr>
              </thead>
              <tbody>
                {mantenimientos.filas.map((m) => (
                  <tr key={m.id}>
                    <td>{fecha(m.fecha)}</td>
                    <td>{TIPOS_MANTENIMIENTO[m.tipo]}</td>
                    <td className="!whitespace-normal !text-left">{m.detalle}</td>
                    <td className="!whitespace-normal">{m.materiales ?? "—"}</td>
                    <td>{m.responsable ?? "—"}</td>
                    <td>{m.celular ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Paginacion
          ruta={`/bienes/${id}`}
          searchParams={sp}
          pagina={mantenimientos.pagina.pagina}
          tamano={mantenimientos.pagina.tamano}
          total={mantenimientos.total}
          etiqueta="Páginas del historial de mantenimientos"
          ancla="mantenimientos"
        />
      </Tarjeta>
    </div>
  );
}

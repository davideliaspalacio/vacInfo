import Link from "next/link";
import { obtenerSesion } from "@/lib/sesion";
import { fecha, litros, num } from "@/lib/formato";
import { leerPagina, paginarUnion, type Params } from "@/lib/paginacion";
import { Etiqueta, Tarjeta, TituloTarjeta, Vacio } from "@/components/ui";
import { Paginacion } from "@/components/paginacion";
import { TIPOS_APLICACION, TIPOS_MANTENIMIENTO } from "@/components/fincas/etiquetas";

type Registro = {
  tipo: string;
  tono: "verde" | "amarillo" | "azul" | "gris";
  detalle: React.ReactNode;
  responsable: string | null;
};

const POR_PAGINA = 25;
const CLAVES = "id, fecha, registrado_en";
const DESC = { ascending: false } as const;

export async function HistorialServicios({ fincaId, searchParams }: { fincaId: string; searchParams: Params }) {
  const { supabase } = await obtenerSesion();

  const { claves, total, pagina, ids } = await paginarUnion(
    {
      aplicaciones: (a, b) =>
        supabase.from("aplicaciones_campo").select(CLAVES, { count: "exact" }).eq("finca_id", fincaId).order("fecha", DESC).order("registrado_en", DESC).order("id").range(a, b),
      mantenimientos: (a, b) =>
        supabase.from("mantenimientos").select(CLAVES, { count: "exact" }).eq("finca_id", fincaId).order("fecha", DESC).order("registrado_en", DESC).order("id").range(a, b),
      controles: (a, b) =>
        supabase.from("controles_calidad").select(CLAVES, { count: "exact" }).eq("finca_id", fincaId).order("fecha", DESC).order("registrado_en", DESC).order("id").range(a, b),
      recolecciones: (a, b) =>
        supabase.from("recolecciones_leche").select(CLAVES, { count: "exact" }).eq("finca_id", fincaId).order("fecha", DESC).order("registrado_en", DESC).order("id").range(a, b),
    },
    leerPagina(searchParams, { tamano: POR_PAGINA }),
  );

  // Solo se traen completas las filas de la página visible.
  const sinFilas = Promise.resolve({ data: [] });
  const [aplicaciones, mantenimientos, controles, recolecciones] = await Promise.all([
    ids("aplicaciones").length ? supabase.from("aplicaciones_campo").select("*").in("id", ids("aplicaciones")) : sinFilas,
    ids("mantenimientos").length ? supabase.from("mantenimientos").select("*, bienes(id, nombre)").in("id", ids("mantenimientos")) : sinFilas,
    ids("controles").length ? supabase.from("controles_calidad").select("*").in("id", ids("controles")) : sinFilas,
    ids("recolecciones").length ? supabase.from("recolecciones_leche").select("*").in("id", ids("recolecciones")) : sinFilas,
  ]);

  const porClave = new Map<string, Registro>();
  for (const a of aplicaciones.data ?? []) {
    porClave.set(`aplicaciones-${a.id}`, {
      tipo: TIPOS_APLICACION[a.tipo],
      tono: "verde",
      detalle: [a.producto, a.cantidad != null && `${num(a.cantidad)} ${a.unidad ?? ""}`.trim(), a.potreros && `potreros ${a.potreros}`, a.area]
        .filter(Boolean)
        .join(" · "),
      responsable: a.personas,
    });
  }
  for (const m of mantenimientos.data ?? []) {
    porClave.set(`mantenimientos-${m.id}`, {
      tipo: `Mantenimiento · ${TIPOS_MANTENIMIENTO[m.tipo]}`,
      tono: "amarillo",
      detalle: (
        <>
          {m.detalle}
          {m.materiales && <span className="text-tinta-suave"> · {m.materiales}</span>}
          {m.bienes && (
            <>
              {" · "}
              <Link href={`/bienes/${m.bienes.id}`} className="font-bold text-bosque hover:underline">
                {m.bienes.nombre}
              </Link>
            </>
          )}
        </>
      ),
      responsable: m.responsable,
    });
  }
  for (const c of controles.data ?? []) {
    porClave.set(`controles-${c.id}`, {
      tipo: c.tipo === "agua" ? "Control de agua" : "Temperatura tanque",
      tono: "azul",
      detalle:
        c.tipo === "agua"
          ? [c.muestra, c.ph != null && `pH ${num(c.ph)}`, c.cloro != null && `cloro ${num(c.cloro)}`, c.estado, c.tratamiento].filter(Boolean).join(" · ")
          : [c.grados != null && `${num(c.grados)} °C`, c.jornada?.toUpperCase(), c.estado].filter(Boolean).join(" · "),
      responsable: c.responsable,
    });
  }
  for (const r of recolecciones.data ?? []) {
    porClave.set(`recolecciones-${r.id}`, {
      tipo: "Recolección de leche",
      tono: "gris",
      detalle: [litros(r.litros), r.placa && `placa ${r.placa}`, r.conductor && `conductor ${r.conductor}`].filter(Boolean).join(" · "),
      responsable: r.entregado_por,
    });
  }

  const registros = claves.flatMap((c) => {
    const registro = porClave.get(`${c.fuente}-${c.id}`);
    return registro ? [{ ...registro, clave: `${c.fuente}-${c.id}`, fecha: c.fecha }] : [];
  });

  return (
    <Tarjeta id="historial" className="scroll-mt-6">
      <TituloTarjeta detalle={`${num(total)} registros`}>Historial de servicios</TituloTarjeta>
      {registros.length === 0 ? (
        <Vacio>Aún no hay fumigaciones, mantenimientos, controles ni recolecciones registrados.</Vacio>
      ) : (
        <div className="overflow-x-auto">
          <table className="matriz w-full border-collapse bg-white text-sm">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Detalle</th>
                <th>Responsable</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r) => (
                <tr key={r.clave}>
                  <td>{fecha(r.fecha)}</td>
                  <td>
                    <Etiqueta tono={r.tono}>{r.tipo}</Etiqueta>
                  </td>
                  <td className="!whitespace-normal !text-left">{r.detalle || "—"}</td>
                  <td>{r.responsable ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Paginacion
        ruta={`/fincas/${fincaId}`}
        searchParams={searchParams}
        pagina={pagina.pagina}
        tamano={pagina.tamano}
        total={total}
        etiqueta="Páginas del historial de servicios"
        ancla="historial"
      />
    </Tarjeta>
  );
}

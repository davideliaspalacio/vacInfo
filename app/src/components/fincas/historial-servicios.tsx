import Link from "next/link";
import { obtenerSesion } from "@/lib/sesion";
import { fecha, litros, num } from "@/lib/formato";
import { Etiqueta, Tarjeta, TituloTarjeta, Vacio } from "@/components/ui";
import { TIPOS_APLICACION, TIPOS_MANTENIMIENTO } from "@/components/fincas/etiquetas";

type Registro = {
  clave: string;
  fecha: string;
  registradoEn: string;
  tipo: string;
  tono: "verde" | "amarillo" | "azul" | "gris";
  detalle: React.ReactNode;
  responsable: string | null;
};

const LIMITE = 30;

export async function HistorialServicios({ fincaId }: { fincaId: string }) {
  const { supabase } = await obtenerSesion();
  const orden = { ascending: false } as const;

  const [aplicaciones, mantenimientos, controles, recolecciones] = await Promise.all([
    supabase.from("aplicaciones_campo").select("*").eq("finca_id", fincaId).order("fecha", orden).limit(LIMITE),
    supabase.from("mantenimientos").select("*, bienes(id, nombre)").eq("finca_id", fincaId).order("fecha", orden).limit(LIMITE),
    supabase.from("controles_calidad").select("*").eq("finca_id", fincaId).order("fecha", orden).limit(LIMITE),
    supabase.from("recolecciones_leche").select("*").eq("finca_id", fincaId).order("fecha", orden).limit(LIMITE),
  ]);

  const registros: Registro[] = [
    ...(aplicaciones.data ?? []).map((a) => ({
      clave: `a-${a.id}`,
      fecha: a.fecha,
      registradoEn: a.registrado_en,
      tipo: TIPOS_APLICACION[a.tipo],
      tono: "verde" as const,
      detalle: [a.producto, a.cantidad != null && `${num(a.cantidad)} ${a.unidad ?? ""}`.trim(), a.potreros && `potreros ${a.potreros}`, a.area]
        .filter(Boolean)
        .join(" · "),
      responsable: a.personas,
    })),
    ...(mantenimientos.data ?? []).map((m) => ({
      clave: `m-${m.id}`,
      fecha: m.fecha,
      registradoEn: m.registrado_en,
      tipo: `Mantenimiento · ${TIPOS_MANTENIMIENTO[m.tipo]}`,
      tono: "amarillo" as const,
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
    })),
    ...(controles.data ?? []).map((c) => ({
      clave: `c-${c.id}`,
      fecha: c.fecha,
      registradoEn: c.registrado_en,
      tipo: c.tipo === "agua" ? "Control de agua" : "Temperatura tanque",
      tono: "azul" as const,
      detalle:
        c.tipo === "agua"
          ? [c.muestra, c.ph != null && `pH ${num(c.ph)}`, c.cloro != null && `cloro ${num(c.cloro)}`, c.estado, c.tratamiento].filter(Boolean).join(" · ")
          : [c.grados != null && `${num(c.grados)} °C`, c.jornada?.toUpperCase(), c.estado].filter(Boolean).join(" · "),
      responsable: c.responsable,
    })),
    ...(recolecciones.data ?? []).map((r) => ({
      clave: `r-${r.id}`,
      fecha: r.fecha,
      registradoEn: r.registrado_en,
      tipo: "Recolección de leche",
      tono: "gris" as const,
      detalle: [litros(r.litros), r.placa && `placa ${r.placa}`, r.conductor && `conductor ${r.conductor}`].filter(Boolean).join(" · "),
      responsable: r.entregado_por,
    })),
  ]
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.registradoEn.localeCompare(a.registradoEn))
    .slice(0, LIMITE);

  return (
    <Tarjeta>
      <TituloTarjeta detalle={`Últimos ${LIMITE} registros`}>Historial de servicios</TituloTarjeta>
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
    </Tarjeta>
  );
}

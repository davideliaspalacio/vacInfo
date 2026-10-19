import Link from "next/link";
import { notFound } from "next/navigation";
import { FileSpreadsheet, Info } from "lucide-react";
import { MENSAJE_SOLO_LECTURA, soloLectura } from "@/lib/permisos";
import { obtenerSesion, ROLES_GESTORES } from "@/lib/sesion";
import { num } from "@/lib/formato";
import { leerPagina, recortar } from "@/lib/paginacion";
import { Encabezado, Metrica, Tarjeta, TituloTarjeta, Vacio } from "@/components/ui";
import { Paginacion } from "@/components/paginacion";
import { CASOS, PARAM_PAGINA, type Caso, type FilaRevision } from "@/components/etapas/casos";
import { GrupoEtapas } from "@/components/etapas/grupo-etapas";
import { aplicarEtapas, bajarEtapas } from "./actions";

export const metadata = { title: "Revisar etapas" };

const POR_GRUPO = 50;
/** Única etapa a la que esta pantalla baja hoy: la vaca joven sin datos vuelve a novilla. */
const ETAPA_DESTINO = "novilla";

export default async function RevisarEtapas({ params, searchParams }: PageProps<"/fincas/[id]/etapas">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);

  const { supabase, rol } = await obtenerSesion();
  // Corrigen el propietario y el administrador; los demás roles de VacInfo solo miran.
  const gestor = ROLES_GESTORES.includes(rol);

  const { data: finca } = await supabase.from("fincas").select("id, nombre").eq("id", id).maybeSingle();
  if (!finca) notFound();

  // Una fila por animal y por caso; la regla y la clasificación viven en `revision_etapas`.
  const { data, error } = await supabase.rpc("revision_etapas", { p_finca: id });
  const filas: FilaRevision[] = data ?? [];

  const del = (caso: Caso) => filas.filter((f) => f.caso === caso);
  const animales = new Set(filas.map((f) => f.animal_id)).size;
  const ruta = `/fincas/${id}/etapas`;

  return (
    <div className="space-y-8">
      <Encabezado
        eyebrow={`Etapas del hato · ${finca.nombre}`}
        titulo="Revisar etapas"
        descripcion="Los animales cuya etapa no cuadra, agrupados por lo que les pasa. La etapa la deciden los hechos: una hembra pasa a vaca con su primer parto o con sus primeros ordeños, y nunca baja sola."
      />

      <Tarjeta>
        <TituloTarjeta detalle={animales ? `${num(animales)} animales por revisar` : "Nada por revisar"}>Resumen</TituloTarjeta>
        {error ? (
          <Vacio>No se pudo leer la revisión de etapas: {error.message}</Vacio>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {CASOS.map((c) => (
              <Metrica
                key={c.caso}
                valor={num(del(c.caso).length)}
                etiqueta={c.titulo}
                tono={del(c.caso).length === 0 ? "crema" : c.caso === "pendiente" ? "lima" : "alerta"}
              />
            ))}
          </div>
        )}
        <p className="mt-4 flex items-start gap-2 border-t border-black/10 pt-4 text-sm text-tinta-suave">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            Un animal puede aparecer en dos grupos. Caballos, perros y «otros» no tienen etapas y no se revisan.{" "}
            <Link href="/importar" className="font-bold text-bosque hover:underline">
              <FileSpreadsheet className="mr-1 inline h-4 w-4" aria-hidden />
              Importar
            </Link>{" "}
            carga el historial que falta con la plantilla de seres vivos.
          </span>
        </p>
        {!gestor && (
          <p className="mt-3 text-sm font-bold text-tinta-suave">
            {soloLectura(rol) ? MENSAJE_SOLO_LECTURA : "Esta pantalla la corrigen el propietario y el administrador; aquí puedes ver qué hay por revisar."}
          </p>
        )}
      </Tarjeta>

      {CASOS.map((c) => {
        const param = PARAM_PAGINA[c.caso];
        const ancla = `caso-${c.caso}`;
        const { filas: pagina, total, pagina: p } = recortar(del(c.caso), leerPagina(sp, { param, tamano: POR_GRUPO }));
        const accion = c.accion === "aplicar" ? aplicarEtapas.bind(null, id) : c.accion === "bajar" ? bajarEtapas.bind(null, id) : undefined;

        return (
          <Tarjeta key={c.caso} id={ancla} className="scroll-mt-6">
            <TituloTarjeta detalle={`${num(total)} animales`}>{c.titulo}</TituloTarjeta>
            <p className="mb-2 text-sm text-tinta-suave">{c.explicacion}</p>
            <p className="mb-4 text-sm font-bold text-bosque">Qué hacer: {c.queHacer}</p>
            <GrupoEtapas definicion={c} filas={pagina} total={total} accion={accion} etapaDestino={ETAPA_DESTINO} soloLectura={!gestor} />
            <Paginacion
              ruta={ruta}
              searchParams={sp}
              param={param}
              pagina={p.pagina}
              tamano={p.tamano}
              total={total}
              unidad="animales"
              etiqueta={`Páginas de ${c.titulo.toLowerCase()}`}
              ancla={ancla}
            />
          </Tarjeta>
        );
      })}
    </div>
  );
}

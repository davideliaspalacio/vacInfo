import Link from "next/link";
import { obtenerSesion, ROLES_GESTORES } from "@/lib/sesion";
import { fecha, num } from "@/lib/formato";
import { consultarPagina, leerPagina } from "@/lib/paginacion";
import { BotonVolver, Encabezado, Tarjeta, TituloTarjeta, Vacio } from "@/components/ui";
import { Paginacion } from "@/components/paginacion";
import { ImportadorExcel } from "@/components/importador/importador-excel";

export const metadata = { title: "Importar Excel" };

type Resumen = {
  desde?: string | null;
  hasta?: string | null;
  conteos?: Record<string, { creados: number; omitidos: number }>;
  advertencias?: unknown[];
};

const fechaHora = new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short", timeZone: "America/Bogota" });

const POR_PAGINA = 20;

export default async function ImportarPage({ searchParams }: PageProps<"/importar">) {
  const sp = await searchParams;
  const { finca } = sp;
  const { supabase, rol, fincas } = await obtenerSesion();
  const gestor = ROLES_GESTORES.includes(rol);

  const {
    filas: historial,
    total,
    pagina,
  } = await consultarPagina(
    (desde, hasta) =>
      supabase
        .from("importaciones")
        .select("id, finca_id, archivo, hojas, resumen, registrado_por, registrado_en, fincas(nombre)", { count: "exact" })
        .order("registrado_en", { ascending: false })
        .order("id")
        .range(desde, hasta),
    leerPagina(sp, { tamano: POR_PAGINA }),
  );

  const usuarios = [...new Set(historial.map((h) => h.registrado_por).filter((x): x is string => !!x))];
  const { data: perfiles } = usuarios.length
    ? await supabase.from("perfiles").select("id, nombre_completo").in("id", usuarios)
    : { data: [] as { id: string; nombre_completo: string }[] };
  const nombreDe = new Map((perfiles ?? []).map((p) => [p.id, p.nombre_completo]));

  const pedida = typeof finca === "string" ? finca : undefined;
  const fincaInicial = fincas.find((f) => f.id === pedida)?.id ?? fincas[0]?.id ?? "";

  return (
    <div className="space-y-8">
      <BotonVolver href="/fincas" />
      <Encabezado
        eyebrow="Importar"
        titulo="Importar Excel de la finca"
        descripcion="Sube el libro de planillas quincenales: se crean las vacas que falten y se cargan partos, servicios, palpaciones, secados y ordeños sin duplicar."
      />

      {!gestor ? (
        <Tarjeta>
          <Vacio>Solo propietarios y administradores pueden importar planillas.</Vacio>
        </Tarjeta>
      ) : fincas.length === 0 ? (
        <Tarjeta>
          <Vacio>
            Primero{" "}
            <Link href="/fincas/nueva" className="font-bold text-bosque underline">
              registra una finca
            </Link>
            .
          </Vacio>
        </Tarjeta>
      ) : (
        <ImportadorExcel key={fincaInicial} fincas={fincas.map((f) => ({ id: f.id, nombre: f.nombre }))} fincaInicial={fincaInicial} />
      )}

      <Tarjeta id="importaciones" className="scroll-mt-6">
        <TituloTarjeta detalle={total ? `${num(total)} en total` : undefined}>Importaciones anteriores</TituloTarjeta>
        {!historial.length ? (
          <Vacio>Todavía no se ha importado ningún archivo.</Vacio>
        ) : (
          <div className="overflow-x-auto">
            <table className="matriz w-full text-left text-sm">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Finca</th>
                  <th>Archivo</th>
                  <th className="text-right">Hojas</th>
                  <th>Cortes</th>
                  <th className="text-right">Vacas nuevas</th>
                  <th className="text-right">Registros nuevos</th>
                  <th className="text-right">Advertencias</th>
                  <th>Por</th>
                </tr>
              </thead>
              <tbody>
                {historial.map((h) => {
                  const r = (h.resumen ?? {}) as Resumen;
                  const conteos = r.conteos ?? {};
                  const registros = Object.entries(conteos)
                    .filter(([t]) => t !== "animales")
                    .reduce((s, [, c]) => s + (c?.creados ?? 0), 0);
                  return (
                    <tr key={h.id}>
                      <td className="whitespace-nowrap">{fechaHora.format(new Date(h.registrado_en))}</td>
                      <td>
                        <Link href={`/fincas/${h.finca_id}`} className="font-bold text-bosque underline">
                          {h.fincas?.nombre ?? "—"}
                        </Link>
                      </td>
                      <td className="max-w-64 truncate" title={h.archivo}>
                        {h.archivo}
                      </td>
                      <td className="text-right">{num(h.hojas)}</td>
                      <td className="whitespace-nowrap">{r.desde ? `${fecha(r.desde)} – ${fecha(r.hasta)}` : "—"}</td>
                      <td className="text-right">{num(conteos.animales?.creados ?? 0)}</td>
                      <td className="text-right">{num(registros)}</td>
                      <td className="text-right">{num(r.advertencias?.length ?? 0)}</td>
                      <td>{(h.registrado_por && nombreDe.get(h.registrado_por)) || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Paginacion
          ruta="/importar"
          searchParams={sp}
          pagina={pagina.pagina}
          tamano={pagina.tamano}
          total={total}
          unidad="importaciones"
          etiqueta="Páginas de importaciones"
          ancla="importaciones"
        />
      </Tarjeta>
    </div>
  );
}

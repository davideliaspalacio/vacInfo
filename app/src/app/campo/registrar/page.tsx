import Link from "next/link";
import { redirect } from "next/navigation";
import clsx from "clsx";
import { Hash, MapPin, NotebookTabs, ScanLine, Search } from "lucide-react";
import { obtenerSesion } from "@/lib/sesion";
import { EscanerQR } from "@/components/campo/escaner-qr";
import { Aviso, OpcionGrande, TarjetaCampo, Titulo, Volver, control, param } from "@/components/campo/ui";

export default async function RegistrarPage({ searchParams }: PageProps<"/campo/registrar">) {
  const sp = await searchParams;
  const { supabase, fincas } = await obtenerSesion();

  const finca = fincas.find((f) => f.id === param(sp.finca)) ?? (fincas.length === 1 ? fincas[0] : undefined);
  const modo = param(sp.modo);
  const q = (param(sp.q) ?? "").replace(/[,()*%"'\\]/g, "").trim();
  const desdeQR = param(sp.desde) === "qr";

  if (!finca) {
    return (
      <>
        <Volver href="/campo" />
        <TarjetaCampo>
          <Titulo kicker="Registrar datos" titulo="¿En qué finca estás?" descripcion="Elige la finca para buscar sus animales y registros." />
          {fincas.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-center text-slate-500">Aún no tienes fincas asignadas.</p>
          ) : (
            <div className="space-y-3">
              {fincas.map((f) => (
                <OpcionGrande key={f.id} href={`/campo/registrar?finca=${f.id}`} icono={MapPin} titulo={f.nombre} detalle={f.municipio ?? undefined} />
              ))}
            </div>
          )}
        </TarjetaCampo>
      </>
    );
  }

  const base = `/campo/registrar?finca=${finca.id}`;

  let resultados: { id: string; codigo: string; chapeta: string | null; nombre: string; categoria: string; estado: string }[] = [];
  if (modo === "codigo" && q) {
    let consulta = supabase
      .from("animales")
      .select("id, codigo, chapeta, nombre, categoria, estado")
      .or(`codigo.ilike.%${q}%,chapeta.eq.${q},nombre.ilike.%${q}%`)
      .order("nombre")
      .limit(30);
    if (!desdeQR) consulta = consulta.eq("finca_id", finca.id);
    const { data } = await consulta;
    resultados = data ?? [];

    const exactos = resultados.filter((a) => a.codigo.toLowerCase() === q.toLowerCase() || a.chapeta === q);
    if (exactos.length === 1) redirect(`/campo/animal/${exactos[0].id}`);
  }

  return (
    <>
      <Volver href="/campo" />
      <Aviso ok={param(sp.ok)} error={param(sp.error)} />
      <TarjetaCampo>
        <Titulo kicker="Registrar datos" titulo="¿Qué vas a registrar?" descripcion="Busca el animal por su chapeta o anota un registro general de la finca." />

        <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
          <span className="flex items-center gap-2 font-bold text-campo-oscuro">
            <MapPin className="h-5 w-5" aria-hidden />
            {finca.nombre}
          </span>
          {fincas.length > 1 && (
            <Link href="/campo/registrar" className="text-sm font-bold text-campo underline underline-offset-4">
              Cambiar finca
            </Link>
          )}
        </div>

        <div className="space-y-3">
          <OpcionGrande href={`${base}&modo=qr`} icono={ScanLine} titulo="Escanear QR" detalle="Usa la cámara con la chapeta" activa={modo === "qr"} />
          <OpcionGrande href={`${base}&modo=codigo`} icono={Hash} titulo="Escribir código o chapeta" detalle="Número de chapeta, código o nombre" activa={modo === "codigo"} />
          <OpcionGrande href={`/campo/finca?finca=${finca.id}`} icono={NotebookTabs} titulo="Registros de la finca" detalle="Carro tanque, mantenimiento, insumos…" />
        </div>
      </TarjetaCampo>

      {modo === "qr" && (
        <TarjetaCampo className="mt-4">
          <EscanerQR finca={finca.id} />
        </TarjetaCampo>
      )}

      {modo === "codigo" && (
        <TarjetaCampo className="mt-4">
          <form action="/campo/registrar" className="flex gap-2">
            <input type="hidden" name="finca" value={finca.id} />
            <input type="hidden" name="modo" value="codigo" />
            <label className="sr-only" htmlFor="buscar-animal">
              Código, chapeta o nombre
            </label>
            <input
              id="buscar-animal"
              name="q"
              defaultValue={q}
              autoFocus={!q}
              inputMode="search"
              autoComplete="off"
              placeholder="Ej: 2079, TON-2079 o Aide"
              className={control}
            />
            <button className="grid min-h-14 w-14 shrink-0 place-items-center rounded-2xl bg-campo text-white" aria-label="Buscar">
              <Search className="h-6 w-6" aria-hidden />
            </button>
          </form>

          {q && (
            <div className="mt-4">
              {resultados.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-center text-slate-500">
                  No encontramos animales con «{q}» en {desdeQR ? "tus fincas" : finca.nombre}.
                </p>
              ) : (
                <ul className="space-y-2">
                  {resultados.map((a) => (
                    <li key={a.id}>
                      <Link
                        href={`/campo/animal/${a.id}`}
                        className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 hover:border-blue-300"
                      >
                        <span>
                          <span className="block text-lg font-bold text-slate-900">{a.nombre}</span>
                          <span className="text-sm capitalize text-slate-500">
                            {a.categoria} · {a.codigo}
                          </span>
                        </span>
                        <span className="flex flex-col items-end gap-1">
                          <span className="rounded-xl bg-blue-50 px-3 py-1 font-bold text-campo-oscuro">#{a.chapeta ?? "—"}</span>
                          {a.estado !== "activo" && (
                            <span className={clsx("text-xs font-bold capitalize text-red-700")}>{a.estado}</span>
                          )}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </TarjetaCampo>
      )}
    </>
  );
}

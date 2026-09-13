import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { ArchiveX, Baby, HeartHandshake, HeartPulse, Milk, MilkOff, Scale, Sprout, Stethoscope, type LucideIcon } from "lucide-react";
import { obtenerSesion } from "@/lib/sesion";
import { corteDeFinca } from "@/lib/datos";
import { fecha, litros, num } from "@/lib/formato";
import { Aviso, TarjetaCampo, Volver, param } from "@/components/campo/ui";
import { FormularioAnimal, type AccionAnimal } from "@/components/campo/formularios-animal";
import { esLevante } from "@/components/levante/etiquetas";

const ACCIONES: {
  clave: AccionAnimal;
  titulo: string;
  detalle: string;
  icono: LucideIcon;
  soloHembras?: boolean;
  /** Solo terneras, terneros, terneronas y novillas sin destetar. */
  soloSinDestetar?: boolean;
}[] = [
  { clave: "ordeno", titulo: "Ordeño", detalle: "Litros AM / PM", icono: Milk, soloHembras: true },
  { clave: "servicio", titulo: "Servicio", detalle: "Inseminación o monta", icono: HeartHandshake, soloHembras: true },
  { clave: "palpacion", titulo: "Palpación", detalle: "Preñada o vacía", icono: Stethoscope, soloHembras: true },
  { clave: "parto", titulo: "Parto / cría", detalle: "Nacimiento y calostro", icono: Baby, soloHembras: true },
  { clave: "secado", titulo: "Secado", detalle: "Dejar de ordeñar", icono: MilkOff, soloHembras: true },
  { clave: "pesaje", titulo: "Pesaje", detalle: "Peso, altura y condición", icono: Scale },
  { clave: "destete", titulo: "Destete", detalle: "Deja de tomar leche", icono: Sprout, soloSinDestetar: true },
  { clave: "salud", titulo: "Salud", detalle: "Vacunas, mastitis, tratamientos", icono: HeartPulse },
  { clave: "baja", titulo: "Muerte / venta / retiro", detalle: "El animal sale de la finca", icono: ArchiveX },
];

const TONOS = {
  azul: "bg-blue-50 text-campo-oscuro border-blue-200",
  verde: "bg-emerald-50 text-emerald-800 border-emerald-200",
  ambar: "bg-amber-50 text-amber-900 border-amber-200",
  rojo: "bg-red-50 text-red-800 border-red-200",
  gris: "bg-slate-100 text-slate-700 border-slate-200",
};

export default async function AnimalPage({ params, searchParams }: PageProps<"/campo/animal/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const { supabase } = await obtenerSesion();

  const { data: animal } = await supabase
    .from("animales")
    .select("id, finca_id, codigo, chapeta, nombre, categoria, sexo, raza, estado, fecha_destete, fincas(nombre)")
    .eq("id", id)
    .maybeSingle();
  if (!animal) notFound();

  const joven = esLevante(animal.categoria);
  const corte = await corteDeFinca(supabase, animal.finca_id);
  const [{ data: estados }, { data: pesaje }] = await Promise.all([
    supabase.rpc("estado_reproductivo", { p_finca: animal.finca_id, p_corte: corte }),
    supabase.from("pesajes").select("fecha, peso_kg").eq("animal_id", animal.id).order("fecha", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const e = estados?.find((fila) => fila.animal_id === animal.id);

  const estado: { texto: string; tono: keyof typeof TONOS }[] = [];
  if (pesaje) estado.push({ texto: `${num(pesaje.peso_kg)} kg el ${fecha(pesaje.fecha)}`, tono: "gris" });
  if (joven && animal.fecha_destete) estado.push({ texto: `Destetada el ${fecha(animal.fecha_destete)}`, tono: "gris" });
  if (e) {
    if (e.en_ordeno) estado.push({ texto: `En ordeño · ${e.dias_ordeno} días`, tono: "azul" });
    else if (e.ultimo_parto) estado.push({ texto: `Horra${e.dias_seca != null ? ` · ${e.dias_seca} días seca` : ""}`, tono: "gris" });
    else estado.push({ texto: "Novilla de vientre", tono: "gris" });
    if (e.prenada) estado.push({ texto: "Preñada", tono: "verde" });
    else if (e.ultimo_servicio) estado.push({ texto: `Servida el ${fecha(e.ultimo_servicio)}`, tono: "gris" });
    if (e.palpar_el) estado.push({ texto: `Palpar el ${fecha(e.palpar_el)}`, tono: "ambar" });
    if (e.secar_el && e.en_ordeno) estado.push({ texto: `Secar el ${fecha(e.secar_el)}`, tono: "ambar" });
    if (e.parto_esperado) estado.push({ texto: `Parto esperado ${fecha(e.parto_esperado)}`, tono: "verde" });
    if (e.mora_prenez > 0 && !e.ultimo_servicio) estado.push({ texto: `${e.mora_prenez} días de mora`, tono: "rojo" });
    if (e.litros_total > 0) estado.push({ texto: `Último ordeño ${litros(e.litros_total)}`, tono: "azul" });
  }

  const volver = `/campo/animal/${animal.id}`;
  const activo = animal.estado === "activo";
  const acciones = ACCIONES.filter(
    (a) => (!a.soloHembras || animal.sexo === "hembra") && (!a.soloSinDestetar || (joven && !animal.fecha_destete)),
  );
  const accion = acciones.find((a) => a.clave === param(sp.accion));

  return (
    <>
      <Volver href={`/campo/registrar?finca=${animal.finca_id}&modo=codigo`}>Buscar otro animal</Volver>
      <Aviso ok={param(sp.ok)} error={param(sp.error)} />

      <TarjetaCampo className="mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.15em] text-campo">{animal.fincas?.nombre}</p>
            <h1 className="font-display truncate text-3xl font-bold text-slate-900">{animal.nombre}</h1>
            <p className="mt-1 capitalize text-slate-500">
              {[animal.categoria, animal.raza, animal.codigo].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="shrink-0 rounded-2xl bg-campo px-4 py-2 text-center text-white">
            <span className="block text-[0.65rem] font-bold uppercase tracking-wider text-blue-100">Chapeta</span>
            <span className="text-2xl font-bold">{animal.chapeta ?? "—"}</span>
          </div>
        </div>

        {estado.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2">
            {estado.map((s) => (
              <li key={s.texto} className={clsx("rounded-full border px-3 py-1 text-sm font-bold", TONOS[s.tono])}>
                {s.texto}
              </li>
            ))}
          </ul>
        )}
        {e && <p className="mt-3 text-xs text-slate-400">Estado calculado al {fecha(corte)}</p>}
      </TarjetaCampo>

      {!activo ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 p-4 font-semibold capitalize text-red-800">
          Este animal figura como {animal.estado}. Ya no se le registran eventos.
        </p>
      ) : accion ? (
        <FormularioAnimal accion={accion.clave} animalId={animal.id} volver={volver} tipoSalud={param(sp.tipo)} nombreAnimal={animal.nombre} />
      ) : (
        <TarjetaCampo>
          <h2 className="font-display mb-4 text-xl font-bold text-slate-900">¿Qué le vas a registrar?</h2>
          <div className="grid grid-cols-2 gap-3">
            {acciones.map(({ clave, titulo, detalle, icono: Icono }) => (
              <Link
                key={clave}
                href={`${volver}?accion=${clave}`}
                className={clsx(
                  "flex min-h-[124px] flex-col justify-between rounded-2xl border p-4 text-left transition hover:-translate-y-0.5",
                  clave === "baja" ? "border-red-200 bg-red-50/60 text-red-900" : "border-slate-200 bg-white text-slate-800 hover:border-blue-300",
                )}
              >
                <Icono className={clsx("h-6 w-6", clave === "baja" ? "text-red-700" : "text-campo")} aria-hidden />
                <span>
                  <span className="block font-bold leading-tight">{titulo}</span>
                  <span className="mt-1 block text-xs opacity-70">{detalle}</span>
                </span>
              </Link>
            ))}
          </div>
        </TarjetaCampo>
      )}
    </>
  );
}

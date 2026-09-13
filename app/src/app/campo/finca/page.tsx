import { redirect } from "next/navigation";
import { Droplets, Fence, Package, SprayCan, Truck, Users, Wheat, Wrench, type LucideIcon } from "lucide-react";
import { obtenerSesion } from "@/lib/sesion";
import { corteDeFinca } from "@/lib/datos";
import { Aviso, BotonRegistro, TarjetaCampo, Titulo, Volver, param } from "@/components/campo/ui";
import { FormularioFinca, type RegistroFinca } from "@/components/campo/formularios-finca";
import { gruposDeFinca } from "@/components/potreros/rotacion";

const REGISTROS: { clave: RegistroFinca; titulo: string; detalle: string; icono: LucideIcon }[] = [
  { clave: "carro", titulo: "Carro tanque", detalle: "Leche recogida", icono: Truck },
  { clave: "mantenimiento", titulo: "Mantenimiento", detalle: "Equipos, tanque, cercas", icono: Wrench },
  { clave: "aplicacion", titulo: "Fumigación y abonos", detalle: "Potreros y venenos", icono: SprayCan },
  { clave: "rotacion", titulo: "Rotación de potrero", detalle: "Mover o sacar un grupo", icono: Fence },
  { clave: "calidad", titulo: "Agua y tanque", detalle: "pH, cloro, temperatura", icono: Droplets },
  { clave: "insumos", titulo: "Insumos", detalle: "Ingresos y salidas", icono: Package },
  { clave: "consumo", titulo: "Consumo del día", detalle: "Concentrado y sal", icono: Wheat },
  { clave: "visitas", titulo: "Visitantes", detalle: "Quién entró a la finca", icono: Users },
];

export default async function FincaPage({ searchParams }: PageProps<"/campo/finca">) {
  const sp = await searchParams;
  const { supabase, fincas } = await obtenerSesion();

  const finca = fincas.find((f) => f.id === param(sp.finca));
  if (!finca) redirect("/campo/registrar");

  const registro = REGISTROS.find((r) => r.clave === param(sp.registro));
  const volver = `/campo/finca?finca=${finca.id}`;

  const conPotreros = registro?.clave === "rotacion" || registro?.clave === "aplicacion";
  const [bienes, insumos, potreros, grupos, reglas] = await Promise.all([
    registro?.clave === "mantenimiento"
      ? supabase.from("bienes").select("id, nombre, codigo").eq("finca_id", finca.id).order("nombre").then((r) => r.data ?? [])
      : [],
    registro?.clave === "insumos"
      ? supabase.from("insumos").select("nombre, unidad").order("nombre").then((r) => r.data ?? [])
      : [],
    conPotreros
      ? corteDeFinca(supabase, finca.id).then((corte) => supabase.rpc("estado_potreros", { p_finca: finca.id, p_corte: corte }).then((r) => r.data ?? []))
      : [],
    registro?.clave === "rotacion" ? gruposDeFinca(supabase, finca.id) : [],
    registro?.clave === "rotacion"
      ? supabase.from("fincas").select("dias_descanso_objetivo").eq("id", finca.id).single().then((r) => r.data)
      : null,
  ]);

  return (
    <>
      <Volver href={registro ? volver : `/campo/registrar?finca=${finca.id}`}>{registro ? "Registros de la finca" : "Volver"}</Volver>
      <Aviso ok={param(sp.ok)} error={param(sp.error)} />

      {registro ? (
        <FormularioFinca
          registro={registro.clave}
          fincaId={finca.id}
          volver={volver}
          tipoCalidad={param(sp.tipo)}
          bienes={bienes}
          insumos={insumos}
          potreros={potreros}
          grupos={grupos}
          objetivoDescanso={reglas?.dias_descanso_objetivo}
        />
      ) : (
        <TarjetaCampo>
          <Titulo kicker={finca.nombre} titulo="Registros de la finca" descripcion="Lo que antes se anotaba en el cuadro administrativo." />
          <div className="grid grid-cols-2 gap-3">
            {REGISTROS.map((r) => (
              <BotonRegistro key={r.clave} href={`${volver}&registro=${r.clave}`} icono={r.icono} titulo={r.titulo} detalle={r.detalle} />
            ))}
          </div>
        </TarjetaCampo>
      )}
    </>
  );
}

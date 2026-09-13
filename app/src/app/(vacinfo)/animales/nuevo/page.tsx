import { obtenerSesion } from "@/lib/sesion";
import { BotonVolver, Encabezado, Tarjeta, Vacio } from "@/components/ui";
import { FormularioAnimal } from "@/components/fincas/formulario-animal";
import { fincasConCodigos } from "@/components/fincas/consultas";
import { guardarAnimal } from "../actions";

export default async function NuevoAnimal({ searchParams }: PageProps<"/animales/nuevo">) {
  const { finca } = await searchParams;
  const sesion = await obtenerSesion();
  const fincaInicial = typeof finca === "string" && sesion.fincas.some((f) => f.id === finca) ? finca : undefined;

  const [fincas, { data: hembras }] = await Promise.all([
    fincasConCodigos(sesion),
    sesion.supabase.from("animales").select("id, nombre, chapeta, finca_id").eq("sexo", "hembra").eq("estado", "activo").order("nombre"),
  ]);
  const volver = fincaInicial ? `/fincas/${fincaInicial}` : "/fincas";

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <BotonVolver href={volver} />
      <Encabezado eyebrow="Hoja informativa ser vivo" titulo="Nueva ficha de ser vivo" descripcion="Registra un animal para identificarlo con su chapeta y QR." />
      <Tarjeta>
        {fincas.length === 0 ? (
          <Vacio>Primero crea una finca.</Vacio>
        ) : (
          <FormularioAnimal accion={guardarAnimal.bind(null, null)} fincas={fincas} hembras={hembras ?? []} fincaInicial={fincaInicial} cancelar={volver} />
        )}
      </Tarjeta>
    </div>
  );
}

import { redirect } from "next/navigation";
import { soloLectura } from "@/lib/permisos";
import { obtenerSesion, ROLES_GESTORES } from "@/lib/sesion";
import { Encabezado, Tarjeta, Vacio } from "@/components/ui";
import { FormularioAnimal } from "@/components/fincas/formulario-animal";
import { candidatosParientes, fincasConCodigos, torosDeServicios } from "@/components/fincas/consultas";
import { guardarAnimal } from "../actions";

export default async function NuevoAnimal({ searchParams }: PageProps<"/animales/nuevo">) {
  const { finca } = await searchParams;
  const sesion = await obtenerSesion();
  const fincaInicial = typeof finca === "string" && sesion.fincas.some((f) => f.id === finca) ? finca : undefined;
  const volver = fincaInicial ? `/fincas/${fincaInicial}` : "/fincas";
  if (soloLectura(sesion.rol)) redirect(volver);

  const [fincas, candidatos, torosServicios] = await Promise.all([fincasConCodigos(sesion), candidatosParientes(sesion), torosDeServicios(sesion)]);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <Encabezado eyebrow="Hoja informativa animal" titulo="Ingreso nuevo animal" descripcion="Registra un animal para identificarlo con su chapeta y QR." />
      <Tarjeta>
        {fincas.length === 0 ? (
          <Vacio>Primero crea una finca.</Vacio>
        ) : (
          <FormularioAnimal
            accion={guardarAnimal.bind(null, null)}
            fincas={fincas}
            candidatos={candidatos}
            torosServicios={torosServicios}
            fincaInicial={fincaInicial}
            cancelar={volver}
            organizacionId={sesion.organizacionId}
            puedeFoto={ROLES_GESTORES.includes(sesion.rol)}
          />
        )}
      </Tarjeta>
    </div>
  );
}

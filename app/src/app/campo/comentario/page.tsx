import { obtenerSesion } from "@/lib/sesion";
import { enviarComentario } from "@/app/campo/actions";
import { BotonGuardar } from "@/components/campo/boton-guardar";
import { Aviso, Campo, Opciones, TarjetaCampo, Titulo, Volver, control, param } from "@/components/campo/ui";

export default async function ComentarioPage({ searchParams }: PageProps<"/campo/comentario">) {
  const sp = await searchParams;
  const { fincas } = await obtenerSesion();

  return (
    <>
      <Volver href="/campo" />
      <Aviso ok={param(sp.ok)} error={param(sp.error)} />
      <TarjetaCampo>
        <Titulo
          kicker="Comentario"
          titulo="Cuéntale al administrador"
          descripcion="Un daño, algo que falta, un animal que no se ve bien. Llega a los mensajes de VacInfo."
        />
        <form action={enviarComentario} className="space-y-4">
          <input type="hidden" name="volver" value="/campo/comentario" />
          {fincas.length > 0 && (
            <Campo etiqueta="Finca (opcional)">
              <select name="finca_id" defaultValue={fincas.length === 1 ? fincas[0].id : ""} className={control}>
                <option value="">Sin finca específica</option>
                {fincas.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nombre}
                  </option>
                ))}
              </select>
            </Campo>
          )}
          <Campo etiqueta="Mensaje">
            <textarea name="mensaje" rows={5} required placeholder="Escribe aquí tu comentario…" className={`${control} resize-none`} />
          </Campo>
          <Opciones
            etiqueta="Urgencia"
            name="urgencia"
            columnas={3}
            defecto="media"
            requerido
            opciones={[
              { valor: "baja", etiqueta: "Baja" },
              { valor: "media", etiqueta: "Media" },
              { valor: "alta", etiqueta: "Alta" },
            ]}
          />
          <div className="pt-2">
            <BotonGuardar>Enviar comentario</BotonGuardar>
          </div>
        </form>
      </TarjetaCampo>
    </>
  );
}

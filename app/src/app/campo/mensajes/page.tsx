import type { Metadata } from "next";
import { obtenerSesion } from "@/lib/sesion";
import { TarjetaCampo, Titulo, Volver } from "@/components/campo/ui";
import { ListaMensajes } from "@/components/offline/mensajes";

export const metadata: Metadata = { title: { absolute: "Mensajes · VacDaTa" } };

export default async function MensajesPage() {
  const { user } = await obtenerSesion();

  return (
    <>
      <Volver href="/campo" />
      <TarjetaCampo>
        <Titulo kicker="Mensajes" titulo="Mensajes del administrador" descripcion="Lo que te escriben desde VacInfo. Quedan guardados en el teléfono para leerlos sin señal." />
        <ListaMensajes usuarioId={user.id} />
      </TarjetaCampo>
    </>
  );
}

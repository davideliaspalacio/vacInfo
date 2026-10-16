import type { Metadata } from "next";
import { obtenerSesion } from "@/lib/sesion";
import { Atras, TarjetaCampo, Titulo } from "@/components/campo/ui";
import { ListaMensajes } from "@/components/offline/mensajes";

export const metadata: Metadata = { title: { absolute: "Mensajes recibidos · VacDaTa" } };

export default async function MensajesPage() {
  const { user } = await obtenerSesion();

  return (
    <>
      <Atras href="/campo" />
      <TarjetaCampo>
        <Titulo titulo="Mensajes recibidos" descripcion="Lo que te escriben desde VacInfo. Quedan guardados en el teléfono para leerlos sin señal." />
        <ListaMensajes usuarioId={user.id} />
      </TarjetaCampo>
    </>
  );
}

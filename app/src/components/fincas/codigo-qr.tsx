import QRCode from "qrcode";
import { BotonImprimir } from "@/components/fincas/boton-imprimir";

export async function CodigoQR({ codigo, nombre, detalle }: { codigo: string; nombre: string; detalle?: string }) {
  const svg = await QRCode.toString(codigo, { type: "svg", margin: 1, color: { dark: "#0d291c", light: "#ffffff" } });

  return (
    <div className="flex flex-col items-center gap-3">
      <div id="chapeta-imprimible" className="w-full max-w-[220px] rounded-2xl border-2 border-tinta bg-white p-3 text-center">
        <div className="aspect-square w-full [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="font-display mt-2 text-lg font-bold leading-tight text-bosque">{nombre}</p>
        <p className="font-mono text-sm font-bold tracking-wider">{codigo}</p>
        {detalle && <p className="text-xs text-tinta-suave">{detalle}</p>}
      </div>
      <BotonImprimir />
    </div>
  );
}

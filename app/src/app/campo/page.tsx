import Link from "next/link";
import clsx from "clsx";
import { ArrowRight, BookOpenCheck, ClipboardPenLine, Mail, MessageSquare, type LucideIcon } from "lucide-react";
import { obtenerSesion } from "@/lib/sesion";
import { ContadorMensajes } from "@/components/offline/mensajes";

const MENU: { href: string; titulo: string; detalle: string; icono: LucideIcon; principal?: boolean; mensajes?: boolean }[] = [
  {
    href: "/campo/registrar",
    titulo: "Registrar",
    detalle: "Funciona con o sin señal. Animales, ordeño por lista y registros de la finca",
    icono: ClipboardPenLine,
    principal: true,
  },
  { href: "/campo/mensajes", titulo: "Mensajes", detalle: "Lo que te escribe el administrador", icono: Mail, mensajes: true },
  { href: "/campo/aprendizaje", titulo: "Aprendizaje", detalle: "Manual del trabajador y flujograma reproductivo", icono: BookOpenCheck },
  { href: "/campo/comentario", titulo: "Comentario", detalle: "Avísale algo al administrador", icono: MessageSquare },
];

function saludo() {
  const hora = new Date().getHours();
  return hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches";
}

export default async function CampoInicio() {
  const { nombre, organizacion, user } = await obtenerSesion();
  const primerNombre = nombre.split(" ")[0];

  return (
    <>
      <section className="mb-4 rounded-3xl bg-gradient-to-br from-campo to-campo-oscuro p-6 text-white shadow-[0_16px_42px_rgba(37,99,235,0.28)]">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-blue-100">{organizacion || "VacDaTa"}</p>
        <h1 className="font-display mb-3 text-3xl font-bold leading-tight">
          {saludo()}, {primerNombre}
        </h1>
        <p className="leading-relaxed text-blue-50">¿Qué vas a registrar hoy? Todo queda guardado en el teléfono y le llega al administrador apenas haya señal.</p>
      </section>

      <nav className="space-y-3" aria-label="Acciones principales">
        {MENU.map(({ href, titulo, detalle, icono: Icono, principal, mensajes }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex w-full items-center justify-between gap-3 rounded-3xl border px-5 py-4 text-left shadow-sm transition hover:-translate-y-0.5",
              principal ? "min-h-[112px] border-campo bg-campo text-white" : "min-h-[88px] border-slate-200 bg-white text-slate-800",
            )}
          >
            <span className="flex items-center gap-4">
              <span
                className={clsx(
                  "flex shrink-0 items-center justify-center rounded-2xl",
                  principal ? "h-14 w-14 bg-white/20" : "h-12 w-12 bg-blue-50 text-campo-oscuro",
                )}
              >
                <Icono className={principal ? "h-7 w-7" : "h-[23px] w-[23px]"} aria-hidden />
              </span>
              <span>
                <span className={clsx("block font-bold", principal ? "text-2xl" : "text-lg")}>
                  {titulo}
                  {mensajes && <ContadorMensajes usuarioId={user.id} />}
                </span>
                <span className={clsx("mt-1 block text-sm", principal ? "text-blue-50" : "text-slate-500")}>{detalle}</span>
              </span>
            </span>
            <ArrowRight className="h-[21px] w-[21px] shrink-0" aria-hidden />
          </Link>
        ))}
      </nav>

      <p className="px-1 pt-5 text-center text-xs text-slate-500">Cada registro guarda la fecha y quién lo hizo.</p>
    </>
  );
}

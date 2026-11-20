"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, LoaderCircle, Trash2 } from "lucide-react";
import { eliminarAnimal } from "@/app/(vacinfo)/animales/actions";
import { num } from "@/lib/formato";

export type RegistroAsociado = { etiqueta: string; cantidad: number };

/**
 * Borrar el perfil de un animal: solo propietario y administrador (la página solo pinta esto para
 * ellos y la acción del servidor lo vuelve a comprobar).
 *
 * El botón queda aparte del resto de la ficha y pide una segunda confirmación que dice con nombre y
 * código qué se va a borrar, cuántos registros se van con él y qué pasa con sus crías. El borrado es
 * definitivo: no hay papelera ni forma de deshacerlo.
 */
export function EliminarPerfil({
  id,
  nombre,
  codigo,
  registros,
  crias,
}: {
  id: string;
  nombre: string;
  codigo: string;
  /** Registros que cuelgan del animal y se borran con él (solo los que tienen alguno). */
  registros: RegistroAsociado[];
  /** Crías registradas: no se borran, solo pierden el enlace con su madre. */
  crias: number;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const total = registros.reduce((s, r) => s + r.cantidad, 0);

  const eliminar = () =>
    iniciar(async () => {
      setError(null);
      // Si todo va bien la acción redirige a la finca y esta promesa no vuelve.
      const r = await eliminarAnimal(id);
      if (r?.error) setError(r.error);
    });

  return (
    <section className="rounded-3xl border border-alerta/30 bg-[#fdf3f1] p-6">
      <h2 className="font-display text-xl font-bold text-alerta">Eliminar el perfil</h2>
      <p className="mt-2 text-sm text-tinta">
        Borra del todo la ficha de <strong>{nombre}</strong> y todo lo que tiene registrado. Es definitivo:{" "}
        <strong>no se puede deshacer</strong>. Si el animal se murió, se vendió o salió de la finca, lo correcto es registrarle una baja: así se
        conserva su historia y sigue contando en los informes de los meses en que estuvo.
      </p>

      {!confirmando ? (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setConfirmando(true);
          }}
          className="boton-accion mt-4 inline-flex items-center gap-2 rounded-xl border-2 border-alerta px-5 py-3 font-bold text-alerta hover:bg-alerta hover:text-leche"
        >
          <Trash2 className="h-5 w-5" aria-hidden />
          Eliminar el perfil de {nombre}
        </button>
      ) : (
        <div role="alertdialog" aria-label={`Confirmar la eliminación de ${nombre}`} className="mt-4 rounded-2xl border border-alerta/40 bg-white p-5">
          <p className="flex items-start gap-2 font-bold text-alerta">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <span>
              ¿Eliminar definitivamente el perfil de {nombre} ({codigo})?
            </span>
          </p>
          <p className="mt-3 text-sm text-tinta">Se borrará la ficha del animal, su foto y su código QR deja de servir.</p>

          {total > 0 ? (
            <>
              <p className="mt-3 text-sm font-bold text-tinta">
                Se borran también sus {num(total)} {total === 1 ? "registro" : "registros"}:
              </p>
              <ul className="mt-1 list-disc pl-5 text-sm text-tinta">
                {registros.map((r) => (
                  <li key={r.etiqueta}>
                    {num(r.cantidad)} {r.etiqueta}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm text-tinta-suave">
                Sus ordeños salen de los litros del día y de los informes, también de los días ya pasados.
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm text-tinta-suave">Este animal no tiene ordeños, partos, servicios ni otros registros asociados.</p>
          )}

          {crias > 0 && (
            <p className="mt-3 text-sm text-tinta">
              Sus {num(crias)} {crias === 1 ? "cría" : "crías"} no se borran: siguen en la finca, pero quedan <strong>sin madre enlazada</strong>.
            </p>
          )}

          {error && (
            <p role="alert" className="mt-3 rounded-xl border border-alerta/30 bg-[#fbe9e5] px-3 py-2 text-sm font-bold text-alerta">
              {error}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={eliminar}
              disabled={pendiente}
              className="boton-accion inline-flex items-center gap-2 rounded-xl bg-alerta px-5 py-3 font-bold text-leche disabled:opacity-60"
            >
              {pendiente ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden /> : <Trash2 className="h-5 w-5" aria-hidden />}
              {pendiente ? "Eliminando…" : "Sí, eliminar para siempre"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              disabled={pendiente}
              className="inline-flex items-center rounded-xl border border-bosque/20 px-5 py-3 font-bold text-bosque hover:bg-lima-suave"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

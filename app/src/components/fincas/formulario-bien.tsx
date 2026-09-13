"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { Database } from "@/lib/database.types";
import { BotonPrimario } from "@/components/ui";
import { Campo, MensajeError, type EstadoFormulario } from "@/components/fincas/campo";
import { ESTADOS_BIEN, TIPOS_BIEN } from "@/components/fincas/etiquetas";
import type { FincaConCodigos } from "@/components/fincas/consultas";

type Bien = Database["public"]["Tables"]["bienes"]["Row"];

const METODOS = ["Comprado", "Producido", "Comodato", "Donado", "Otro"];

export function FormularioBien({
  accion,
  fincas,
  bien,
  fincaInicial,
  cancelar,
}: {
  accion: (estado: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;
  fincas: FincaConCodigos[];
  bien?: Bien;
  fincaInicial?: string;
  cancelar: string;
}) {
  const [estado, enviar, pendiente] = useActionState(accion, {});
  const e = estado.errores ?? {};
  const [fincaId, setFincaId] = useState(bien?.finca_id ?? fincaInicial ?? fincas[0]?.id ?? "");
  const [codigo, setCodigo] = useState<string | null>(bien?.codigo ?? null);
  const sugerido = fincas.find((f) => f.id === fincaId)?.siguienteBien ?? "";
  const v = (x: string | null | undefined) => x ?? "";

  return (
    <form action={enviar} className="space-y-8">
      <MensajeError>{estado.mensaje}</MensajeError>

      <fieldset>
        <legend className="font-display mb-4 text-xl font-bold text-bosque">Datos generales</legend>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Campo etiqueta="Pertenece a finca *" error={e.finca_id}>
            <select name="finca_id" value={fincaId} onChange={(ev) => setFincaId(ev.target.value)} className="campo-control" required>
              {fincas.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nombre}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Código *" error={e.codigo} ayuda="Se imprime en el QR del bien">
            <input
              name="codigo"
              required
              value={codigo ?? sugerido}
              onChange={(ev) => setCodigo(ev.target.value)}
              className="campo-control font-mono"
            />
          </Campo>
          <Campo etiqueta="Nombre *" error={e.nombre}>
            <input name="nombre" required defaultValue={v(bien?.nombre)} className="campo-control" placeholder="Tanque de enfriamiento" />
          </Campo>
          <Campo etiqueta="Tipo de bien o servicio" error={e.tipo}>
            <select name="tipo" defaultValue={bien?.tipo ?? "equipo"} className="campo-control">
              {Object.entries(TIPOS_BIEN).map(([valor, texto]) => (
                <option key={valor} value={valor}>
                  {texto}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Marca" error={e.marca}>
            <input name="marca" defaultValue={v(bien?.marca)} className="campo-control" />
          </Campo>
          <Campo etiqueta="Estado" error={e.estado}>
            <select name="estado" defaultValue={bien?.estado ?? "bueno"} className="campo-control">
              {Object.entries(ESTADOS_BIEN).map(([valor, { texto }]) => (
                <option key={valor} value={valor}>
                  {texto}
                </option>
              ))}
            </select>
          </Campo>
        </div>
      </fieldset>

      <fieldset>
        <legend className="font-display mb-4 text-xl font-bold text-bosque">Adquisición</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo etiqueta="Método de adquisición" error={e.metodo_adquisicion}>
            <input name="metodo_adquisicion" list="metodos-bien" defaultValue={v(bien?.metodo_adquisicion)} className="campo-control" placeholder="Comprado a…" />
            <datalist id="metodos-bien">
              {METODOS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </Campo>
          <Campo etiqueta="Fecha de adquisición" error={e.fecha_adquisicion}>
            <input type="date" name="fecha_adquisicion" defaultValue={v(bien?.fecha_adquisicion)} className="campo-control" />
          </Campo>
          <Campo etiqueta="Garantía hasta" error={e.garantia_hasta}>
            <input type="date" name="garantia_hasta" defaultValue={v(bien?.garantia_hasta)} className="campo-control" />
          </Campo>
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Descripción" error={e.descripcion}>
          <textarea name="descripcion" rows={3} defaultValue={v(bien?.descripcion)} className="campo-control" />
        </Campo>
        <Campo etiqueta="Recordatorio" error={e.recordatorio} ayuda="Instrucción de uso o cuidado que verá el equipo">
          <textarea name="recordatorio" rows={3} defaultValue={v(bien?.recordatorio)} className="campo-control" />
        </Campo>
      </div>

      <div className="flex flex-wrap gap-3">
        <BotonPrimario disabled={pendiente}>{pendiente ? "Guardando…" : "Guardar ficha"}</BotonPrimario>
        <Link href={cancelar} className="inline-flex items-center rounded-xl border border-bosque/20 px-5 py-3 font-bold text-bosque hover:bg-lima-suave">
          Cancelar
        </Link>
      </div>
    </form>
  );
}

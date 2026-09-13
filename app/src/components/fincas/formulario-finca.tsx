"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { Database } from "@/lib/database.types";
import { BotonPrimario } from "@/components/ui";
import { Campo, MensajeError, type EstadoFormulario } from "@/components/fincas/campo";

type Finca = Partial<Database["public"]["Tables"]["fincas"]["Row"]>;

export function FormularioFinca({
  accion,
  finca = {},
  cancelar,
}: {
  accion: (estado: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;
  finca?: Finca;
  cancelar: string;
}) {
  const [estado, enviar, pendiente] = useActionState(accion, {});
  const e = estado.errores ?? {};
  const texto = (nombre: keyof Finca) => (finca[nombre] == null ? "" : String(finca[nombre]));

  return (
    <form action={enviar} className="space-y-8">
      <MensajeError>{estado.mensaje}</MensajeError>

      <fieldset className="space-y-4">
        <legend className="font-display mb-3 text-xl font-bold text-bosque">Datos generales</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Nombre *" error={e.nombre} className="sm:col-span-2">
            <input name="nombre" required defaultValue={texto("nombre")} className="campo-control" placeholder="Finca Toneles" />
          </Campo>
          <Campo etiqueta="Departamento" error={e.departamento}>
            <input name="departamento" defaultValue={texto("departamento")} className="campo-control" placeholder="Antioquia" />
          </Campo>
          <Campo etiqueta="Municipio" error={e.municipio}>
            <input name="municipio" defaultValue={texto("municipio")} className="campo-control" />
          </Campo>
          <Campo etiqueta="Vereda" error={e.vereda}>
            <input name="vereda" defaultValue={texto("vereda")} className="campo-control" />
          </Campo>
          <Campo etiqueta="Dirección" error={e.direccion}>
            <input name="direccion" defaultValue={texto("direccion")} className="campo-control" />
          </Campo>
          <Campo etiqueta="Área (cuadras)" error={e.area_cuadras}>
            <input name="area_cuadras" inputMode="decimal" defaultValue={texto("area_cuadras")} className="campo-control" />
          </Campo>
          <Campo etiqueta="Tenencia" error={e.tenencia}>
            <select name="tenencia" defaultValue={texto("tenencia")} className="campo-control">
              <option value="">Sin definir</option>
              <option value="propia">Propia</option>
              <option value="arrendada">Arrendada</option>
            </select>
          </Campo>
          <Campo etiqueta="Registro ICA" error={e.registro_ica}>
            <input name="registro_ica" defaultValue={texto("registro_ica")} className="campo-control" />
          </Campo>
          <Campo etiqueta="Contrato de energía" error={e.contrato_energia}>
            <input name="contrato_energia" defaultValue={texto("contrato_energia")} className="campo-control" />
          </Campo>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="font-display mb-3 text-xl font-bold text-bosque">Venta de leche</legend>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Campo etiqueta="Empresa compradora" error={e.empresa_compradora}>
            <input name="empresa_compradora" defaultValue={texto("empresa_compradora")} className="campo-control" placeholder="Colanta" />
          </Campo>
          <Campo etiqueta="Código de asociado" error={e.codigo_asociado}>
            <input name="codigo_asociado" defaultValue={texto("codigo_asociado")} className="campo-control" />
          </Campo>
          <Campo etiqueta="Número de tanque" error={e.tanque_numero}>
            <input name="tanque_numero" defaultValue={texto("tanque_numero")} className="campo-control" />
          </Campo>
          <Campo etiqueta="Ruta" error={e.ruta}>
            <input name="ruta" defaultValue={texto("ruta")} className="campo-control" />
          </Campo>
          <Campo etiqueta="Precio por litro (COP)" error={e.precio_litro}>
            <input name="precio_litro" inputMode="decimal" defaultValue={texto("precio_litro")} className="campo-control" />
          </Campo>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="font-display mb-3 text-xl font-bold text-bosque">Levante y potreros</legend>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Campo etiqueta="Días para el destete" error={e.dias_destete} ayuda="Predeterminado: 90">
            <input name="dias_destete" inputMode="numeric" defaultValue={texto("dias_destete")} className="campo-control" placeholder="90" />
          </Campo>
          <Campo etiqueta="Edad para servicio (meses)" error={e.edad_servicio_meses} ayuda="Predeterminado: 15">
            <input name="edad_servicio_meses" inputMode="numeric" defaultValue={texto("edad_servicio_meses")} className="campo-control" placeholder="15" />
          </Campo>
          <Campo etiqueta="Peso para servicio (kg)" error={e.peso_servicio_kg} ayuda="Predeterminado: 340">
            <input name="peso_servicio_kg" inputMode="decimal" defaultValue={texto("peso_servicio_kg")} className="campo-control" placeholder="340" />
          </Campo>
          <Campo etiqueta="Descanso de potreros (días)" error={e.dias_descanso_objetivo} ayuda="Predeterminado: 35">
            <input name="dias_descanso_objetivo" inputMode="numeric" defaultValue={texto("dias_descanso_objetivo")} className="campo-control" placeholder="35" />
          </Campo>
        </div>
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <BotonPrimario disabled={pendiente}>{pendiente ? "Guardando…" : "Guardar finca"}</BotonPrimario>
        <Link href={cancelar} className="inline-flex items-center rounded-xl border border-bosque/20 px-5 py-3 font-bold text-bosque hover:bg-lima-suave">
          Cancelar
        </Link>
      </div>
    </form>
  );
}

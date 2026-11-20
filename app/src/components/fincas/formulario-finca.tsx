"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { CalendarDays, CircleCheck, TriangleAlert } from "lucide-react";
import type { Database } from "@/lib/database.types";
import { BotonPrimario } from "@/components/ui";
import { FotoCampo } from "@/components/foto-campo";
import { Campo, MensajeError, type EstadoFormulario } from "@/components/fincas/campo";
import type { EstadoAccion } from "@/components/fincas/formulario-accion";

type Finca = Partial<Database["public"]["Tables"]["fincas"]["Row"]>;

/** Días que el relleno llena hacia atrás como máximo (el mismo tope del disparador en la base). */
const TOPE_RELLENO = 15;

/**
 * «Relleno de registros de ordeño faltantes»: opción de la finca que se activa solo después de
 * leer la explicación y darle «Aplicar a la finca», porque cambia cómo registra el ordeño todo el
 * equipo en VacDaTa.
 */
export function RellenoOrdenos({
  activo,
  accion,
}: {
  activo: boolean;
  /** `aplicarRellenoOrdenos` ya ligada al id de la finca; el formulario manda `activar`. */
  accion: (estado: EstadoAccion, datos: FormData) => Promise<EstadoAccion>;
}) {
  const [estado, enviar, pendiente] = useActionState(accion, {});
  const [leido, setLeido] = useState(false);

  return (
    <section className="papel rounded-3xl p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="font-display flex items-center gap-2 text-xl font-bold text-bosque">
          <CalendarDays className="h-5 w-5 text-pasto-oscuro" aria-hidden />
          Relleno de registros de ordeño faltantes
        </h2>
        {activo ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-lima px-3 py-1 text-xs font-bold uppercase tracking-wider text-bosque">
            <CircleCheck className="h-4 w-4" aria-hidden />
            Activa en esta finca
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-black/5 px-3 py-1 text-xs font-bold uppercase tracking-wider text-tinta-suave">
            Sin activar
          </span>
        )}
      </div>

      <div className="mt-4 space-y-3 text-sm leading-relaxed text-tinta-suave">
        <p>
          Si no se registran eventos de ordeño por un periodo de tiempo cualquiera, y después de este periodo se genera un registro, todos los días
          faltantes de registro en el periodo van a ser llenados con el mismo dato que se acaba de registrar. Esto permite que, aunque un trabajador
          olvide hacer registros de ordeño por varios días, al hacer uno nuevo los días anteriores se van a rellenar con este dato y por lo tanto va a
          haber una aproximación al ordeño real de dicho periodo.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Se rellena desde el último ordeño registrado de esa vaca hasta el día anterior, con los mismos litros y la misma jornada.</li>
          <li>Un día que ya tiene ordeño registrado nunca se pisa: se conserva el dato que tomó la persona.</li>
          <li>
            Se rellenan máximo {TOPE_RELLENO} días hacia atrás (una quincena). Si el último ordeño de la vaca es más viejo, solo se completa esa
            última quincena.
          </li>
          <li>Los días rellenados quedan marcados como estimados, para poder distinguirlos del dato tomado en el corral.</li>
          <li>Cargar un histórico (importador) no rellena nada: solo rellena el registro del día.</li>
        </ul>
        <p className="rounded-2xl border border-dorado/50 bg-dorado/15 p-3 font-semibold text-bosque">
          <TriangleAlert className="mr-1.5 inline h-4 w-4 align-text-bottom" aria-hidden />
          Posdata: si la opción está activada, afecta a VacDaTa. Al hacer un registro de ordeño no se podrá seleccionar la fecha del registro:
          únicamente se registra sobre el día actual. Si no está activada, se mantiene la opción de elegir la fecha del registro.
        </p>
      </div>

      <form action={enviar} className="mt-5 space-y-3">
        <input type="hidden" name="activar" value={activo ? "no" : "si"} />
        {!activo && (
          <label className="flex items-start gap-3 font-bold text-bosque">
            <input
              type="checkbox"
              name="lei_la_explicacion"
              value="si"
              checked={leido}
              onChange={(e) => setLeido(e.target.checked)}
              className="mt-1 h-5 w-5 shrink-0 accent-pasto-oscuro"
            />
            <span>Leí la explicación y entiendo que en VacDaTa el ordeño se registrará solo sobre el día actual.</span>
          </label>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button
            disabled={pendiente || (!activo && !leido)}
            className={
              activo
                ? "inline-flex items-center justify-center rounded-xl border border-bosque/20 px-4 py-2.5 text-sm font-bold text-bosque hover:bg-lima-suave disabled:opacity-60"
                : "boton-accion inline-flex items-center justify-center rounded-xl bg-bosque px-4 py-2.5 text-sm font-bold text-leche disabled:opacity-60"
            }
          >
            {pendiente ? "Guardando…" : activo ? "Desactivar en esta finca" : "Aplicar a la finca"}
          </button>
          {!pendiente && estado.ok && (
            <span role="status" className="inline-flex items-center gap-1 text-sm font-bold text-pasto-oscuro">
              <CircleCheck className="h-4 w-4" aria-hidden />
              {estado.ok}
            </span>
          )}
          {!pendiente && estado.error && (
            <span role="alert" className="inline-flex items-center gap-1 text-sm font-bold text-alerta">
              <TriangleAlert className="h-4 w-4" aria-hidden />
              {estado.error}
            </span>
          )}
        </div>
      </form>
    </section>
  );
}

export function FormularioFinca({
  accion,
  finca = {},
  cancelar,
  organizacionId,
  fotoUrl,
}: {
  accion: (estado: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;
  finca?: Finca;
  cancelar: string;
  organizacionId: string;
  /** Enlace firmado de la foto guardada (vista previa al editar). */
  fotoUrl?: string | null;
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

      <FotoCampo
        tipo="fincas"
        organizacionId={organizacionId}
        valor={finca.foto_url}
        url={fotoUrl}
        alt={finca.nombre ? `Foto de ${finca.nombre}` : "Vista previa de la foto de la finca"}
        error={e.foto_url}
      />

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
          <Campo
            etiqueta="Días para el destete"
            error={e.dias_destete}
            ayuda="Predeterminado: 90. El sistema genera el destete solo a los días que pongas aquí: nadie tiene que registrarlo."
          >
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

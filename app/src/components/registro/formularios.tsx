"use client";

import { BotonPrimario } from "@/components/ui";
import { Campo, MensajeError, type EstadoFormulario } from "@/components/fincas/campo";
import { crearCuenta, crearEmpresa, crearPrimeraFinca } from "@/app/registro/actions";
import { useAccionFormulario } from "./accion-formulario";

const INICIAL: EstadoFormulario = {};

export function FormularioCuenta() {
  const [estado, alEnviar, pendiente] = useAccionFormulario(crearCuenta, INICIAL);
  const e = estado.errores ?? {};

  return (
    <form onSubmit={alEnviar} className="mt-5 space-y-4" noValidate>
      <MensajeError>{estado.mensaje}</MensajeError>
      <Campo etiqueta="Nombre completo" error={e.nombre}>
        <input name="nombre" autoComplete="name" required className="campo-control" placeholder="Gustavo Restrepo" />
      </Campo>
      <Campo etiqueta="Correo" error={e.correo}>
        <input name="correo" type="email" autoComplete="email" required className="campo-control" placeholder="tu@empresa.com" />
      </Campo>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Contraseña" error={e.password} ayuda="Mínimo 8 caracteres">
          <input name="password" type="password" autoComplete="new-password" required minLength={8} className="campo-control" />
        </Campo>
        <Campo etiqueta="Repite la contraseña" error={e.confirmar}>
          <input name="confirmar" type="password" autoComplete="new-password" required className="campo-control" />
        </Campo>
      </div>
      <BotonPrimario disabled={pendiente} className="w-full">
        {pendiente ? "Creando tu cuenta…" : "Crear cuenta y continuar"}
      </BotonPrimario>
    </form>
  );
}

export function FormularioEmpresa() {
  const [estado, alEnviar, pendiente] = useAccionFormulario(crearEmpresa, INICIAL);
  const e = estado.errores ?? {};

  return (
    <form onSubmit={alEnviar} className="mt-5 space-y-4" noValidate>
      <MensajeError>{estado.mensaje}</MensajeError>
      <Campo etiqueta="Nombre de la empresa" error={e.nombre} ayuda="Puede ser tu nombre si trabajas como persona natural">
        <input name="nombre" required autoComplete="organization" className="campo-control" placeholder="Lácteos La Esperanza S.A.S." />
      </Campo>
      <Campo etiqueta="NIT (opcional)" error={e.nit}>
        <input name="nit" inputMode="numeric" className="campo-control" placeholder="900123456-7" />
      </Campo>
      <BotonPrimario disabled={pendiente} className="w-full">
        {pendiente ? "Creando la empresa…" : "Continuar"}
      </BotonPrimario>
    </form>
  );
}

export function FormularioPrimeraFinca() {
  const [estado, alEnviar, pendiente] = useAccionFormulario(crearPrimeraFinca, INICIAL);
  const e = estado.errores ?? {};

  return (
    <form onSubmit={alEnviar} className="mt-5 space-y-6" noValidate>
      <MensajeError>{estado.mensaje}</MensajeError>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Nombre de la finca *" error={e.nombre} className="sm:col-span-2">
          <input name="nombre" required className="campo-control" placeholder="Finca Toneles" />
        </Campo>
        <Campo etiqueta="Departamento" error={e.departamento}>
          <input name="departamento" className="campo-control" placeholder="Antioquia" />
        </Campo>
        <Campo etiqueta="Municipio" error={e.municipio}>
          <input name="municipio" className="campo-control" placeholder="San Pedro de los Milagros" />
        </Campo>
        <Campo etiqueta="Vereda" error={e.vereda}>
          <input name="vereda" className="campo-control" />
        </Campo>
        <Campo etiqueta="Área (cuadras)" error={e.area_cuadras}>
          <input name="area_cuadras" inputMode="decimal" className="campo-control" placeholder="40" />
        </Campo>
        <Campo etiqueta="Tenencia" error={e.tenencia}>
          <select name="tenencia" defaultValue="" className="campo-control">
            <option value="">Sin definir</option>
            <option value="propia">Propia</option>
            <option value="arrendada">Arrendada</option>
          </select>
        </Campo>
        <Campo etiqueta="Número de potreros" error={e.potreros} ayuda="Los creamos numerados del 1 en adelante">
          <input name="potreros" inputMode="numeric" className="campo-control" placeholder="24" />
        </Campo>
        <Campo etiqueta="Empresa compradora de leche" error={e.empresa_compradora}>
          <input name="empresa_compradora" className="campo-control" placeholder="Colanta" />
        </Campo>
        <Campo etiqueta="Precio por litro (COP)" error={e.precio_litro}>
          <input name="precio_litro" inputMode="decimal" className="campo-control" placeholder="2100" />
        </Campo>
      </div>
      <p className="text-sm text-tinta-suave">Después podrás completar registro ICA, tanque, ruta y demás datos desde la hoja de la finca.</p>
      <BotonPrimario disabled={pendiente} className="w-full">
        {pendiente ? "Creando la finca…" : "Crear finca"}
      </BotonPrimario>
    </form>
  );
}

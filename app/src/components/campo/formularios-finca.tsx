import {
  registrarAplicacion,
  registrarConsumo,
  registrarControl,
  registrarMantenimiento,
  registrarMovimientoInsumo,
  registrarRecoleccion,
  registrarRotacion,
  registrarVisita,
} from "@/app/campo/actions";
import { fecha as fechaCorta } from "@/lib/formato";
import { avisoPotrero, ESTADOS_POTRERO, nombrePotrero, type EstadoPotrero } from "@/components/potreros/rotacion";
import { Formulario } from "./formulario";
import { Campo, CampoFecha, Casilla, Chips, JORNADAS, Opciones, control } from "./ui";

export type RegistroFinca = "carro" | "mantenimiento" | "aplicacion" | "rotacion" | "calidad" | "insumos" | "consumo" | "visitas";

function detallePotrero(p: EstadoPotrero, objetivo: number) {
  const estado = ESTADOS_POTRERO[p.estado]?.texto ?? p.estado;
  if (p.estado === "ocupado") return `${estado}: ${p.grupo}`;
  if (p.estado === "bloqueado") return `${estado} hasta ${fechaCorta(p.retiro_hasta)}`;
  if (p.estado === "descansando" || p.estado === "listo") return `${estado} ${p.dias_descanso}/${objetivo} días`;
  return estado;
}

function Texto({
  etiqueta,
  name,
  placeholder,
  requerido,
  tipo = "text",
}: {
  etiqueta: string;
  name: string;
  placeholder?: string;
  requerido?: boolean;
  tipo?: "text" | "tel" | "time";
}) {
  return (
    <Campo etiqueta={etiqueta}>
      <input type={tipo} name={name} placeholder={placeholder} required={requerido} className={control} />
    </Campo>
  );
}

function Numero({ etiqueta, name, requerido, decimal = true, ayuda }: { etiqueta: string; name: string; requerido?: boolean; decimal?: boolean; ayuda?: string }) {
  return (
    <Campo etiqueta={etiqueta} ayuda={ayuda}>
      <input
        type="number"
        name={name}
        min="0"
        step={decimal ? "0.1" : "1"}
        inputMode={decimal ? "decimal" : "numeric"}
        required={requerido}
        className={control}
      />
    </Campo>
  );
}

function Selector({ etiqueta, name, opciones, requerido }: { etiqueta: string; name: string; opciones: { valor: string; etiqueta: string }[]; requerido?: boolean }) {
  return (
    <Campo etiqueta={etiqueta}>
      <select name={name} required={requerido} defaultValue="" className={control}>
        <option value="" disabled={requerido}>
          {requerido ? "Elige una opción" : "Ninguno"}
        </option>
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.etiqueta}
          </option>
        ))}
      </select>
    </Campo>
  );
}

export function FormularioFinca({
  registro,
  fincaId,
  volver,
  tipoCalidad,
  bienes,
  insumos,
  potreros = [],
  grupos = [],
  objetivoDescanso = 35,
}: {
  registro: RegistroFinca;
  fincaId: string;
  volver: string;
  tipoCalidad?: string;
  bienes: { id: string; nombre: string; codigo: string }[];
  insumos: { nombre: string; unidad: string }[];
  potreros?: EstadoPotrero[];
  grupos?: string[];
  objetivoDescanso?: number;
}) {
  const oculto = <input type="hidden" name="finca_id" value={fincaId} />;
  const paso = `registro=${registro}`;

  switch (registro) {
    case "carro":
      return (
        <Formulario titulo="Carro tanque" descripcion="Leche que se llevó el carro recolector." accion={registrarRecoleccion} volver={volver} paso={paso}>
          {oculto}
          <CampoFecha />
          <Campo etiqueta="Litros recogidos">
            <input name="litros" type="number" inputMode="decimal" step="0.1" min="0" required className={`${control} text-2xl font-bold`} />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Texto etiqueta="Placa" name="placa" placeholder="ABC123" />
            <Texto etiqueta="Celular" name="celular_conductor" tipo="tel" />
          </div>
          <Texto etiqueta="Conductor" name="conductor" />
          <Texto etiqueta="Entregado por" name="entregado_por" />
        </Formulario>
      );

    case "mantenimiento":
      return (
        <Formulario titulo="Mantenimiento" accion={registrarMantenimiento} volver={volver} paso={paso}>
          {oculto}
          <CampoFecha />
          <Selector
            etiqueta="¿Qué se arregló?"
            name="tipo"
            requerido
            opciones={[
              { valor: "equipo_ordeno", etiqueta: "Equipo de ordeño" },
              { valor: "tanque", etiqueta: "Tanque de enfriamiento" },
              { valor: "cercas", etiqueta: "Cercas, rieles, zanjas, riego" },
              { valor: "equipos", etiqueta: "Otros equipos" },
              { valor: "general", etiqueta: "General" },
            ]}
          />
          {bienes.length > 0 && (
            <Selector etiqueta="Equipo o bien (opcional)" name="bien_id" opciones={bienes.map((b) => ({ valor: b.id, etiqueta: `${b.nombre} · ${b.codigo}` }))} />
          )}
          <Campo etiqueta="Detalle del mantenimiento">
            <textarea name="detalle" rows={3} required className={`${control} resize-none`} />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Texto etiqueta="Potreros" name="potreros" placeholder="3, 4, 7" />
            <Texto etiqueta="Materiales" name="materiales" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Texto etiqueta="Responsable" name="responsable" />
            <Texto etiqueta="Celular" name="celular" tipo="tel" />
          </div>
        </Formulario>
      );

    case "aplicacion":
      return (
        <Formulario titulo="Fumigación y abonos" accion={registrarAplicacion} volver={volver} paso={paso}>
          {oculto}
          <CampoFecha />
          <Selector
            etiqueta="Tipo de aplicación"
            name="tipo"
            requerido
            opciones={[
              { valor: "fumigacion", etiqueta: "Fumigación" },
              { valor: "fertilizacion", etiqueta: "Fertilización" },
              { valor: "abonada", etiqueta: "Abonada" },
              { valor: "encalada", etiqueta: "Encalada" },
              { valor: "veneno_mosca", etiqueta: "Veneno para mosca" },
              { valor: "veneno_roedores", etiqueta: "Veneno para roedores" },
            ]}
          />
          <Texto etiqueta="Producto" name="producto" requerido />
          <div className="grid grid-cols-2 gap-3">
            <Numero etiqueta="Cantidad" name="cantidad" />
            <Texto etiqueta="Unidad" name="unidad" placeholder="L por caneca, kg…" />
          </div>
          {potreros.length > 0 && (
            <fieldset>
              <legend className="mb-2 font-bold text-slate-800">Potreros aplicados</legend>
              <div className="grid grid-cols-3 gap-2">
                {potreros.map((p) => (
                  <label
                    key={p.potrero_id}
                    className="flex min-h-12 cursor-pointer items-center justify-center rounded-2xl border border-slate-300 bg-white px-2 text-center font-bold text-slate-700 has-checked:border-campo has-checked:bg-blue-50 has-checked:text-campo-oscuro has-focus-visible:ring-4 has-focus-visible:ring-campo/25"
                  >
                    <input type="checkbox" name="potrero_ids" value={p.potrero_id} className="sr-only" />
                    {p.numero}
                    {p.nombre && <span className="ml-1 truncate text-xs font-normal">{p.nombre}</span>}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Texto etiqueta={potreros.length ? "Otros potreros" : "Potreros"} name="potreros" placeholder="1, 2, 5" />
            <Texto etiqueta="Área" name="area" placeholder="Establo, bodega…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Numero etiqueta="Retiro de pastoreo (días)" name="dias_retiro_pastoreo" decimal={false} />
            <Numero etiqueta="Animales tratados" name="animales_tratados" decimal={false} />
          </div>
          <Opciones etiqueta="Jornada" name="jornada" opciones={JORNADAS} />
          <Texto etiqueta="Personas que aplicaron" name="personas" />
        </Formulario>
      );

    case "rotacion": {
      const avisos = potreros.map((p) => avisoPotrero(p, objetivoDescanso)).filter((a): a is string => a !== null && !a.includes("ocupado"));
      const listos = potreros.filter((p) => p.estado === "listo").sort((a, b) => (b.dias_descanso ?? 0) - (a.dias_descanso ?? 0));
      return (
        <Formulario
          titulo="Rotación de potrero"
          descripcion="El grupo sale del potrero donde está y entra al nuevo en la misma fecha."
          accion={registrarRotacion}
          volver={volver}
          paso={paso}
          antes={
            <div className="mb-4 space-y-2">
              {listos.length > 0 && (
                <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
                  Listos: {listos.slice(0, 4).map(nombrePotrero).join(", ")}
                </p>
              )}
              {avisos.length > 0 && (
                <details className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <summary className="cursor-pointer font-bold">
                    {potreros.filter((p) => p.estado === "bloqueado").length} bloqueados · {potreros.filter((p) => p.estado === "descansando").length} descansando
                  </summary>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {avisos.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          }
        >
          {oculto}
          <CampoFecha />
          <Campo etiqueta="Grupo">
            <input name="grupo" list="grupos-rotacion" required autoComplete="off" defaultValue={grupos[0] ?? ""} className={control} />
            <datalist id="grupos-rotacion">
              {grupos.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </Campo>
          <Numero etiqueta="Número de animales" name="animales" decimal={false} />
          <Campo etiqueta="Potrero destino">
            <select name="potrero_id" defaultValue={listos[0]?.potrero_id ?? ""} className={control}>
              <option value="">Solo sacar el grupo (no entra a otro)</option>
              {potreros.map((p) => (
                <option key={p.potrero_id} value={p.potrero_id}>
                  {nombrePotrero(p)} · {detallePotrero(p, objetivoDescanso)}
                </option>
              ))}
            </select>
          </Campo>
          <Casilla name="confirmar" etiqueta="Entrar de todas formas (bloqueado o sin descanso)" />
          <Campo etiqueta="Observaciones">
            <textarea name="observaciones" rows={2} className={`${control} resize-none`} />
          </Campo>
        </Formulario>
      );
    }

    case "calidad": {
      const tipo = tipoCalidad === "temperatura_tanque" ? "temperatura_tanque" : "agua";
      return (
        <Formulario
          titulo="Agua y tanque"
          accion={registrarControl}
          volver={volver}
          paso={`${paso}&tipo=${tipo}`}
          antes={
            <Chips
              items={[
                { href: `${volver}&registro=calidad&tipo=agua`, etiqueta: "pH y cloro del agua", activo: tipo === "agua" },
                { href: `${volver}&registro=calidad&tipo=temperatura_tanque`, etiqueta: "Temperatura del tanque", activo: tipo === "temperatura_tanque" },
              ]}
            />
          }
        >
          {oculto}
          <input type="hidden" name="tipo" value={tipo} />
          <CampoFecha />
          {tipo === "agua" ? (
            <>
              <Texto etiqueta="Toma del agua (muestra)" name="muestra" placeholder="Tanque, bebedero, ordeño…" />
              <div className="grid grid-cols-2 gap-3">
                <Numero etiqueta="pH" name="ph" />
                <Numero etiqueta="Cloro (ppm)" name="cloro" />
              </div>
              <Texto etiqueta="Estado" name="estado" placeholder="Bien, turbia…" />
              <Texto etiqueta="Tratamiento" name="tratamiento" />
            </>
          ) : (
            <>
              <Opciones etiqueta="Jornada" name="jornada" opciones={JORNADAS} defecto={new Date().getHours() < 12 ? "am" : "pm"} requerido />
              <Campo etiqueta="Grados (°C)">
                <input name="grados" type="number" inputMode="decimal" step="0.1" required className={`${control} text-2xl font-bold`} />
              </Campo>
            </>
          )}
          <Texto etiqueta="Responsable" name="responsable" />
        </Formulario>
      );
    }

    case "insumos":
      return (
        <Formulario titulo="Insumos" descripcion="Medicamentos, concentrados, abonos y maquinaria." accion={registrarMovimientoInsumo} volver={volver} paso={paso}>
          {oculto}
          <CampoFecha />
          <Campo etiqueta="Producto">
            <input name="producto" list="lista-insumos" required autoComplete="off" className={control} />
            <datalist id="lista-insumos">
              {insumos.map((i) => (
                <option key={i.nombre} value={i.nombre}>
                  {i.unidad}
                </option>
              ))}
            </datalist>
          </Campo>
          <Opciones
            etiqueta="Movimiento"
            name="tipo"
            opciones={[
              { valor: "ingreso", etiqueta: "Ingresa" },
              { valor: "salida", etiqueta: "Sale" },
            ]}
            requerido
          />
          <div className="grid grid-cols-2 gap-3">
            <Numero etiqueta="Cantidad" name="cantidad" requerido />
            <Texto etiqueta="Hora" name="hora" tipo="time" />
          </div>
          <Texto etiqueta="Quién entrega" name="entrega" />
          <Texto etiqueta="Quién recibe" name="recibe" />
        </Formulario>
      );

    case "consumo":
      return (
        <Formulario titulo="Consumo del día" descripcion="Si ya se anotó este día, se actualiza." accion={registrarConsumo} volver={volver} paso={paso}>
          {oculto}
          <CampoFecha />
          <p className="font-bold text-slate-800">Vacas</p>
          <div className="grid grid-cols-2 gap-3">
            <Numero etiqueta="Concentrado (kg)" name="kg_concentrado_vacas" />
            <Numero etiqueta="Sal (kg)" name="kg_sal_vacas" />
          </div>
          <p className="font-bold text-slate-800">Terneras</p>
          <div className="grid grid-cols-2 gap-3">
            <Numero etiqueta="Concentrado (kg)" name="kg_concentrado_terneras" />
            <Numero etiqueta="Sal (kg)" name="kg_sal_terneras" />
          </div>
        </Formulario>
      );

    case "visitas":
      return (
        <Formulario titulo="Visitantes" descripcion="Registro de ingreso de personas a la finca." accion={registrarVisita} volver={volver} paso={paso}>
          {oculto}
          <CampoFecha />
          <Texto etiqueta="Nombre completo" name="nombre" requerido />
          <div className="grid grid-cols-2 gap-3">
            <Texto etiqueta="Cédula" name="cedula" />
            <Texto etiqueta="Hora de ingreso" name="hora_ingreso" tipo="time" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Texto etiqueta="Empresa" name="empresa" />
            <Texto etiqueta="Placa" name="placa" />
          </div>
          <Texto etiqueta="Motivo de la visita" name="motivo" />
        </Formulario>
      );
  }
}

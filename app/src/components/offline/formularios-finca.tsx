"use client";

import { useState } from "react";
import clsx from "clsx";
import { Droplets, Fence, Package, SprayCan, Truck, Users, Wheat, Wrench, type LucideIcon } from "lucide-react";
import { Campo, CampoFecha, JORNADAS, Opciones, control } from "@/components/campo/ui";
import { ESTADOS_POTRERO, avisoPotrero, nombrePotrero } from "@/components/potreros/rotacion";
import { fecha as fechaCorta } from "@/lib/formato";
import type { Catalogo, PotreroCatalogo } from "@/lib/offline/tipos";
import { Chip, FormaRapida, Numero, Observaciones, Selector, Texto, jornadaActual, type Guardar } from "./formularios-rapidos";

const REGISTROS = [
  { id: "carro_tanque", etiqueta: "Carro tanque", icono: Truck },
  { id: "consumo_diario", etiqueta: "Consumo del día", icono: Wheat },
  { id: "rotacion", etiqueta: "Rotación de potrero", icono: Fence },
  { id: "aplicacion", etiqueta: "Fumigación y abonos", icono: SprayCan },
  { id: "mantenimiento", etiqueta: "Mantenimiento", icono: Wrench },
  { id: "control_calidad", etiqueta: "Agua y tanque", icono: Droplets },
  { id: "movimiento_insumo", etiqueta: "Insumos", icono: Package },
  { id: "visita", etiqueta: "Visitantes", icono: Users },
] as const satisfies readonly { id: string; etiqueta: string; icono: LucideIcon }[];

type RegistroFinca = (typeof REGISTROS)[number]["id"];

const GRUPOS_BASE = ["Vacas en ordeño", "Vacas secas", "Novillas", "Terneras"];

function detallePotrero(p: PotreroCatalogo, objetivo: number) {
  const estado = ESTADOS_POTRERO[p.estado]?.texto ?? p.estado;
  if (p.estado === "ocupado") return `${estado}: ${p.grupo}`;
  if (p.estado === "bloqueado") return `${estado} hasta ${fechaCorta(p.retiro_hasta)}`;
  if (p.estado === "descansando" || p.estado === "listo") return `${estado} ${p.dias_descanso}/${objetivo} días`;
  return estado;
}

function FormularioRotacion({ catalogo, fincaId, alGuardar }: { catalogo: Catalogo; fincaId: string; alGuardar: Guardar }) {
  const potreros = catalogo.potreros_estado;
  const objetivo = catalogo.dias_descanso_objetivo;
  const grupos = [...new Set([...GRUPOS_BASE, ...catalogo.grupos])];
  const listos = potreros.filter((p) => p.estado === "listo").sort((a, b) => (b.dias_descanso ?? 0) - (a.dias_descanso ?? 0));

  const [grupo, setGrupo] = useState(grupos[0]);
  const [destino, setDestino] = useState(listos[0]?.potrero_id ?? "");
  const [confirmar, setConfirmar] = useState(false);

  const nombre = grupo.trim();
  const dondeEsta = catalogo.rotaciones_abiertas
    .filter((r) => r.grupo === nombre)
    .map((r) => potreros.find((p) => p.potrero_id === r.potrero_id))
    .filter((p): p is PotreroCatalogo => p !== undefined);
  const elegido = potreros.find((p) => p.potrero_id === destino);
  const alerta = elegido && elegido.grupo !== nombre ? avisoPotrero(elegido, objetivo) : null;

  if (potreros.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-center text-slate-500">
        No hay potreros en los datos del teléfono. Descarga los datos de la finca con señal.
      </p>
    );
  }

  return (
    <FormaRapida
      accion="rotacion"
      fijos={{ finca_id: fincaId }}
      alGuardar={alGuardar}
      descripcion="El grupo sale del potrero donde está y entra al nuevo en la misma fecha."
      revisar={() => {
        if (!destino && dondeEsta.length === 0) return `«${nombre}» no está en ningún potrero según los datos del teléfono. Elige el potrero destino.`;
        if (alerta && !confirmar) return `${alerta} Si igual vas a entrar el grupo, marca «Entrar de todas formas».`;
        return null;
      }}
    >
      {listos.length > 0 && (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
          Listos: {listos.slice(0, 4).map(nombrePotrero).join(", ")}
        </p>
      )}
      <CampoFecha />
      <Campo etiqueta="Grupo">
        <input name="grupo" list="vacdata-grupos" required autoComplete="off" value={grupo} onChange={(e) => setGrupo(e.target.value)} className={control} />
      </Campo>
      <datalist id="vacdata-grupos">
        {grupos.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>
      <p className="-mt-2 text-sm text-slate-600">
        {dondeEsta.length ? `Ahora está en: ${dondeEsta.map(nombrePotrero).join(", ")}` : "Según los datos del teléfono, este grupo no está en ningún potrero."}
      </p>
      <Numero etiqueta="Número de animales" name="animales" paso="1" />
      <Campo etiqueta="Potrero destino">
        <select
          name="potrero_id"
          value={destino}
          onChange={(e) => {
            setDestino(e.target.value);
            setConfirmar(false);
          }}
          className={control}
        >
          <option value="">Solo sacar el grupo (no entra a otro)</option>
          {potreros.map((p) => (
            <option key={p.potrero_id} value={p.potrero_id}>
              {nombrePotrero(p)} · {detallePotrero(p, objetivo)}
            </option>
          ))}
        </select>
      </Campo>
      {alerta && (
        <>
          <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">{alerta}</p>
          <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 font-bold text-slate-700 has-checked:border-campo has-checked:bg-blue-50">
            <input type="checkbox" checked={confirmar} onChange={(e) => setConfirmar(e.target.checked)} className="h-6 w-6 accent-campo" />
            Entrar de todas formas
          </label>
        </>
      )}
      <Observaciones />
    </FormaRapida>
  );
}

function FormularioCalidad({ fincaId, alGuardar }: { fincaId: string; alGuardar: Guardar }) {
  const [tipo, setTipo] = useState<"agua" | "temperatura_tanque">("agua");
  return (
    <FormaRapida key={tipo} accion="control_calidad" fijos={{ finca_id: fincaId, tipo }} alGuardar={alGuardar}>
      <div className="flex flex-wrap gap-2">
        <Chip activo={tipo === "agua"} onClick={() => setTipo("agua")}>
          pH y cloro del agua
        </Chip>
        <Chip activo={tipo === "temperatura_tanque"} onClick={() => setTipo("temperatura_tanque")}>
          Temperatura del tanque
        </Chip>
      </div>
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
          <Opciones etiqueta="Jornada" name="jornada" opciones={JORNADAS} defecto={jornadaActual()} requerido />
          <Numero etiqueta="Grados (°C)" name="grados" requerido grande min="-30" />
        </>
      )}
      <Texto etiqueta="Responsable" name="responsable" />
    </FormaRapida>
  );
}

function Formulario({ registro, fincaId, catalogo, alGuardar }: { registro: RegistroFinca; fincaId: string; catalogo: Catalogo | null; alGuardar: Guardar }) {
  const fijos = { finca_id: fincaId };
  const insumos = catalogo?.insumos ?? [];
  const potreros = catalogo?.potreros_estado ?? [];

  switch (registro) {
    case "carro_tanque":
      return (
        <FormaRapida accion="carro_tanque" fijos={fijos} alGuardar={alGuardar} descripcion="Leche que recogió el carro tanque.">
          <CampoFecha />
          <Numero etiqueta="Litros entregados" name="litros" requerido grande />
          <div className="grid grid-cols-2 gap-3">
            <Texto etiqueta="Placa" name="placa" placeholder="ABC123" />
            <Texto etiqueta="Celular" name="celular_conductor" tipo="tel" />
          </div>
          <Texto etiqueta="Conductor" name="conductor" />
          <Texto etiqueta="Entregado por" name="entregado_por" />
        </FormaRapida>
      );
    case "consumo_diario":
      return (
        <FormaRapida accion="consumo_diario" fijos={fijos} alGuardar={alGuardar} descripcion="Kilos que se dieron hoy. Llena al menos uno.">
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
        </FormaRapida>
      );
    case "mantenimiento":
      return (
        <FormaRapida accion="mantenimiento" fijos={fijos} alGuardar={alGuardar}>
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
          {(catalogo?.bienes.length ?? 0) > 0 && (
            <Selector
              etiqueta="Equipo o bien (opcional)"
              name="bien_id"
              opciones={(catalogo?.bienes ?? []).map((b) => ({ valor: b.id, etiqueta: `${b.nombre} · ${b.codigo}` }))}
            />
          )}
          <Observaciones name="detalle" etiqueta="Detalle del mantenimiento" requerido />
          <div className="grid grid-cols-2 gap-3">
            <Texto etiqueta="Potreros" name="potreros" placeholder="3, 4, 7" />
            <Texto etiqueta="Materiales" name="materiales" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Texto etiqueta="Responsable" name="responsable" />
            <Texto etiqueta="Celular" name="celular" tipo="tel" />
          </div>
        </FormaRapida>
      );
    case "aplicacion":
      return (
        <FormaRapida accion="aplicacion" fijos={fijos} alGuardar={alGuardar}>
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
          <Texto etiqueta="Producto" name="producto" requerido lista="vacdata-productos-campo" />
          <datalist id="vacdata-productos-campo">
            {insumos
              .filter((i) => ["abono", "cal", "fertilizante", "veneno", "otro"].includes(i.categoria))
              .map((i) => (
                <option key={i.nombre} value={i.nombre} />
              ))}
          </datalist>
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
            <Numero etiqueta="Retiro de pastoreo (días)" name="dias_retiro_pastoreo" paso="1" />
            <Numero etiqueta="Animales tratados" name="animales_tratados" paso="1" />
          </div>
          <Opciones etiqueta="Jornada" name="jornada" opciones={JORNADAS} />
          <Texto etiqueta="Personas que aplicaron" name="personas" />
        </FormaRapida>
      );
    case "rotacion":
      return catalogo ? (
        <FormularioRotacion catalogo={catalogo} fincaId={fincaId} alGuardar={alGuardar} />
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-center text-slate-500">Descarga los datos de la finca con señal para ver los potreros.</p>
      );
    case "control_calidad":
      return <FormularioCalidad fincaId={fincaId} alGuardar={alGuardar} />;
    case "movimiento_insumo":
      return (
        <FormaRapida accion="movimiento_insumo" fijos={fijos} alGuardar={alGuardar} descripcion="Medicamentos, concentrados, abonos y maquinaria.">
          <CampoFecha />
          <Texto etiqueta="Producto" name="producto" requerido lista="vacdata-insumos" />
          <datalist id="vacdata-insumos">
            {insumos.map((i) => (
              <option key={i.nombre} value={i.nombre}>
                {i.unidad}
              </option>
            ))}
          </datalist>
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
        </FormaRapida>
      );
    case "visita":
      return (
        <FormaRapida accion="visita" fijos={fijos} alGuardar={alGuardar} descripcion="Registro de ingreso de personas a la finca.">
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
        </FormaRapida>
      );
  }
}

export function FormulariosFinca({ fincaId, catalogo, alGuardar }: { fincaId: string; catalogo: Catalogo | null; alGuardar: Guardar }) {
  const [registro, setRegistro] = useState<RegistroFinca>("carro_tanque");
  // Cambia después de cada guardado para dejar el formulario limpio.
  const [vuelta, setVuelta] = useState(0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {REGISTROS.map(({ id, etiqueta, icono: Icono }) => (
          <button
            key={id}
            type="button"
            onClick={() => setRegistro(id)}
            aria-pressed={registro === id}
            className={clsx(
              "flex min-h-14 items-center gap-2 rounded-2xl border px-3 text-left text-sm font-bold leading-tight",
              registro === id ? "border-campo bg-campo text-white" : "border-slate-200 bg-white text-slate-700",
            )}
          >
            <Icono className="h-5 w-5 shrink-0" aria-hidden />
            {etiqueta}
          </button>
        ))}
      </div>
      <Formulario
        key={`${registro}-${vuelta}`}
        registro={registro}
        fincaId={fincaId}
        catalogo={catalogo}
        alGuardar={async (accion, datos) => {
          await alGuardar(accion, datos);
          setVuelta((v) => v + 1);
        }}
      />
    </div>
  );
}

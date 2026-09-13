"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import clsx from "clsx";
import { CircleAlert, Save } from "lucide-react";
import { Campo, CampoFecha, Casilla, JORNADAS, Opciones, SI_NO, control } from "@/components/campo/ui";
import { CUARTOS, TIPOS_SALUD, validarDatos } from "@/lib/offline/esquemas";
import { ETIQUETA_ACCION } from "@/lib/offline/resumen";
import type { Accion, Catalogo } from "@/lib/offline/tipos";

export type Guardar = (accion: Accion, datos: Record<string, unknown>) => Promise<void>;

function leerFormulario(form: HTMLFormElement) {
  const fd = new FormData(form);
  const datos: Record<string, unknown> = {};
  for (const clave of new Set(fd.keys())) {
    const valores = fd.getAll(clave).filter((v): v is string => typeof v === "string");
    datos[clave] = valores.length > 1 ? valores : valores[0];
  }
  return datos;
}

const jornadaActual = () => (new Date().getHours() < 12 ? "am" : "pm");

export function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={clsx(
        "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-bold",
        activo ? "border-campo bg-campo text-white" : "border-slate-300 bg-white text-slate-700",
      )}
    >
      {children}
    </button>
  );
}

function FormaRapida({
  accion,
  fijos,
  alGuardar,
  descripcion,
  children,
}: {
  accion: Accion;
  fijos: Record<string, string>;
  alGuardar: Guardar;
  descripcion?: string;
  children: ReactNode;
}) {
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const leido = validarDatos(accion, { ...leerFormulario(form), ...fijos });
    if (!leido.ok) {
      setError(leido.mensaje);
      return;
    }
    setGuardando(true);
    try {
      await alGuardar(accion, leido.datos);
      setError(null);
      form.reset();
    } catch {
      setError("No se pudo guardar en el teléfono. Revisa que haya espacio disponible.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <h2 className="font-display text-xl font-bold text-slate-900">{ETIQUETA_ACCION[accion]}</h2>
      {descripcion && <p className="-mt-2 text-sm text-slate-500">{descripcion}</p>}
      {children}
      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 font-semibold text-red-800">
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={guardando}
        className="flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl bg-campo text-lg font-bold text-white shadow-lg shadow-campo/25 disabled:opacity-60"
      >
        <Save className="h-5 w-5" aria-hidden />
        {guardando ? "Guardando…" : "Guardar en el teléfono"}
      </button>
    </form>
  );
}

function Texto({ etiqueta, name, placeholder, lista }: { etiqueta: string; name: string; placeholder?: string; lista?: string }) {
  return (
    <Campo etiqueta={etiqueta}>
      <input name={name} placeholder={placeholder} list={lista} className={control} />
    </Campo>
  );
}

function Observaciones() {
  return (
    <Campo etiqueta="Observaciones">
      <textarea name="observaciones" rows={2} className={`${control} resize-none`} />
    </Campo>
  );
}

function Numero({ etiqueta, name, requerido, grande, paso = "0.1" }: { etiqueta: string; name: string; requerido?: boolean; grande?: boolean; paso?: string }) {
  return (
    <Campo etiqueta={etiqueta}>
      <input
        name={name}
        type="number"
        inputMode="decimal"
        step={paso}
        min="0"
        required={requerido}
        placeholder="0"
        className={clsx(control, grande && "text-2xl font-bold")}
      />
    </Campo>
  );
}

// ─────────────────────────── Animal ───────────────────────────
export const ACCIONES_ANIMAL = ["ordeno", "servicio", "palpacion", "parto", "secado", "salud", "pesaje"] as const;
export type AccionAnimal = (typeof ACCIONES_ANIMAL)[number];

const ETIQUETA_SALUD: Record<(typeof TIPOS_SALUD)[number], string> = {
  vacuna: "Vacuna",
  enfermedad: "Enfermedad",
  tratamiento: "Tratamiento",
  mastitis: "Mastitis",
  cojera: "Cojera",
  fiebre: "Fiebre",
  entamborada: "Entamborada",
  fiebre_leche: "Fiebre de leche",
  cirugia: "Cirugía",
  desparasitacion: "Desparasitación",
};

function FormularioSalud({ animalId, insumos, alGuardar }: { animalId: string; insumos: Catalogo["insumos"]; alGuardar: Guardar }) {
  const [tipo, setTipo] = useState<(typeof TIPOS_SALUD)[number]>("vacuna");
  const medicamentos = insumos.filter((i) => i.categoria === "medicamento");

  return (
    <FormaRapida accion="salud" fijos={{ animal_id: animalId, tipo }} alGuardar={alGuardar}>
      <div className="flex flex-wrap gap-2">
        {TIPOS_SALUD.map((t) => (
          <Chip key={t} activo={t === tipo} onClick={() => setTipo(t)}>
            {ETIQUETA_SALUD[t]}
          </Chip>
        ))}
      </div>
      <CampoFecha />
      {tipo === "mastitis" && (
        <fieldset>
          <legend className="mb-2 font-bold text-slate-800">Cuartos afectados</legend>
          <div className="grid grid-cols-2 gap-2">
            {CUARTOS.map((c) => (
              <Casilla key={c} name="cuartos" value={c} etiqueta={c} />
            ))}
          </div>
        </fieldset>
      )}
      {tipo !== "vacuna" && <Texto etiqueta="Diagnóstico" name="diagnostico" />}
      <Texto etiqueta={tipo === "vacuna" ? "Vacuna" : "Producto aplicado"} name="producto" lista="vacdata-medicamentos" />
      <datalist id="vacdata-medicamentos">
        {medicamentos.map((m) => (
          <option key={m.nombre} value={m.nombre} />
        ))}
      </datalist>
      <div className="grid grid-cols-2 gap-3">
        <Texto etiqueta="Dosis" name="dosis" placeholder="5 ml" />
        <Numero etiqueta="Días de retiro" name="dias_retiro" paso="1" />
      </div>
      <Observaciones />
    </FormaRapida>
  );
}

export function FormularioAnimalRapido({
  accion,
  animalId,
  catalogo,
  alGuardar,
}: {
  accion: AccionAnimal;
  animalId: string;
  catalogo: Catalogo;
  alGuardar: Guardar;
}) {
  const [jornada] = useState(jornadaActual);
  const fijos = { animal_id: animalId };

  switch (accion) {
    case "ordeno":
      return (
        <FormaRapida accion="ordeno" fijos={fijos} alGuardar={alGuardar}>
          <CampoFecha />
          <Opciones etiqueta="Jornada" name="jornada" opciones={JORNADAS} defecto={jornada} requerido />
          <Numero etiqueta="Litros" name="litros" requerido grande />
        </FormaRapida>
      );
    case "servicio":
      return (
        <FormaRapida accion="servicio" fijos={fijos} alGuardar={alGuardar} descripcion="La palpación queda programada 33 días después.">
          <CampoFecha />
          <Opciones
            etiqueta="Tipo de servicio"
            name="tipo"
            opciones={[
              { valor: "inseminacion", etiqueta: "Inseminación" },
              { valor: "monta", etiqueta: "Monta de toro" },
            ]}
            defecto="inseminacion"
            requerido
          />
          <Opciones etiqueta="Jornada" name="jornada" opciones={JORNADAS} />
          <Texto etiqueta="Nombre del toro" name="toro_nombre" />
          <Texto etiqueta="Raza del toro" name="toro_raza" placeholder="Holstein, Jersey…" />
          <Texto etiqueta="Inseminador" name="inseminador" />
          <Observaciones />
        </FormaRapida>
      );
    case "palpacion":
      return (
        <FormaRapida accion="palpacion" fijos={fijos} alGuardar={alGuardar}>
          <CampoFecha />
          <Opciones
            etiqueta="Resultado"
            name="resultado"
            opciones={[
              { valor: "prenada", etiqueta: "Preñada" },
              { valor: "vacia", etiqueta: "Vacía" },
            ]}
            requerido
          />
          <Numero etiqueta="Días de preñez (si quedó preñada)" name="dias_prenez" paso="1" />
          <Texto etiqueta="Veterinario" name="veterinario" />
          <Observaciones />
        </FormaRapida>
      );
    case "parto":
      return (
        <FormaRapida accion="parto" fijos={fijos} alGuardar={alGuardar}>
          <CampoFecha />
          <Opciones
            etiqueta="Sexo de la cría"
            name="cria_sexo"
            opciones={[
              { valor: "hembra", etiqueta: "Hembra" },
              { valor: "macho", etiqueta: "Macho" },
            ]}
          />
          <Texto etiqueta="Raza de la cría" name="cria_raza" />
          <Opciones etiqueta="¿Nació viva?" name="nacido_vivo" opciones={SI_NO} defecto="si" />
          <Opciones etiqueta="¿Tomó calostro?" name="toma_calostro" opciones={SI_NO} />
          <Casilla name="aborto" etiqueta="Fue un aborto" />
          <Observaciones />
        </FormaRapida>
      );
    case "secado":
      return (
        <FormaRapida accion="secado" fijos={fijos} alGuardar={alGuardar} descripcion="La vaca deja de ordeñarse hasta el próximo parto.">
          <CampoFecha />
          <Texto etiqueta="Motivo" name="motivo" placeholder="7 meses de preñez" lista="vacdata-motivos-secado" />
          <datalist id="vacdata-motivos-secado">
            <option value="7 meses de preñez" />
            <option value="Baja producción" />
            <option value="Enfermedad" />
          </datalist>
        </FormaRapida>
      );
    case "salud":
      return <FormularioSalud animalId={animalId} insumos={catalogo.insumos} alGuardar={alGuardar} />;
    case "pesaje":
      return (
        <FormaRapida accion="pesaje" fijos={fijos} alGuardar={alGuardar}>
          <CampoFecha />
          <Numero etiqueta="Peso (kg)" name="peso_kg" requerido grande />
        </FormaRapida>
      );
  }
}

// ─────────────────────────── Finca ───────────────────────────
export function FormulariosFinca({ fincaId, alGuardar }: { fincaId: string; alGuardar: Guardar }) {
  const [accion, setAccion] = useState<"carro_tanque" | "consumo_diario">("carro_tanque");
  const fijos = { finca_id: fincaId };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Chip activo={accion === "carro_tanque"} onClick={() => setAccion("carro_tanque")}>
          Carro tanque
        </Chip>
        <Chip activo={accion === "consumo_diario"} onClick={() => setAccion("consumo_diario")}>
          Consumo del día
        </Chip>
      </div>
      {accion === "carro_tanque" ? (
        <FormaRapida accion="carro_tanque" fijos={fijos} alGuardar={alGuardar} descripcion="Leche que recogió el carro tanque.">
          <CampoFecha />
          <Numero etiqueta="Litros entregados" name="litros" requerido grande />
          <div className="grid grid-cols-2 gap-3">
            <Texto etiqueta="Placa" name="placa" placeholder="ABC123" />
            <Texto etiqueta="Conductor" name="conductor" />
          </div>
        </FormaRapida>
      ) : (
        <FormaRapida accion="consumo_diario" fijos={fijos} alGuardar={alGuardar} descripcion="Kilos que se dieron hoy. Llena al menos uno.">
          <CampoFecha />
          <div className="grid grid-cols-2 gap-3">
            <Numero etiqueta="Concentrado vacas" name="kg_concentrado_vacas" />
            <Numero etiqueta="Sal vacas" name="kg_sal_vacas" />
            <Numero etiqueta="Concentrado terneras" name="kg_concentrado_terneras" />
            <Numero etiqueta="Sal terneras" name="kg_sal_terneras" />
          </div>
        </FormaRapida>
      )}
    </div>
  );
}

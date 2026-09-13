import {
  registrarBaja,
  registrarDestete,
  registrarOrdeno,
  registrarPalpacion,
  registrarParto,
  registrarPesaje,
  registrarSalud,
  registrarSecado,
  registrarServicio,
} from "@/app/campo/actions";
import { Formulario } from "./formulario";
import { Campo, CampoFecha, Casilla, Chips, JORNADAS, Opciones, SI_NO, control } from "./ui";

export type AccionAnimal = "ordeno" | "servicio" | "palpacion" | "parto" | "secado" | "pesaje" | "destete" | "salud" | "baja";

const TIPOS_SALUD = [
  { valor: "vacuna", etiqueta: "Vacuna" },
  { valor: "enfermedad", etiqueta: "Enfermedad" },
  { valor: "tratamiento", etiqueta: "Tratamiento" },
  { valor: "mastitis", etiqueta: "Mastitis" },
  { valor: "cojera", etiqueta: "Cojera" },
  { valor: "fiebre", etiqueta: "Fiebre" },
] as const;

const CUARTOS = [
  { valor: "TDD", etiqueta: "TDD · trasero derecho" },
  { valor: "TDI", etiqueta: "TDI · trasero izquierdo" },
  { valor: "TTD", etiqueta: "TTD · delantero derecho" },
  { valor: "TTI", etiqueta: "TTI · delantero izquierdo" },
];

function Texto({ etiqueta, name, placeholder, requerido }: { etiqueta: string; name: string; placeholder?: string; requerido?: boolean }) {
  return (
    <Campo etiqueta={etiqueta}>
      <input name={name} placeholder={placeholder} required={requerido} className={control} />
    </Campo>
  );
}

function Observaciones() {
  return (
    <Campo etiqueta="Observaciones">
      <textarea name="observaciones" rows={3} className={`${control} resize-none`} />
    </Campo>
  );
}

export function FormularioAnimal({
  accion,
  animalId,
  volver,
  tipoSalud,
  nombreAnimal = "",
}: {
  accion: AccionAnimal;
  animalId: string;
  volver: string;
  tipoSalud?: string;
  /** Nombre del animal, para sugerir el nombre de la cría. */
  nombreAnimal?: string;
}) {
  const oculto = <input type="hidden" name="animal_id" value={animalId} />;

  switch (accion) {
    case "ordeno":
      return (
        <Formulario titulo="Ordeño" descripcion="Si ya había litros en esa jornada, se reemplazan." accion={registrarOrdeno} volver={volver} paso="accion=ordeno">
          {oculto}
          <CampoFecha />
          <Opciones etiqueta="Jornada" name="jornada" opciones={JORNADAS} defecto={new Date().getHours() < 12 ? "am" : "pm"} requerido />
          <Campo etiqueta="Litros">
            <input name="litros" type="number" inputMode="decimal" step="0.1" min="0" required placeholder="0,0" className={`${control} text-2xl font-bold`} />
          </Campo>
        </Formulario>
      );

    case "servicio":
      return (
        <Formulario titulo="Servicio" descripcion="La palpación queda programada 33 días después." accion={registrarServicio} volver={volver} paso="accion=servicio">
          {oculto}
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
        </Formulario>
      );

    case "palpacion":
      return (
        <Formulario titulo="Palpación" accion={registrarPalpacion} volver={volver} paso="accion=palpacion">
          {oculto}
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
          <Campo etiqueta="Días de preñez" ayuda="Solo si quedó preñada.">
            <input name="dias_prenez" type="number" inputMode="numeric" min="0" className={control} />
          </Campo>
          <Texto etiqueta="Veterinario" name="veterinario" />
          <Observaciones />
        </Formulario>
      );

    case "parto":
      return (
        <Formulario titulo="Parto / cría" accion={registrarParto} volver={volver} paso="accion=parto">
          {oculto}
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
          <Opciones
            etiqueta="¿Parió de día o de noche?"
            name="en_la_noche"
            opciones={[
              { valor: "no", etiqueta: "De día" },
              { valor: "si", etiqueta: "De noche" },
            ]}
          />
          <Opciones etiqueta="¿Nació viva?" name="nacido_vivo" opciones={SI_NO} defecto="si" />
          <Casilla name="aborto" etiqueta="Fue un aborto" />
          <Opciones etiqueta="¿Tomó calostro?" name="toma_calostro" opciones={SI_NO} />
          <Texto etiqueta="Persona que la vio tomar calostro" name="persona_calostro" />
          <Opciones etiqueta="¿Expulsó la placenta?" name="placenta_expulsada" opciones={SI_NO} />
          <Opciones etiqueta="¿Se hizo lavado?" name="lavado" opciones={SI_NO} />
          <Observaciones />
          <fieldset className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50/50 p-4">
            <Casilla name="registrar_cria" etiqueta="Registrar la cría" defecto />
            <p className="text-sm text-slate-600">Crea la ficha de la ternera o ternero. No se crea si fue aborto o nació muerta. Elige el sexo arriba.</p>
            <Campo etiqueta="Nombre de la cría">
              <input name="cria_nombre" defaultValue={nombreAnimal ? `Cría de ${nombreAnimal}` : ""} className={control} />
            </Campo>
            <Campo etiqueta="Chapeta de la cría (opcional)">
              <input name="cria_chapeta" inputMode="numeric" className={control} />
            </Campo>
          </fieldset>
        </Formulario>
      );

    case "pesaje":
      return (
        <Formulario titulo="Pesaje" descripcion="Si ya se pesó ese día, se reemplaza." accion={registrarPesaje} volver={volver} paso="accion=pesaje">
          {oculto}
          <CampoFecha />
          <Campo etiqueta="Peso (kg)">
            <input name="peso_kg" type="number" inputMode="decimal" step="0.1" min="1" required placeholder="0" className={`${control} text-2xl font-bold`} />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Altura (cm)">
              <input name="altura_cm" type="number" inputMode="decimal" step="0.1" min="0" className={control} />
            </Campo>
            <Campo etiqueta="Condición corporal" ayuda="De 1 (flaca) a 5 (gorda)">
              <input name="condicion_corporal" type="number" inputMode="decimal" step="0.25" min="1" max="5" className={control} />
            </Campo>
          </div>
          <Observaciones />
        </Formulario>
      );

    case "destete":
      return (
        <Formulario titulo="Destete" descripcion="La cría deja de tomar leche y pasa a levante." accion={registrarDestete} volver={volver} paso="accion=destete" boton="Registrar destete">
          {oculto}
          <CampoFecha etiqueta="Fecha del destete" />
        </Formulario>
      );

    case "secado":
      return (
        <Formulario titulo="Secado" descripcion="La vaca deja de ordeñarse hasta el próximo parto." accion={registrarSecado} volver={volver} paso="accion=secado">
          {oculto}
          <CampoFecha />
          <Campo etiqueta="Motivo">
            <input name="motivo" list="motivos-secado" placeholder="7 meses de preñez" className={control} />
            <datalist id="motivos-secado">
              <option value="7 meses de preñez" />
              <option value="Baja producción" />
              <option value="Enfermedad" />
            </datalist>
          </Campo>
        </Formulario>
      );

    case "salud": {
      const tipo = TIPOS_SALUD.find((t) => t.valor === tipoSalud)?.valor ?? "vacuna";
      return (
        <Formulario
          titulo="Salud"
          accion={registrarSalud}
          volver={volver}
          paso={`accion=salud&tipo=${tipo}`}
          antes={
            <Chips
              items={TIPOS_SALUD.map((t) => ({ href: `${volver}?accion=salud&tipo=${t.valor}`, etiqueta: t.etiqueta, activo: t.valor === tipo }))}
            />
          }
        >
          {oculto}
          <input type="hidden" name="tipo" value={tipo} />
          <CampoFecha />
          {tipo === "mastitis" && (
            <fieldset>
              <legend className="mb-2 font-bold text-slate-800">Cuartos afectados</legend>
              <div className="grid grid-cols-1 gap-2">
                {CUARTOS.map((c) => (
                  <Casilla key={c.valor} name="cuartos" value={c.valor} etiqueta={c.etiqueta} />
                ))}
              </div>
            </fieldset>
          )}
          {tipo !== "vacuna" && <Texto etiqueta="Diagnóstico" name="diagnostico" />}
          <Texto etiqueta={tipo === "vacuna" ? "Vacuna" : "Producto aplicado"} name="producto" requerido={tipo === "vacuna" || tipo === "tratamiento"} />
          <div className="grid grid-cols-2 gap-3">
            <Texto etiqueta="Lote" name="lote" />
            <Texto etiqueta="Registro ICA" name="registro_ica" />
            <Texto etiqueta="Dosis" name="dosis" placeholder="5 ml" />
            <Campo etiqueta="Vía">
              <input name="via_administracion" list="vias" className={control} />
              <datalist id="vias">
                <option value="Intramuscular" />
                <option value="Subcutánea" />
                <option value="Intravenosa" />
                <option value="Intramamaria" />
                <option value="Oral" />
                <option value="Tópica" />
              </datalist>
            </Campo>
          </div>
          {tipo === "vacuna" ? (
            <CampoFecha etiqueta="Próxima dosis" name="proxima_fecha" defecto="" requerido={false} />
          ) : (
            <Campo etiqueta="Días de retiro de leche">
              <input name="dias_retiro" type="number" inputMode="numeric" min="0" className={control} />
            </Campo>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Texto etiqueta="Veterinario" name="veterinario" />
            <Texto etiqueta="T.P. veterinario" name="tarjeta_profesional" />
          </div>
          <Texto etiqueta="Operario" name="operario" />
          <Observaciones />
        </Formulario>
      );
    }

    case "baja":
      return (
        <Formulario
          titulo="Muerte / venta / retiro"
          descripcion="El animal quedará fuera del inventario activo."
          accion={registrarBaja}
          volver={volver}
          paso="accion=baja"
          boton="Registrar salida"
        >
          {oculto}
          <CampoFecha />
          <Opciones
            etiqueta="Tipo"
            name="tipo"
            columnas={3}
            opciones={[
              { valor: "muerte", etiqueta: "Muerte" },
              { valor: "venta", etiqueta: "Venta" },
              { valor: "retiro", etiqueta: "Retiro" },
            ]}
            requerido
          />
          <Texto etiqueta="Causa o motivo" name="causa" placeholder="Enfermedad, baja producción…" />
          <Texto etiqueta="Quién lo lleva" name="responsable_traslado" />
          <Campo etiqueta="Valor de venta (opcional)">
            <input name="valor" type="number" inputMode="numeric" min="0" className={control} />
          </Campo>
        </Formulario>
      );
  }
}

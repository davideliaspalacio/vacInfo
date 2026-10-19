"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, CheckCircle2, Download, LoaderCircle, Search, Upload } from "lucide-react";
import { analizarSeresVivos, importarSeresVivos } from "@/app/(vacinfo)/importar/actions";
import type { FilaVista, ResultadoSeresVivos, VistaPreviaSeresVivos } from "@/lib/importador/seres-vivos-aplicar";
import { CATEGORIAS, ESPECIES, SEXOS } from "@/components/fincas/etiquetas";
import { fecha, num } from "@/lib/formato";
import { BotonPrimario, Etiqueta, Metrica, Tarjeta, TituloTarjeta, Vacio } from "@/components/ui";

const etiqueta = (mapa: Record<string, string>, valor: string) => mapa[valor] ?? valor;

export function ImportadorSeresVivos({ fincas, fincaInicial }: { fincas: { id: string; nombre: string }[]; fincaInicial: string }) {
  const router = useRouter();
  const [fincaId, setFincaId] = useState(fincaInicial);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [vista, setVista] = useState<VistaPreviaSeresVivos | null>(null);
  const [resultado, setResultado] = useState<ResultadoSeresVivos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accion, setAccion] = useState<"analizar" | "importar" | null>(null);
  const [pendiente, iniciar] = useTransition();

  const datos = () => {
    const fd = new FormData();
    fd.set("finca", fincaId);
    if (archivo) fd.set("archivo", archivo);
    return fd;
  };

  const reiniciar = () => {
    setVista(null);
    setResultado(null);
    setError(null);
  };

  const analizar = () => {
    if (!archivo) return setError("Sube la planilla de seres vivos en Excel.");
    reiniciar();
    setAccion("analizar");
    iniciar(async () => {
      const r = await analizarSeresVivos(datos());
      if (r.ok) setVista(r.datos);
      else setError(r.mensaje);
    });
  };

  const importar = () => {
    setError(null);
    setAccion("importar");
    iniciar(async () => {
      const r = await importarSeresVivos(datos());
      if (r.ok) {
        setResultado(r.datos);
        setVista(null);
        router.refresh();
      } else setError(r.mensaje);
    });
  };

  return (
    <div className="space-y-6">
      <Tarjeta>
        <TituloTarjeta detalle="Paso 1">Descarga la plantilla y llénala</TituloTarjeta>
        <p className="text-sm text-tinta-suave">
          La plantilla trae la celda <strong>PERTENECEN A FINCA:</strong> y las columnas de la planilla en papel: #, ESPECIE, RAZA, COLOR, SEXO,
          NOMBRE, FECHA NACIMIENTO, CHAPETA, PESO, PADRE, CHAPETA PADRE, MADRE y CHAPETA MADRE, con 75 filas y una hoja de instrucciones. Se abre en
          Excel y en Google Sheets.
        </p>
        <a
          href="/importar/plantilla-seres-vivos"
          className="boton-accion mt-4 inline-flex items-center gap-2 rounded-xl bg-lima px-5 py-3 font-bold text-bosque"
        >
          <Download className="h-5 w-5" aria-hidden />
          Descargar plantilla (.xlsx)
        </a>
      </Tarjeta>

      <Tarjeta>
        <TituloTarjeta detalle="Paso 2">Elige la finca y sube la planilla</TituloTarjeta>
        <form
          className="grid gap-4 md:grid-cols-[1fr_1.4fr_auto] md:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            analizar();
          }}
        >
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-bosque">Finca</span>
            <select
              className="campo-control"
              value={fincaId}
              onChange={(e) => {
                setFincaId(e.target.value);
                reiniciar();
              }}
            >
              {fincas.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-bosque">Planilla de seres vivos (.xlsx)</span>
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="campo-control file:mr-3 file:rounded-lg file:border-0 file:bg-lima-suave file:px-3 file:py-1 file:font-bold file:text-bosque"
              onChange={(e) => {
                setArchivo(e.target.files?.[0] ?? null);
                reiniciar();
              }}
            />
          </label>
          <BotonPrimario type="submit" disabled={pendiente || !archivo}>
            {pendiente && accion === "analizar" ? (
              <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden />
            ) : (
              <Search className="h-5 w-5" aria-hidden />
            )}
            {pendiente && accion === "analizar" ? "Analizando…" : "Analizar"}
          </BotonPrimario>
        </form>
        <p className="mt-3 text-sm text-tinta-suave">
          Las columnas se reconocen por su título, así que puedes moverlas o agregar columnas propias. La etapa se calcula con la fecha de
          nacimiento y la fecha de hoy: hasta 12 meses ternera o ternero, de 12 a 24 novilla o novillo, y de ahí en adelante vaca o toro. Sin fecha
          de nacimiento la hembra queda como vaca y el macho como toro, y la fila sale marcada. Nada se guarda hasta que confirmes.
        </p>
      </Tarjeta>

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-alerta/30 bg-[#fbe9e5] p-4 text-alerta">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <p className="font-bold">{error}</p>
        </div>
      )}

      {vista && <Vista vista={vista} onImportar={importar} importando={pendiente && accion === "importar"} />}
      {resultado && <Resultado resultado={resultado} />}
    </div>
  );
}

function Vista({ vista, onImportar, importando }: { vista: VistaPreviaSeresVivos; onImportar: () => void; importando: boolean }) {
  return (
    <>
      <Tarjeta>
        <TituloTarjeta detalle={`Paso 3 · ${vista.fincaNombre}`}>Vista previa</TituloTarjeta>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Metrica valor={num(vista.nuevos.length)} etiqueta="Animales nuevos" />
          <Metrica valor={num(vista.existentes.length)} etiqueta="Ya registrados" tono="crema" />
          <Metrica valor={num(vista.pesajes)} etiqueta="Pesos para la curva" tono="crema" />
          <Metrica valor={num(vista.madresEnlazadas)} etiqueta="Madres enlazadas" tono="crema" />
          <Metrica valor={num(vista.omitidas)} etiqueta="Filas omitidas" tono={vista.omitidas ? "alerta" : "crema"} />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <BotonPrimario type="button" onClick={onImportar} disabled={importando || !vista.nuevos.length}>
            {importando ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden /> : <Upload className="h-5 w-5" aria-hidden />}
            {importando ? "Importando…" : "Importar animales"}
          </BotonPrimario>
          <p className="text-sm text-tinta-suave">
            Se crearán {num(vista.nuevos.length)} fichas y {num(vista.pesajes)} pesajes con fecha {fecha(vista.fecha)}. Los animales que ya están en
            la finca no se duplican: puedes subir la misma planilla varias veces.
          </p>
        </div>
      </Tarjeta>

      <Tarjeta>
        <TituloTarjeta detalle={num(vista.nuevos.length)}>Animales que se van a crear</TituloTarjeta>
        <TablaFilas filas={vista.nuevos} />
      </Tarjeta>

      {vista.existentes.length > 0 && (
        <Tarjeta>
          <TituloTarjeta detalle={num(vista.existentes.length)}>Ya registrados en la finca</TituloTarjeta>
          <TablaFilas filas={vista.existentes} />
        </Tarjeta>
      )}

      <Advertencias lista={vista.advertencias} />
    </>
  );
}

function TablaFilas({ filas }: { filas: FilaVista[] }) {
  if (!filas.length) return <Vacio>No hay filas en esta lista.</Vacio>;
  return (
    <div className="max-h-96 overflow-auto">
      <table className="matriz w-full text-left text-sm">
        <thead>
          <tr>
            <th>Fila</th>
            <th>Chapeta</th>
            <th>Nombre</th>
            <th>Código</th>
            <th>Especie</th>
            <th>Etapa</th>
            <th>Sexo</th>
            <th>Nacimiento</th>
            <th className="text-right">Peso</th>
            <th>Madre</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.fila}>
              <td className="text-tinta-suave">{f.fila}</td>
              <td>{f.chapeta ?? "—"}</td>
              <td className="font-bold">{f.nombre}</td>
              <td>{f.codigo}</td>
              <td>{etiqueta(ESPECIES, f.especie)}</td>
              <td>{etiqueta(CATEGORIAS, f.categoria)}</td>
              <td>{etiqueta(SEXOS, f.sexo)}</td>
              <td className="whitespace-nowrap">
                {f.fechaNacimiento ? fecha(f.fechaNacimiento) : <Etiqueta tono="amarillo">Sin fecha</Etiqueta>}
              </td>
              <td className="text-right">{f.pesoKg == null ? "—" : `${num(f.pesoKg)} kg`}</td>
              <td>
                {f.madre ? (
                  <span className="inline-flex items-center gap-2">
                    {f.madre}
                    {f.madreEnlazada && <Etiqueta tono="verde">Enlazada</Etiqueta>}
                  </span>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Advertencias({ lista }: { lista: string[] }) {
  return (
    <Tarjeta>
      <TituloTarjeta detalle={num(lista.length)}>Advertencias</TituloTarjeta>
      {lista.length === 0 ? (
        <Vacio>La planilla no tiene datos dudosos.</Vacio>
      ) : (
        <ul className="max-h-96 space-y-2 overflow-auto text-sm">
          {lista.map((mensaje) => (
            <li key={mensaje} className="flex items-start gap-2 rounded-xl bg-crema px-3 py-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#6b4a09]" aria-hidden />
              <span>{mensaje}</span>
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  );
}

function Resultado({ resultado }: { resultado: ResultadoSeresVivos }) {
  return (
    <>
      <Tarjeta>
        <div className="mb-4 flex items-center gap-3">
          <CheckCircle2 className="h-8 w-8 text-pasto-oscuro" aria-hidden />
          <h2 className="font-display text-2xl font-bold text-bosque">Seres vivos importados</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metrica valor={num(resultado.animales.creados)} etiqueta="Fichas creadas" />
          <Metrica valor={num(resultado.animales.omitidos)} etiqueta="Filas que no se crearon" tono="crema" />
          <Metrica valor={num(resultado.pesajes.creados)} etiqueta="Pesajes creados" tono="crema" />
          <Metrica valor={num(resultado.madresEnlazadas)} etiqueta="Madres enlazadas" tono="crema" />
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/fincas/${resultado.fincaId}`}
            className="boton-accion inline-flex items-center gap-2 rounded-xl bg-bosque px-5 py-3 font-bold text-leche"
          >
            Ver los animales de la finca
            <ArrowRight className="h-5 w-5" aria-hidden />
          </Link>
          <Link
            href={`/fincas/${resultado.fincaId}/levante`}
            className="inline-flex items-center gap-2 rounded-xl border border-bosque/20 px-5 py-3 font-bold text-bosque hover:bg-lima-suave"
          >
            Ver Levante
          </Link>
        </div>
      </Tarjeta>
      <Advertencias lista={resultado.advertencias} />
    </>
  );
}

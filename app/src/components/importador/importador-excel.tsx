"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, CheckCircle2, FileSpreadsheet, LoaderCircle, Search, Upload } from "lucide-react";
import { analizarExcel, importarExcel } from "@/app/(vacinfo)/importar/actions";
import { ETIQUETA_TABLA, TABLAS_EVENTOS, type AnimalVista, type ResultadoImportacion, type VistaPrevia } from "@/lib/importador/aplicar";
import type { Advertencia } from "@/lib/importador/tipos";
import { fecha, num, sumarDias } from "@/lib/formato";
import { BotonPrimario, Etiqueta, Metrica, Tarjeta, TituloTarjeta, Vacio } from "@/components/ui";

export function ImportadorExcel({ fincas, fincaInicial }: { fincas: { id: string; nombre: string }[]; fincaInicial: string }) {
  const router = useRouter();
  const [fincaId, setFincaId] = useState(fincaInicial);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [vista, setVista] = useState<VistaPrevia | null>(null);
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null);
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
    if (!archivo) return setError("Sube el archivo de Excel de la finca.");
    reiniciar();
    setAccion("analizar");
    iniciar(async () => {
      const r = await analizarExcel(datos());
      if (r.ok) setVista(r.datos);
      else setError(r.mensaje);
    });
  };

  const importar = () => {
    setError(null);
    setAccion("importar");
    iniciar(async () => {
      const r = await importarExcel(datos());
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
        <TituloTarjeta detalle="Paso 1">Elige la finca y el archivo</TituloTarjeta>
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
            <span className="mb-1 block text-sm font-bold text-bosque">Libro de planillas (.xlsx)</span>
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
            {pendiente && accion === "analizar" ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden /> : <Search className="h-5 w-5" aria-hidden />}
            {pendiente && accion === "analizar" ? "Analizando…" : "Analizar"}
          </BotonPrimario>
        </form>
        <p className="mt-3 text-sm text-tinta-suave">
          Se leen todas las hojas quincenales (nombre con la fecha de corte, p. ej. 30426). Las columnas se reconocen por su título, así que sirven
          planillas antiguas y nuevas. Nada se guarda hasta que confirmes.
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

function Vista({ vista, onImportar, importando }: { vista: VistaPrevia; onImportar: () => void; importando: boolean }) {
  const totalNuevos = TABLAS_EVENTOS.reduce((s, t) => s + vista.eventos[t].nuevos, 0);

  return (
    <>
      <Tarjeta>
        <TituloTarjeta detalle={`Paso 2 · ${vista.fincaNombre}`}>Vista previa</TituloTarjeta>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metrica valor={num(vista.hojas.length)} etiqueta="Planillas quincenales" />
          <Metrica valor={vista.desde ? `${fecha(vista.desde)} – ${fecha(vista.hasta)}` : "—"} etiqueta="Rango de cortes" tono="crema" />
          <Metrica valor={num(vista.animalesNuevos.length)} etiqueta="Vacas nuevas" />
          <Metrica valor={num(vista.animalesExistentes.length)} etiqueta="Vacas ya registradas" tono="crema" />
        </div>

        <h3 className="mt-6 mb-2 font-bold text-bosque">Eventos por tipo</h3>
        <div className="overflow-x-auto">
          <table className="matriz w-full text-left">
            <thead>
              <tr>
                <th>Tipo</th>
                <th className="text-right">Nuevos</th>
                <th className="text-right">Ya existentes</th>
              </tr>
            </thead>
            <tbody>
              {TABLAS_EVENTOS.map((t) => (
                <tr key={t}>
                  <td>{ETIQUETA_TABLA[t]}</td>
                  <td className="text-right font-bold">{num(vista.eventos[t].nuevos)}</td>
                  <td className="text-right text-tinta-suave">{num(vista.eventos[t].existentes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <BotonPrimario type="button" onClick={onImportar} disabled={importando}>
            {importando ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden /> : <Upload className="h-5 w-5" aria-hidden />}
            {importando ? "Importando…" : "Importar"}
          </BotonPrimario>
          <p className="text-sm text-tinta-suave">
            Se crearán {num(vista.animalesNuevos.length)} vacas y {num(totalNuevos)} registros. Lo que ya existe no se duplica: puedes importar el mismo
            archivo varias veces.
          </p>
        </div>
      </Tarjeta>

      <div className="grid gap-6 lg:grid-cols-2">
        <Tarjeta>
          <TituloTarjeta detalle={num(vista.animalesNuevos.length)}>Vacas nuevas</TituloTarjeta>
          <ListaAnimales animales={vista.animalesNuevos} nuevas ultimaHoja={vista.hojas.at(-1)?.nombre} />
        </Tarjeta>
        <Tarjeta>
          <TituloTarjeta detalle={num(vista.animalesExistentes.length)}>Vacas ya registradas</TituloTarjeta>
          <ListaAnimales animales={vista.animalesExistentes} />
        </Tarjeta>
      </div>

      <Advertencias lista={vista.advertencias} />

      <Tarjeta>
        <TituloTarjeta detalle={num(vista.hojas.length)}>Hojas detectadas</TituloTarjeta>
        <div className="flex flex-wrap gap-2">
          {vista.hojas.map((h) => (
            <span key={h.nombre} className="rounded-xl border border-bosque/15 px-3 py-1 text-sm" title={`${h.filas} filas`}>
              <strong className="text-bosque">{h.nombre}</strong> <span className="text-tinta-suave">· {fecha(h.fechaCorte)}</span>
            </span>
          ))}
        </div>
      </Tarjeta>
    </>
  );
}

function ListaAnimales({ animales, nuevas = false, ultimaHoja }: { animales: AnimalVista[]; nuevas?: boolean; ultimaHoja?: string }) {
  if (!animales.length) return <Vacio>{nuevas ? "Todas las vacas del archivo ya están registradas." : "Ninguna vaca del archivo está registrada aún."}</Vacio>;
  return (
    <div className="max-h-96 overflow-auto">
      <table className="matriz w-full text-left text-sm">
        <thead>
          <tr>
            <th>Chapeta</th>
            <th>Nombre</th>
            <th>Código</th>
            <th>Planillas</th>
          </tr>
        </thead>
        <tbody>
          {animales.map((a) => (
            <tr key={`${a.chapeta}-${a.nombre}`}>
              <td>{a.chapeta}</td>
              <td className="font-bold">{a.nombre}</td>
              <td>{a.codigo}</td>
              <td>
                {a.primeraHoja === a.ultimaHoja ? a.primeraHoja : `${a.primeraHoja} → ${a.ultimaHoja}`}{" "}
                {nuevas && !a.enUltimaHoja && (
                  <span title={`No aparece en la hoja ${ultimaHoja ?? "más reciente"}`}>
                    <Etiqueta tono="amarillo">Quedará retirada</Etiqueta>
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Advertencias({ lista }: { lista: Advertencia[] }) {
  return (
    <Tarjeta>
      <TituloTarjeta detalle={num(lista.length)}>Advertencias</TituloTarjeta>
      {lista.length === 0 ? (
        <Vacio>El archivo no tiene datos dudosos.</Vacio>
      ) : (
        <ul className="max-h-96 space-y-2 overflow-auto text-sm">
          {lista.map((a) => (
            <li key={a.mensaje} className="flex items-start gap-2 rounded-xl bg-crema px-3 py-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#6b4a09]" aria-hidden />
              <span>
                {a.mensaje}{" "}
                {a.hojas[0] !== "todas" && (
                  <span className="text-tinta-suave">
                    ({a.hojas.length === 1 ? `hoja ${a.hojas[0]}` : `${a.hojas.length} hojas: ${a.hojas.slice(0, 3).join(", ")}${a.hojas.length > 3 ? "…" : ""}`})
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  );
}

function Resultado({ resultado }: { resultado: ResultadoImportacion }) {
  const filas = (["animales", ...TABLAS_EVENTOS] as const).map((t) => ({ t, ...resultado.conteos[t] }));
  const hasta = resultado.hasta;
  const informe = hasta
    ? `/informes?finca=${resultado.fincaId}&tab=operativo&desde=${sumarDias(hasta, -15)}&hasta=${hasta}`
    : `/informes?finca=${resultado.fincaId}&tab=operativo`;

  return (
    <Tarjeta>
      <div className="mb-4 flex items-center gap-3">
        <CheckCircle2 className="h-8 w-8 text-pasto-oscuro" aria-hidden />
        <h2 className="font-display text-2xl font-bold text-bosque">Importación terminada</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="matriz w-full text-left">
          <thead>
            <tr>
              <th>Tabla</th>
              <th className="text-right">Creados</th>
              <th className="text-right">Ya existían</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.t}>
                <td>{ETIQUETA_TABLA[f.t]}</td>
                <td className="text-right font-bold">{num(f.creados)}</td>
                <td className="text-right text-tinta-suave">{num(f.omitidos)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href={`/fincas/${resultado.fincaId}`} className="boton-accion inline-flex items-center gap-2 rounded-xl bg-bosque px-5 py-3 font-bold text-leche">
          Ver finca
          <ArrowRight className="h-5 w-5" aria-hidden />
        </Link>
        <Link href={informe} className="inline-flex items-center gap-2 rounded-xl border border-bosque/20 px-5 py-3 font-bold text-bosque hover:bg-lima-suave">
          <FileSpreadsheet className="h-5 w-5" aria-hidden />
          Informe operativo
        </Link>
      </div>
    </Tarjeta>
  );
}

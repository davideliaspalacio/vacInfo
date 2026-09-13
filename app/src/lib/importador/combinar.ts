import type { AnimalPlan, HojaLeida, PlanImportacion } from "./tipos";
import type { LibroLeido } from "./leer";
import {
  claveAnimal,
  diasEntre,
  normalizarChapeta,
  normalizarInseminador,
  normalizarNombre,
  normalizarPalpador,
  normalizarRaza,
  normalizarToro,
} from "./normalizar";

class Avisos {
  private porMensaje = new Map<string, Set<string>>();
  add(mensaje: string, hoja: string) {
    const s = this.porMensaje.get(mensaje) ?? new Set();
    s.add(hoja);
    this.porMensaje.set(mensaje, s);
  }
  lista() {
    return [...this.porMensaje].map(([mensaje, hojas]) => ({ mensaje, hojas: [...hojas] }));
  }
}

/** Mezcla un valor nuevo sobre uno existente: gana el de la hoja más reciente si no está vacío. */
const pref = <T>(anterior: T | null, nuevo: T | null) => (nuevo ?? anterior);

/**
 * Une todas las hojas en un plan por animal (chapeta + nombre), sin eventos repetidos por (animal, fecha).
 * Las hojas se recorren de la más antigua a la más reciente.
 */
export function combinarHojas(libro: LibroLeido): PlanImportacion {
  const hojas = [...libro.hojas].sort((a, b) => a.fechaCorte.localeCompare(b.fechaCorte) || a.nombre.localeCompare(b.nombre));
  const avisos = new Avisos();
  const ultima = hojas.at(-1);
  const limite = ultima?.fechaCorte ?? "9999-12-31";

  type Acumulado = {
    chapeta: string;
    nombre: string;
    hojas: string[];
    partos: Map<string, AnimalPlan["partos"][number]>;
    servicios: Map<string, AnimalPlan["servicios"][number]>;
    palpaciones: Map<string, AnimalPlan["palpaciones"][number]>;
    secados: Set<string>;
    ordenos: Map<string, AnimalPlan["ordenos"][number]>;
    sanidad: Map<string, AnimalPlan["sanidad"][number]>;
  };
  const animales = new Map<string, Acumulado>();

  // Filas sin chapeta: se asignan por nombre si en el archivo hay una sola vaca con ese nombre.
  const chapetasPorNombre = new Map<string, Set<string>>();
  for (const h of hojas)
    for (const f of h.filas)
      if (f.chapeta) {
        const n = normalizarNombre(f.nombre);
        chapetasPorNombre.set(n, (chapetasPorNombre.get(n) ?? new Set()).add(f.chapeta));
      }

  for (const hoja of hojas) {
    for (const a of hoja.advertencias) avisos.add(a, hoja.nombre);
    procesarHoja(hoja);
  }

  function procesarHoja(hoja: HojaLeida) {
    const corte = hoja.fechaCorte;
    for (const fila of hoja.filas) {
      let chapeta = fila.chapeta;
      if (!chapeta) {
        const posibles = chapetasPorNombre.get(normalizarNombre(fila.nombre));
        if (posibles?.size === 1) chapeta = [...posibles][0];
        else {
          avisos.add(`${fila.nombre}: fila sin chapeta; no se importó.`, hoja.nombre);
          continue;
        }
      }
      const clave = claveAnimal(chapeta, fila.nombre);
      let an = animales.get(clave);
      if (!an) {
        an = {
          chapeta: normalizarChapeta(chapeta),
          nombre: fila.nombre,
          hojas: [],
          partos: new Map(),
          servicios: new Map(),
          palpaciones: new Map(),
          secados: new Set(),
          ordenos: new Map(),
          sanidad: new Map(),
        };
        animales.set(clave, an);
      }
      if (an.hojas.at(-1) !== hoja.nombre) an.hojas.push(hoja.nombre);
      an.nombre = fila.nombre;
      const quien = `${fila.nombre} (${chapeta})`;

      // Las planillas se completan días después del corte; solo se descarta lo posterior a la última hoja.
      const futura = (fecha: string, que: string) => {
        if (fecha <= limite) return false;
        avisos.add(`${quien}: ${que} del ${fecha} es posterior a la última planilla (${limite}); no se importó.`, hoja.nombre);
        return true;
      };

      const agregarParto = (fecha: string, datos: Partial<AnimalPlan["partos"][number]>) => {
        if (futura(fecha, "parto")) return;
        const previo = an.partos.get(fecha);
        an.partos.set(fecha, {
          fecha,
          criaSexo: pref(previo?.criaSexo ?? null, datos.criaSexo ?? null),
          aborto: (previo?.aborto ?? false) || !!datos.aborto,
          lavado: (previo?.lavado ?? false) || !!datos.lavado,
          observaciones: pref(previo?.observaciones ?? null, datos.observaciones ?? null),
        });
      };

      for (const f of fila.partosAnteriores) agregarParto(f, {});
      if (fila.fechaCrio) {
        agregarParto(fila.fechaCrio, {
          criaSexo: fila.bloque === 1 ? fila.criaSexo : null,
          lavado: fila.lavado,
          observaciones: fila.mellizos ? "Mellizos" : null,
        });
      }
      if (fila.aborto) {
        if (fila.fechaEnCrio) agregarParto(fila.fechaEnCrio, { aborto: true, observaciones: "Aborto" });
        else if (![...an.partos.values()].some((p) => p.aborto))
          avisos.add(`${quien}: marcada con aborto pero sin fecha; no se registró.`, hoja.nombre);
      } else if (fila.fechaEnCrio && !an.partos.get(fila.fechaEnCrio)?.aborto) {
        avisos.add(`${quien}: fecha ${fila.fechaEnCrio} escrita en CRIO sin marca de aborto; se ignoró.`, hoja.nombre);
      }

      if (fila.servicio && !futura(fila.servicio.fecha, "servicio")) {
        const s = fila.servicio;
        const previo = an.servicios.get(s.fecha);
        an.servicios.set(s.fecha, {
          fecha: s.fecha,
          toro: pref(previo?.toro ?? null, normalizarToro(s.toro)),
          raza: pref(previo?.raza ?? null, normalizarRaza(s.raza)),
          inseminador: pref(previo?.inseminador ?? null, normalizarInseminador(s.inseminador)),
        });
      }

      if (fila.palpacion?.prenada && !futura(fila.palpacion.fecha, "palpación")) {
        const p = fila.palpacion;
        const servida = fila.servicio?.fecha;
        const dias = servida && servida <= p.fecha ? diasEntre(servida, p.fecha) : null;
        const previo = an.palpaciones.get(p.fecha);
        an.palpaciones.set(p.fecha, {
          fecha: p.fecha,
          diasPrenez: pref(previo?.diasPrenez ?? null, dias),
          veterinario: pref(previo?.veterinario ?? null, normalizarPalpador(p.palpador)),
        });
      }

      if (fila.secado && !futura(fila.secado, "secado")) an.secados.add(fila.secado);

      const { tarde, manana } = fila.leche;
      if (tarde != null && tarde >= 0) an.ordenos.set(`${corte}|pm`, { fecha: corte, jornada: "pm", litros: tarde });
      if (manana != null && manana >= 0) an.ordenos.set(`${corte}|am`, { fecha: corte, jornada: "am", litros: manana });

      for (const tipo of fila.sanidad.tipos) {
        an.sanidad.set(`${corte}|${tipo}`, { fecha: corte, tipo, cuartos: tipo === "mastitis" ? fila.sanidad.cuartos : [] });
      }
    }
  }

  const porFecha = <T extends { fecha: string }>(m: Iterable<T>) => [...m].sort((a, b) => a.fecha.localeCompare(b.fecha));

  const lista: AnimalPlan[] = [...animales].map(([clave, a]) => ({
    clave,
    chapeta: a.chapeta,
    nombre: a.nombre,
    primeraHoja: a.hojas[0],
    ultimaHoja: a.hojas.at(-1)!,
    hojas: a.hojas.length,
    enUltimaHoja: a.hojas.at(-1) === ultima?.nombre,
    partos: porFecha(a.partos.values()),
    servicios: porFecha(a.servicios.values()),
    palpaciones: porFecha(a.palpaciones.values()),
    secados: [...a.secados].sort(),
    ordenos: [...a.ordenos.values()].sort((x, y) => x.fecha.localeCompare(y.fecha) || x.jornada.localeCompare(y.jornada)),
    sanidad: [...a.sanidad.values()].sort((x, y) => x.fecha.localeCompare(y.fecha) || x.tipo.localeCompare(y.tipo)),
  }));
  lista.sort((a, b) => a.nombre.localeCompare(b.nombre, "es") || a.chapeta.localeCompare(b.chapeta));

  // Misma chapeta con nombres distintos: se importan como animales distintos, pero conviene revisarlo.
  const porChapeta = new Map<string, string[]>();
  for (const a of lista) porChapeta.set(a.chapeta, [...(porChapeta.get(a.chapeta) ?? []), a.nombre]);
  for (const [chapeta, nombres] of porChapeta)
    if (nombres.length > 1) avisos.add(`La chapeta ${chapeta} la usan ${nombres.join(" y ")}; se importan como vacas distintas.`, "todas");

  for (const nombre of libro.ignoradas) avisos.add(`Hoja «${nombre}» ignorada: no es una planilla quincenal.`, nombre);

  return {
    hojas: hojas.map((h) => ({ nombre: h.nombre, fechaCorte: h.fechaCorte, filas: h.filas.length })),
    desde: hojas[0]?.fechaCorte ?? null,
    hasta: ultima?.fechaCorte ?? null,
    animales: lista,
    advertencias: avisos.lista(),
  };
}

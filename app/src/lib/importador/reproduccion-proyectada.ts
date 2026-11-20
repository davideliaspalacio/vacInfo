/**
 * Proyección de los «datos de vacas productivas» para las PANTALLAS DE CAPTURA.
 *
 * Qué resuelve: la planilla del cliente trae seis columnas en el bloque «DATOS DE VACAS PRODUCTIVOS»,
 * pero solo dos son datos (FECHA ÚLTIMO PARTO y FECHA SERVIDA). Las otras cuatro —DÍAS ORDEÑO,
 * MORA PREÑEZ, FECHA POSIBLE DE SECADO y POSIBLE FECHA NACIMIENTO CRÍA— **las calcula el sistema** y
 * no se guardan. Para que el ganadero vea que cuadran antes de confirmar, la vista previa del
 * importador y el formulario de ser vivo las muestran calculadas aquí, en el navegador, sobre las dos
 * fechas que acaba de escribir (el animal todavía no existe en la base, así que no hay a quién
 * preguntarle).
 *
 * La mora se lee siempre con `leerMora` de `lib/mora.ts` (contador con signo: −45 el día del parto,
 * 0 el día 45 y positiva después), para que se vea igual en toda la aplicación.
 *
 * **Esta no es la fuente de la verdad.** Los números que se muestran en las fichas, los informes, el
 * calendario y las alertas salen de `estado_reproductivo` en Postgres, que es el único cálculo
 * oficial. Este módulo es su espejo para la captura y por eso:
 *  - solo se usa en vistas previas y en campos de solo lectura, nunca para guardar nada;
 *  - sus tres constantes están aquí, en un solo lugar, para poder seguir a la función SQL;
 *  - la prueba de integración de `src/lib/importador` compara esta proyección con lo que devuelve
 *    `estado_reproductivo` para los mismos animales, así que si la función cambia la prueba avisa.
 *
 * Diferencia a propósito con la función: `estado_reproductivo` solo da la fecha de secado y el parto
 * esperado cuando una palpación confirmó la preñez. En la captura todavía no hay palpación, así que
 * aquí se muestran como «posibles» a partir de la fecha servida, igual que las nombra el cliente
 * («FECHA POSIBLE DE SECADO», «POSIBLE FECHA NACIMIENTO CRÍA»).
 */
// Ruta relativa (no alias) para que vitest resuelva el módulo sin configuración extra.
import { DIAS_MORA_PRENEZ } from "../mora";
import { diasEntre, sumarDiasISO } from "./normalizar";

/**
 * Días de descanso post parto desde los que se cuenta la mora: la constante vive en `lib/mora.ts`,
 * junto a la forma de leerla, para que el día que cambie el número cambie en un solo lugar.
 */
export { DIAS_MORA_PRENEZ };

/** Días entre el servicio y el secado sugerido (`estado_reproductivo`: servicio + 210). */
export const DIAS_SECADO_TRAS_SERVICIO = 210;

/** Días de gestación (`estado_reproductivo`: servicio + 280 = parto esperado). */
export const DIAS_GESTACION = 280;

/** Los dos datos que se capturan del bloque de vacas productivas. */
export interface DatosProductivos {
  /** Fecha del último parto (ISO). */
  ultimoParto: string | null;
  /** Fecha del último servicio o monta (ISO). */
  fechaServida: string | null;
  /** `true` si la vaca está seca (en el importador, EN ORDEÑO = no): sin días en ordeño ni mora. */
  seca?: boolean;
}

/** Los cuatro datos que el sistema calcula y no guarda. */
export interface ProyeccionProductiva {
  diasOrdeno: number | null;
  /** Días de mora con signo: negativo = todavía no debe estar servida. */
  moraPrenez: number | null;
  secadoEl: string | null;
  partoEsperado: string | null;
}

export const PROYECCION_VACIA: ProyeccionProductiva = { diasOrdeno: null, moraPrenez: null, secadoEl: null, partoEsperado: null };

/**
 * Calcula los cuatro datos derivados a la fecha `hoy`. Espejo de `estado_reproductivo` para la
 * captura; la base vuelve a calcularlos al guardar y esos son los que manda.
 */
export function proyectarDatosProductivos({ ultimoParto, fechaServida, seca = false }: DatosProductivos, hoy: string): ProyeccionProductiva {
  const enOrdeno = !!ultimoParto && !seca;
  const dias = enOrdeno ? Math.max(0, diasEntre(ultimoParto!, hoy)) : null;
  return {
    diasOrdeno: dias,
    moraPrenez: dias == null ? null : dias - DIAS_MORA_PRENEZ,
    secadoEl: fechaServida ? sumarDiasISO(fechaServida, DIAS_SECADO_TRAS_SERVICIO) : null,
    partoEsperado: fechaServida ? sumarDiasISO(fechaServida, DIAS_GESTACION) : null,
  };
}

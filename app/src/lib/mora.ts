/**
 * Mora de preñez: cómo se lee el contador con signo que trae `estado_reproductivo.mora_prenez`.
 *
 * Tal como lo pidió el cliente, los primeros 45 días después del parto la vaca descansa: el número
 * empieza en −45 y sube hasta 0, y eso **no es una alarma**, es tiempo de recuperación. Pasado el
 * día 0 el número se vuelve positivo y ahí sí son días de retraso para inseminar. Cuando una
 * palpación confirma la preñez el contador queda congelado en el día del servicio que la preñó, así
 * que ese valor ya es historia (no hay nada que hacer) y se muestra apagado.
 *
 * Los mismos umbrales de `alertas_finca`: media pasado el día 0, alta por encima de 60.
 */

/** Días de descanso post parto antes de que empiecen a contar los retrasos. */
export const DIAS_MORA_PRENEZ = 45;
/** Desde aquí el retraso para inseminar es alerta alta. */
export const UMBRAL_MORA_ALTA = 60;

export type NivelMora = "congelada" | "descanso" | "al_dia" | "retraso" | "retraso_alto";

export type Mora = {
  dias: number;
  nivel: NivelMora;
  /** El número con su signo, tal cual va en la celda. */
  valor: string;
  /** Palabra corta al lado del número; vacía cuando el número se explica solo. */
  corta: string;
  /** Frase completa, para el `title` de la celda. */
  detalle: string;
  /** Clases de color: solo los retrasos vivos se pintan de alerta. */
  clase: string;
};

/**
 * @param dias       `mora_prenez` de `estado_reproductivo` (nula si la vaca no está en ordeño).
 * @param congelada  la preñez ya está confirmada por palpación: el contador se paró.
 */
export function leerMora(dias: number | null | undefined, congelada = false): Mora | null {
  if (dias == null) return null;
  const valor = dias > 0 ? `+${dias}` : String(dias);

  if (congelada) {
    const detalle =
      dias < 0
        ? `Mora cerrada el día del servicio: la inseminaron ${-dias} días antes de terminar el descanso`
        : dias === 0
          ? "Mora cerrada el día del servicio: la inseminaron justo al terminar el descanso"
          : `Mora cerrada el día del servicio: la inseminaron ${dias} días tarde`;
    return { dias, nivel: "congelada", valor, corta: "cerrada", detalle, clase: "text-tinta-suave" };
  }

  if (dias < 0) {
    return {
      dias,
      nivel: "descanso",
      valor,
      corta: "descanso",
      detalle: `Está en descanso, falta${-dias === 1 ? "" : "n"} ${-dias} día${-dias === 1 ? "" : "s"} para poder inseminar`,
      clase: "text-pasto-oscuro",
    };
  }

  if (dias === 0) {
    return {
      dias,
      nivel: "al_dia",
      valor,
      corta: "lista",
      detalle: `Terminó la mora de preñez de ${DIAS_MORA_PRENEZ} días: ya se puede inseminar`,
      clase: "font-bold text-pasto-oscuro",
    };
  }

  const detalle = `Lleva ${dias} días de retraso para inseminar`;
  return dias > UMBRAL_MORA_ALTA
    ? { dias, nivel: "retraso_alto", valor, corta: "", detalle, clase: "font-bold text-alerta" }
    : { dias, nivel: "retraso", valor, corta: "", detalle, clase: "font-bold text-cafe" };
}

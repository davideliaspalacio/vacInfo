// Cálculo puro del conteo de animales (sin Supabase ni alias "@/", para poder probarlo con vitest).
import { ANIMALES_VACIOS, type ConteoAnimales } from "../../lib/finanzas";

/**
 * Cantidad de animales de una finca en una fecha, calculada con los datos reales (fichas, partos,
 * secados y bajas). Reemplaza los conteos que antes se escribían a mano en los parámetros de costos:
 * para cambiarlos hay que registrar la muerte/venta en la ficha o crear la ficha del ser vivo.
 *
 * Reglas (mismas que `estado_reproductivo`):
 * - Existe en la fecha si nació ese día o antes (sin fecha de nacimiento se asume que ya existía) y,
 *   si ya no está activo, su baja es posterior a la fecha. Sin baja registrada no se sabe cuándo
 *   salió, así que no se cuenta.
 * - Hembra bovina con parto hasta la fecha, o de categoría vaca → vaca. En ordeño si su último
 *   secado es anterior al último parto; si no, seca.
 * - El resto por categoría actual. "ternerona" (etapa eliminada) cuenta como novilla; una "novilla"
 *   macho, como novillo.
 */

export type AnimalConteo = {
  id: string;
  categoria: string;
  especie: string;
  sexo: string;
  estado: string;
  fecha_nacimiento: string | null;
  bajas: { fecha: string }[] | null;
};

export type EventoConteo = { animal_id: string; fecha: string };

export function contarAnimales(animales: AnimalConteo[], partos: EventoConteo[], secados: EventoConteo[], fecha: string): ConteoAnimales {
  const ultimo = (eventos: EventoConteo[]) => {
    const m = new Map<string, string>();
    for (const e of eventos) if (e.fecha <= fecha && e.fecha > (m.get(e.animal_id) ?? "")) m.set(e.animal_id, e.fecha);
    return m;
  };
  const ultParto = ultimo(partos);
  const ultSecado = ultimo(secados);
  const c: ConteoAnimales = { ...ANIMALES_VACIOS };

  for (const a of animales) {
    if (a.fecha_nacimiento && a.fecha_nacimiento > fecha) continue;
    if (a.estado !== "activo") {
      const baja = (a.bajas ?? []).map((b) => b.fecha).sort()[0];
      if (!baja || baja <= fecha) continue;
    }
    const hembra = a.sexo === "hembra";
    const parto = ultParto.get(a.id);
    if (hembra && a.especie === "bovino" && (parto || a.categoria === "vaca")) {
      const secado = ultSecado.get(a.id);
      if (parto && (!secado || secado < parto)) c.vacas_produccion++;
      else c.vacas_secas++;
      continue;
    }
    switch (a.categoria) {
      case "novilla":
      case "novillo":
      case "ternerona":
        if (hembra) c.novillas++;
        else c.novillos++;
        break;
      case "ternera":
      case "ternero":
        if (hembra) c.terneras++;
        else c.terneros++;
        break;
      case "toro":
        c.toros++;
        break;
      case "caballo":
        c.caballos++;
        break;
      case "perro":
        c.perros++;
        break;
      default:
        if (a.especie === "equino") c.caballos++;
        else if (a.especie === "canino") c.perros++;
        else c.otros++;
    }
  }
  return c;
}

/** Último día del mes de un periodo 'YYYY-MM-01'. */
export function finDePeriodo(periodo: string) {
  const [y, m] = periodo.split("-").map(Number);
  const dia = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${periodo.slice(0, 7)}-${String(dia).padStart(2, "0")}`;
}

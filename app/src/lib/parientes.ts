/**
 * Categorías, especie, sexo y candidatos a madre/padre del formulario de ser vivo.
 * Sin dependencias de Next ni Supabase para poder probarse con vitest.
 *
 * Etapas bovinas: hembras ternera → novilla → vaca; machos ternero → novillo → toro.
 */

export type Especie = "bovino" | "equino" | "canino" | "ave" | "otro";
export type Sexo = "hembra" | "macho";

/** Categorías que se pueden elegir al crear o editar (sin "ternerona"). */
export const CATEGORIAS_FORMULARIO = ["ternera", "novilla", "vaca", "ternero", "novillo", "toro", "caballo", "perro", "otro"] as const;
export type CategoriaFormulario = (typeof CATEGORIAS_FORMULARIO)[number];

/** Especie de cada categoría (incluye la etapa eliminada "ternerona" para fichas viejas). */
export function especieDeCategoria(categoria: string): Especie {
  switch (categoria) {
    case "caballo":
      return "equino";
    case "perro":
      return "canino";
    case "otro":
      return "otro";
    default:
      return "bovino";
  }
}

const HEMBRAS_BOVINAS = ["ternera", "novilla", "vaca", "ternerona"];
const MACHOS_BOVINOS = ["ternero", "novillo", "toro"];

/** Sexo fijo de las categorías bovinas; null si el sexo se elige (caballo, perro, otro). */
export function sexoDeCategoria(categoria: string): Sexo | null {
  if (HEMBRAS_BOVINAS.includes(categoria)) return "hembra";
  if (MACHOS_BOVINOS.includes(categoria)) return "macho";
  return null;
}

/** Categoría a mostrar en el formulario para una ficha existente (ternerona → novilla). */
export function categoriaFormulario(categoria: string | null | undefined): CategoriaFormulario {
  if (categoria === "ternerona") return "novilla";
  return (CATEGORIAS_FORMULARIO as readonly string[]).includes(categoria ?? "") ? (categoria as CategoriaFormulario) : "vaca";
}

export type Candidato = {
  id: string;
  nombre: string;
  chapeta: string | null;
  finca_id: string;
  categoria: string;
  especie: string;
  sexo: string;
  estado: string;
};

type Contexto = { fincaId: string; categoria: string; excluirId?: string | null };

const porNombre = (a: Candidato, b: Candidato) => a.nombre.localeCompare(b.nombre, "es") || a.id.localeCompare(b.id);
const activoPrimero = (a: Candidato, b: Candidato) => Number(a.estado !== "activo") - Number(b.estado !== "activo");

/**
 * Madres posibles: hembras de la misma finca y de la misma especie que la categoría elegida, sin el propio animal.
 * En bovinos van primero las vacas y novillas; en cada grupo, activas primero y por nombre.
 */
export function madresPosibles(candidatos: Candidato[], { fincaId, categoria, excluirId }: Contexto) {
  const especie = especieDeCategoria(categoria);
  const adulta = (c: Candidato) => (especie === "bovino" && !["vaca", "novilla"].includes(c.categoria) ? 1 : 0);
  return candidatos
    .filter((c) => c.finca_id === fincaId && c.id !== excluirId && c.sexo === "hembra" && c.especie === especie)
    .sort((a, b) => adulta(a) - adulta(b) || activoPrimero(a, b) || porNombre(a, b));
}

/**
 * Padres posibles registrados en la finca: machos de la misma especie, sin el propio animal.
 * En bovinos solo toros y novillos (toros primero).
 */
export function padresPosibles(candidatos: Candidato[], { fincaId, categoria, excluirId }: Contexto) {
  const especie = especieDeCategoria(categoria);
  const orden = (c: Candidato) => (c.categoria === "toro" ? 0 : 1);
  return candidatos
    .filter(
      (c) =>
        c.finca_id === fincaId &&
        c.id !== excluirId &&
        c.sexo === "macho" &&
        c.especie === especie &&
        (especie !== "bovino" || MACHOS_BOVINOS.slice(1).includes(c.categoria)),
    )
    .sort((a, b) => orden(a) - orden(b) || activoPrimero(a, b) || porNombre(a, b));
}

export type ToroServicio = { finca_id: string; nombre: string };

/** Nombres de toros usados en servicios de la finca: solo aplican a bovinos y sin repetir los que ya son fichas. */
export function torosDeServiciosPosibles(toros: ToroServicio[], padres: Candidato[], { fincaId, categoria }: Contexto) {
  if (especieDeCategoria(categoria) !== "bovino") return [];
  const fichas = new Set(padres.map((p) => p.nombre.trim().toLowerCase()));
  return toros.filter((t) => t.finca_id === fincaId && !fichas.has(t.nombre.trim().toLowerCase()));
}

/** Error de validación de la madre elegida, o null si sirve. */
export function errorMadre(madre: Pick<Candidato, "id" | "finca_id" | "sexo" | "especie"> | null, { fincaId, categoria, excluirId }: Contexto) {
  if (!madre) return "La madre no existe o no tienes acceso a ella";
  if (excluirId && madre.id === excluirId) return "Un animal no puede ser su propia madre";
  if (madre.finca_id !== fincaId) return "La madre debe ser de la misma finca";
  if (madre.sexo !== "hembra") return "La madre debe ser una hembra";
  if (madre.especie !== especieDeCategoria(categoria)) return "La madre debe ser de la misma especie";
  return null;
}

import type { Database } from "@/lib/database.types";

/** Una fila de `revision_etapas`: un animal en uno de los casos a revisar. */
export type FilaRevision = Database["public"]["Functions"]["revision_etapas"]["Returns"][number];

export type Caso = "pendiente" | "sin_nacimiento" | "vaca_joven_sin_datos" | "vaca_sin_historial" | "novilla_con_ordenos";

export type DefinicionCaso = {
  caso: Caso;
  titulo: string;
  /** Qué les pasa a estos animales, en español llano. */
  explicacion: string;
  /** Qué hay que hacer con ellos. */
  queHacer: string;
  vacio: string;
  /** `aplicar` = el botón manda a aplicar la regla; `bajar` = baja la etapa a mano; sin acción = solo se señala. */
  accion?: "aplicar" | "bajar";
};

/**
 * Orden de la pantalla: primero lo que la regla arregla sola, y después los casos dudosos
 * empezando por la fecha de nacimiento, que es la que desbloquea a los demás.
 */
export const CASOS: DefinicionCaso[] = [
  {
    caso: "pendiente",
    titulo: "La regla cambiaría su etapa",
    explicacion:
      "Sus registros (un parto, ordeños) o su edad dicen que estos animales están en otra etapa. El sistema los corrige solo al guardar la ficha y en la revisión diaria, pero aquí puedes adelantarlo.",
    queHacer: "Revisa que el cambio tenga sentido y aplícalo a todos o uno por uno.",
    vacio: "Ningún animal está en una etapa distinta de la que le corresponde.",
    accion: "aplicar",
  },
  {
    caso: "sin_nacimiento",
    titulo: "Sin fecha de nacimiento",
    explicacion:
      "Sin la fecha de nacimiento no se puede saber la edad, y sin edad la etapa no se puede calcular. Es el dato más importante de la lista: al llenarlo se destraban los demás casos.",
    queHacer: "Abre la ficha y escribe la fecha de nacimiento, o cárgala con la plantilla de seres vivos en «Importar».",
    vacio: "Todos los animales que dependen de la edad tienen su fecha de nacimiento.",
  },
  {
    caso: "vaca_joven_sin_datos",
    titulo: "Vacas de menos de 36 meses sin ningún registro",
    explicacion:
      "No tienen parto, ni ordeños, ni servicio, ni palpación, y todavía no cumplen 36 meses: lo más probable es que sean novillas que la regla vieja subió a vaca solo por la edad. Como la etapa nunca baja sola, hay que bajarla a mano.",
    queHacer: "Si de verdad son novillas, bájalas aquí. Si ya parieron, registra el parto y la etapa volverá a vaca sola.",
    vacio: "No hay vacas jóvenes sin un solo registro.",
    accion: "bajar",
  },
  {
    caso: "vaca_sin_historial",
    titulo: "Vacas sin partos ni ordeños",
    explicacion: "Están registradas como vacas, pero no tienen un solo parto ni un solo ordeño: casi siempre son hatos que se cargaron sin su historial.",
    queHacer: "Carga el historial con la plantilla de seres vivos en «Importar», o registra al menos el último parto en la ficha de cada una.",
    vacio: "Todas las vacas tienen parto u ordeños registrados.",
  },
  {
    caso: "novilla_con_ordenos",
    titulo: "Novillas con ordeños y sin parto",
    explicacion: "Tienen leche registrada pero ningún parto: el dato es incoherente, porque una hembra no da leche antes de parir.",
    queHacer: "Registra el parto que falta en la ficha del animal; si los ordeños son de otra vaca, corrígelos.",
    vacio: "Ninguna novilla tiene ordeños sin parto.",
  },
];

/** Parámetro de la URL que guarda la página de cada grupo. */
export const PARAM_PAGINA: Record<Caso, string> = {
  pendiente: "ppen",
  sin_nacimiento: "pnac",
  vaca_joven_sin_datos: "pjov",
  vaca_sin_historial: "pvsh",
  novilla_con_ordenos: "pord",
};

/** Lo que el animal tiene registrado, resumido para la tabla. */
export function registrosDe(f: FilaRevision) {
  const partes = [f.partos > 0 && `${f.partos} partos`, f.ordenos > 0 && `${f.ordenos} ordeños`, f.tiene_repro && "servicio o palpación"].filter(Boolean);
  return partes.length ? partes.join(" · ") : "Sin registros";
}

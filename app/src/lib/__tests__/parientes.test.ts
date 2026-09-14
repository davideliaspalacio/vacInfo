import { describe, expect, it } from "vitest";
import {
  categoriaFormulario,
  errorMadre,
  especieDeCategoria,
  madresPosibles,
  padresPosibles,
  sexoDeCategoria,
  torosDeServiciosPosibles,
  type Candidato,
} from "../parientes";

const F1 = "finca-1";
const F2 = "finca-2";

let n = 0;
const animal = (nombre: string, categoria: string, sexo: string, extra: Partial<Candidato> = {}): Candidato => ({
  id: `id-${++n}`,
  nombre,
  chapeta: null,
  finca_id: F1,
  categoria,
  especie: especieDeCategoria(categoria),
  sexo,
  estado: "activo",
  ...extra,
});

const lola = animal("Lola", "vaca", "hembra");
const nube = animal("Nube", "novilla", "hembra");
const pinta = animal("Pinta", "ternera", "hembra");
const vieja = animal("Abuela", "vaca", "hembra", { estado: "vendido" });
const careto = animal("Careto", "toro", "macho");
const tomas = animal("Tomás", "novillo", "macho");
const becerro = animal("Becerro", "ternero", "macho");
const yegua = animal("Canela", "caballo", "hembra");
const caballo = animal("Relámpago", "caballo", "macho");
const perra = animal("Luna", "perro", "hembra");
const otraFinca = animal("Ajena", "vaca", "hembra", { finca_id: F2 });
const todos = [lola, nube, pinta, vieja, careto, tomas, becerro, yegua, caballo, perra, otraFinca];

const nombres = (xs: { nombre: string }[]) => xs.map((x) => x.nombre);

describe("categorías", () => {
  it("especie y sexo derivados", () => {
    expect(especieDeCategoria("novillo")).toBe("bovino");
    expect(especieDeCategoria("caballo")).toBe("equino");
    expect(especieDeCategoria("perro")).toBe("canino");
    expect(sexoDeCategoria("novillo")).toBe("macho");
    expect(sexoDeCategoria("ternera")).toBe("hembra");
    expect(sexoDeCategoria("caballo")).toBeNull();
    expect(categoriaFormulario("ternerona")).toBe("novilla");
    expect(categoriaFormulario(undefined)).toBe("vaca");
  });
});

describe("madre", () => {
  it("bovino: solo hembras bovinas de la finca, adultas primero, activas antes que inactivas", () => {
    expect(nombres(madresPosibles(todos, { fincaId: F1, categoria: "ternero" }))).toEqual(["Lola", "Nube", "Abuela", "Pinta"]);
  });

  it("nunca lista machos ni otras especies como madre", () => {
    const madres = madresPosibles(todos, { fincaId: F1, categoria: "vaca" });
    expect(madres.every((m) => m.sexo === "hembra" && m.especie === "bovino")).toBe(true);
    expect(nombres(madresPosibles(todos, { fincaId: F1, categoria: "caballo" }))).toEqual(["Canela"]);
    expect(nombres(madresPosibles(todos, { fincaId: F1, categoria: "perro" }))).toEqual(["Luna"]);
    expect(madresPosibles(todos, { fincaId: F1, categoria: "otro" })).toEqual([]);
  });

  it("excluye al propio animal al editar", () => {
    expect(nombres(madresPosibles(todos, { fincaId: F1, categoria: "vaca", excluirId: lola.id }))).not.toContain("Lola");
  });

  it("valida en el servidor", () => {
    const ctx = { fincaId: F1, categoria: "ternera" };
    expect(errorMadre(lola, ctx)).toBeNull();
    expect(errorMadre(careto, ctx)).toMatch(/hembra/);
    expect(errorMadre(yegua, ctx)).toMatch(/especie/);
    expect(errorMadre(otraFinca, ctx)).toMatch(/finca/);
    expect(errorMadre(lola, { ...ctx, excluirId: lola.id })).toMatch(/propia madre/);
    expect(errorMadre(null, ctx)).toMatch(/no existe/);
  });
});

describe("padre", () => {
  it("bovino: toros y novillos, nunca hembras ni terneros", () => {
    expect(nombres(padresPosibles(todos, { fincaId: F1, categoria: "ternera" }))).toEqual(["Careto", "Tomás"]);
  });

  it("equino y canino: machos de la misma especie", () => {
    expect(nombres(padresPosibles(todos, { fincaId: F1, categoria: "caballo" }))).toEqual(["Relámpago"]);
    expect(padresPosibles(todos, { fincaId: F1, categoria: "perro" })).toEqual([]);
  });

  it("una ficha inconsistente (toro guardado como hembra) no aparece como padre", () => {
    const malGuardado = animal("Error", "toro", "hembra");
    expect(nombres(padresPosibles([...todos, malGuardado], { fincaId: F1, categoria: "vaca" }))).not.toContain("Error");
  });

  it("toros de servicios solo para bovinos y sin repetir fichas", () => {
    const servicios = [
      { finca_id: F1, nombre: "Midas" },
      { finca_id: F1, nombre: "careto" },
      { finca_id: F2, nombre: "Otro" },
    ];
    const padres = padresPosibles(todos, { fincaId: F1, categoria: "vaca" });
    expect(nombres(torosDeServiciosPosibles(servicios, padres, { fincaId: F1, categoria: "vaca" }))).toEqual(["Midas"]);
    expect(torosDeServiciosPosibles(servicios, [], { fincaId: F1, categoria: "caballo" })).toEqual([]);
  });
});

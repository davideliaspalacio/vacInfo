export type Rol = "propietario" | "administrador" | "mayordomo" | "trabajador" | "veterinario" | "consultor";

export const ROLES: Rol[] = ["propietario", "administrador", "mayordomo", "trabajador", "veterinario", "consultor"];
export const ROLES_CAMPO: Rol[] = ["mayordomo", "trabajador"];
export const ROLES_GESTORES: Rol[] = ["propietario", "administrador"];

export const ETIQUETA_ROL: Record<Rol, string> = {
  propietario: "Propietario",
  administrador: "Administrador",
  mayordomo: "Mayordomo",
  trabajador: "Trabajador",
  veterinario: "Veterinario",
  consultor: "Consultor",
};

export const DESCRIPCION_ROL: Record<Rol, string> = {
  propietario: "Control total de la empresa y su equipo",
  administrador: "Gestiona fincas, equipo e informes",
  mayordomo: "Coordina la finca y registra desde VacDaTa",
  trabajador: "Registra ordeños y novedades desde el celular",
  veterinario: "Consulta y registra la parte sanitaria",
  consultor: "Consulta informes e indicadores",
};

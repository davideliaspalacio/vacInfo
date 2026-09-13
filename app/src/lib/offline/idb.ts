// Envoltorio mínimo de IndexedDB con promesas. public/sw.js abre la misma base: mantener nombre, versión y almacenes alineados.
export const NOMBRE_BD = "vacdata";
export const VERSION_BD = 1;

export type Almacen = "catalogo" | "cola" | "historial";

let conexion: Promise<IDBDatabase> | null = null;

export function abrirBD(): Promise<IDBDatabase> {
  if (conexion) return conexion;
  conexion = new Promise<IDBDatabase>((resolve, reject) => {
    const peticion = indexedDB.open(NOMBRE_BD, VERSION_BD);
    peticion.onupgradeneeded = () => {
      const bd = peticion.result;
      if (!bd.objectStoreNames.contains("catalogo")) bd.createObjectStore("catalogo", { keyPath: "finca_id" });
      if (!bd.objectStoreNames.contains("cola")) bd.createObjectStore("cola", { keyPath: "cliente_id" });
      if (!bd.objectStoreNames.contains("historial")) bd.createObjectStore("historial", { keyPath: "cliente_id" });
    };
    peticion.onsuccess = () => {
      const bd = peticion.result;
      bd.onversionchange = () => {
        bd.close();
        conexion = null;
      };
      resolve(bd);
    };
    peticion.onerror = () => {
      conexion = null;
      reject(peticion.error);
    };
  });
  return conexion;
}

function esperar<T>(peticion: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    peticion.onsuccess = () => resolve(peticion.result);
    peticion.onerror = () => reject(peticion.error);
  });
}

async function almacen(nombre: Almacen, modo: IDBTransactionMode) {
  const bd = await abrirBD();
  return bd.transaction(nombre, modo).objectStore(nombre);
}

export async function leer<T>(nombre: Almacen, clave: string): Promise<T | undefined> {
  return esperar((await almacen(nombre, "readonly")).get(clave) as IDBRequest<T | undefined>);
}

export async function leerTodos<T>(nombre: Almacen): Promise<T[]> {
  return esperar((await almacen(nombre, "readonly")).getAll() as IDBRequest<T[]>);
}

export async function contar(nombre: Almacen): Promise<number> {
  return esperar((await almacen(nombre, "readonly")).count());
}

export async function guardar<T>(nombre: Almacen, valor: T): Promise<void> {
  await esperar((await almacen(nombre, "readwrite")).put(valor));
}

export async function borrar(nombre: Almacen, clave: string): Promise<void> {
  await esperar((await almacen(nombre, "readwrite")).delete(clave));
}

/** Ejecuta varias operaciones en una sola transacción y espera a que se confirme. */
export async function transaccion(nombres: Almacen[], trabajo: (almacenes: Record<Almacen, IDBObjectStore>) => void): Promise<void> {
  const bd = await abrirBD();
  const tx = bd.transaction(nombres, "readwrite");
  const almacenes = Object.fromEntries(nombres.map((n) => [n, tx.objectStore(n)])) as Record<Almacen, IDBObjectStore>;
  trabajo(almacenes);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

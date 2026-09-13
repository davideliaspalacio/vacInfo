/**
 * Carga el histórico real de Finca Toneles con el mismo código del importador.
 * Solo corre si se pide explícitamente:
 *   IMPORTAR_TONELES=1 pnpm exec vitest run scripts/importar-toneles.test.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Database } from "../src/lib/database.types";
import { leerLibro } from "../src/lib/importador/leer";
import { combinarHojas } from "../src/lib/importador/combinar";
import { aplicarPlan, previsualizar } from "../src/lib/importador/aplicar";

const ARCHIVO =
  process.env.ARCHIVO ?? "/Users/1234/Downloads/OneDrive_3_9-12-2026/FINCA TONELES INFORME OPERATIVO - (24 PLA TONELES)).xlsx";
const FINCA = process.env.FINCA ?? "00000000-0000-4000-8000-000000000101";
const URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:55321";
const CLAVE = process.env.SUPABASE_KEY ?? "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";

describe.runIf(process.env.IMPORTAR_TONELES === "1" && existsSync(ARCHIVO))("carga del histórico de Toneles", () => {
  it(
    "importa el libro y una segunda pasada no agrega nada",
    async () => {
      const supabase = createClient<Database>(URL, CLAVE, { auth: { persistSession: false } });
      const { error } = await supabase.auth.signInWithPassword({
        email: process.env.CORREO ?? "gustavo@vacinfo.local",
        password: process.env.CLAVE_USUARIO ?? "vacinfo123",
      });
      expect(error).toBeNull();

      const plan = combinarHojas(await leerLibro(readFileSync(ARCHIVO)));
      const vista = await previsualizar(supabase, FINCA, plan);
      console.log("VISTA PREVIA", JSON.stringify({ nuevas: vista.animalesNuevos.length, existentes: vista.animalesExistentes.length, eventos: vista.eventos }));

      const primera = await aplicarPlan(supabase, FINCA, plan, basename(ARCHIVO));
      console.log("PRIMERA", JSON.stringify(primera.conteos));

      const segunda = await aplicarPlan(supabase, FINCA, plan, basename(ARCHIVO));
      console.log("SEGUNDA", JSON.stringify(segunda.conteos));
      for (const c of Object.values(segunda.conteos)) expect(c.creados).toBe(0);
    },
    300_000,
  );
});

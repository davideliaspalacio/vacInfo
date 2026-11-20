"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { borrarFoto } from "@/lib/fotos";
import { hoyISO } from "@/lib/formato";
import { MENSAJE_SOLO_LECTURA, soloLectura } from "@/lib/permisos";
import { CATEGORIAS_FORMULARIO, errorMadre, especieDeCategoria, sexoDeCategoria } from "@/lib/parientes";
import { codigoAnimal } from "@/components/fincas/etiquetas";
import { obtenerSesion, ROLES_GESTORES } from "@/lib/sesion";
import type { EstadoFormulario } from "@/components/fincas/campo";
import { datosDe, fechaOpcional, fotoOpcional, mensajeErrorBD, numeroOpcional, textoOpcional, textoRequerido } from "@/components/fincas/validacion";

const PADRE_OTRO = "__otro__";

/**
 * Datos de vacas productivas del formulario: las dos fechas que sí se guardan (el resto de ese
 * bloque lo calcula `estado_reproductivo`). Solo se leen cuando la categoría elegida es vaca.
 */
const esquemaProductivos = z.object({ ultimo_parto: fechaOpcional, fecha_servida: fechaOpcional });

const esquemaAnimal = z
  .object({
    finca_id: z.uuid("Elige una finca"),
    chapeta: textoOpcional,
    nombre: textoRequerido("Escribe el nombre"),
    categoria: z.enum(CATEGORIAS_FORMULARIO, "Elige la categoría"),
    sexo: z.enum(["hembra", "macho"], "Elige el sexo").optional(),
    raza: textoOpcional,
    color: textoOpcional,
    fecha_nacimiento: fechaOpcional,
    peso_kg: numeroOpcional,
    metodo_adquisicion: textoOpcional,
    padre_nombre: textoOpcional,
    padre_otro: textoOpcional,
    madre_id: z
      .string()
      .nullish()
      .transform((v) => v || null)
      .pipe(z.uuid().nullable()),
    notas: textoOpcional,
  })
  .refine((d) => d.padre_nombre !== PADRE_OTRO || d.padre_otro, { path: ["padre_otro"], message: "Escribe el nombre del padre" })
  .refine((d) => sexoDeCategoria(d.categoria) || d.sexo, { path: ["sexo"], message: "Elige el sexo" })
  .transform(({ padre_otro, sexo, ...d }) => ({
    ...d,
    // En bovinos el sexo lo define la categoría (ternera/novilla/vaca hembra; ternero/novillo/toro macho).
    sexo: sexoDeCategoria(d.categoria) ?? sexo!,
    especie: especieDeCategoria(d.categoria),
    padre_nombre: d.padre_nombre === PADRE_OTRO ? padre_otro : d.padre_nombre,
  }));

export async function guardarAnimal(id: string | null, _: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const { supabase, rol, fincas, organizacionId } = await obtenerSesion();
  if (soloLectura(rol)) return { mensaje: MENSAJE_SOLO_LECTURA };
  if (id && !ROLES_GESTORES.includes(rol)) return { mensaje: "Solo propietarios y administradores pueden editar fichas." };

  const resultado = esquemaAnimal.safeParse(datosDe(formData));
  if (!resultado.success) return { errores: z.flattenError(resultado.error).fieldErrors, mensaje: "Revisa los campos marcados." };

  const base = resultado.data;
  if (!fincas.some((f) => f.id === base.finca_id)) return { errores: { finca_id: ["Finca no disponible"] } };

  // ── Datos de vacas productivas (solo en vacas): último parto y fecha servida ──
  const productivos = esquemaProductivos.safeParse(datosDe(formData));
  if (!productivos.success) return { errores: z.flattenError(productivos.error).fieldErrors, mensaje: "Revisa los campos marcados." };
  const ultimoParto = base.categoria === "vaca" ? productivos.data.ultimo_parto : null;
  const fechaServida = base.categoria === "vaca" ? productivos.data.fecha_servida : null;
  const hoy = hoyISO();
  const errorFecha = (campo: "ultimo_parto" | "fecha_servida", valor: string | null, nombre: string) => {
    if (!valor) return null;
    if (valor > hoy) return { errores: { [campo]: [`La ${nombre} no puede ser futura`] }, mensaje: "Revisa los campos marcados." };
    if (base.fecha_nacimiento && valor < base.fecha_nacimiento)
      return { errores: { [campo]: [`La ${nombre} no puede ser anterior a la fecha de nacimiento`] }, mensaje: "Revisa los campos marcados." };
    return null;
  };
  const malParto = errorFecha("ultimo_parto", ultimoParto, "fecha del último parto");
  if (malParto) return malParto;
  const malServida = errorFecha("fecha_servida", fechaServida, "fecha servida");
  if (malServida) return malServida;

  // La foto llega como ruta del bucket privado; se comprueba que sea de esta empresa y de este tipo.
  const foto = fotoOpcional(organizacionId, "animales").safeParse(formData.get("foto_url"));
  if (!foto.success) return { errores: { foto_url: ["Vuelve a subir la foto"] }, mensaje: "Revisa los campos marcados." };
  if (foto.data && !ROLES_GESTORES.includes(rol)) return { mensaje: "Solo propietarios y administradores pueden poner la foto." };
  const fotoAnterior = id ? (await supabase.from("animales").select("foto_url").eq("id", id).maybeSingle()).data?.foto_url : null;

  let madre_nombre: string | null = null;
  if (base.madre_id) {
    const { data: madre } = await supabase.from("animales").select("id, nombre, finca_id, sexo, especie").eq("id", base.madre_id).maybeSingle();
    const error = errorMadre(madre, { fincaId: base.finca_id, categoria: base.categoria, excluirId: id });
    if (error) return { errores: { madre_id: [error] }, mensaje: "Revisa los campos marcados." };
    madre_nombre = madre!.nombre;
  }
  // El código lo arma el servidor (4 letras de la finca · nombre · chapeta) y no se toma del navegador.
  // Al editar se conserva el que ya tiene, porque el QR impreso en la chapeta lleva ese código.
  let codigo = id ? (await supabase.from("animales").select("codigo").eq("id", id).maybeSingle()).data?.codigo : undefined;
  if (!codigo) {
    const nombreFinca = fincas.find((f) => f.id === base.finca_id)?.nombre ?? "";
    const propuesto = codigoAnimal(nombreFinca, base.nombre, base.chapeta);
    const { data: usados } = await supabase.from("animales").select("codigo").eq("finca_id", base.finca_id).like("codigo", `${propuesto}%`);
    const tomados = new Set((usados ?? []).map((u) => u.codigo));
    codigo = propuesto;
    for (let n = 2; tomados.has(codigo); n++) codigo = `${propuesto}-${n}`;
  }

  const datos = { ...base, codigo, madre_nombre, foto_url: foto.data };

  const consulta = id
    ? supabase.from("animales").update(datos).eq("id", id).select("id").single()
    : supabase.from("animales").insert(datos).select("id").single();
  const { data, error } = await consulta;
  if (error || !data) {
    const mensaje = error ? mensajeErrorBD(error, `Ya existe un animal con el código ${datos.codigo} en esta finca.`) : "No se encontró el animal.";
    return error?.code === "23505" ? { mensaje, errores: { codigo: ["Código repetido"] } } : { mensaje };
  }

  // Al cambiar o quitar la foto, la anterior se borra del bucket para no acumular archivos sueltos.
  if (fotoAnterior && fotoAnterior !== foto.data) await borrarFoto(supabase, fotoAnterior);

  // El parto y el servicio se crean igual que en el importador: con los índices únicos
  // (`partos_animal_fecha`, `servicios_animal_fecha`) y `ignoreDuplicates`, guardar dos veces la
  // misma fecha no duplica nada. Si falla, la ficha ya quedó guardada y se avisa sin perderla.
  const pendientes: string[] = [];
  if (ultimoParto) {
    const { error } = await supabase
      .from("partos")
      .upsert({ animal_id: data.id, fecha: ultimoParto, observaciones: "Último parto registrado en la ficha" }, {
        onConflict: "animal_id,fecha",
        ignoreDuplicates: true,
      });
    if (error) pendientes.push(`el parto del ${ultimoParto}`);
  }
  if (fechaServida) {
    const { error } = await supabase
      .from("servicios")
      .upsert({ animal_id: data.id, fecha: fechaServida, observaciones: "Fecha servida registrada en la ficha" }, {
        onConflict: "animal_id,fecha",
        ignoreDuplicates: true,
      });
    if (error) pendientes.push(`el servicio del ${fechaServida}`);
  }
  if (pendientes.length)
    return { mensaje: `La ficha se guardó, pero no se pudo registrar ${pendientes.join(" ni ")}. Regístralo desde la ficha del animal.` };

  revalidatePath(`/fincas/${datos.finca_id}`);
  revalidatePath(`/animales/${data.id}`);
  redirect(`/animales/${data.id}`);
}

/**
 * Borra el perfil de un animal. Es un borrado duro y definitivo: la base se lleva en cascada todo lo
 * que cuelga del animal (ordeños, servicios, palpaciones, partos, secados, eventos sanitarios,
 * bajas, pesajes y su historial de etapas). Lo que NO se borra:
 *  - sus crías, que siguen en la finca y solo pierden el enlace a la madre (`madre_id` queda nulo,
 *    el nombre y la chapeta de la madre que tenga escritos se conservan);
 *  - los partos de otras vacas en los que este animal era la cría (`cria_id` queda nulo);
 *  - los eventos del calendario que lo mencionaban (`animal_id` queda nulo).
 * Sus ordeños desaparecen de los litros del día y de los informes de los días ya pasados.
 *
 * Solo propietario y administrador. Además de este control, la política RLS «borrar» de `animales`
 * exige `puede_gestionar_finca`, así que el servidor manda aunque alguien llame la acción a mano.
 */
export async function eliminarAnimal(id: string): Promise<{ error: string }> {
  const { supabase, rol, fincas } = await obtenerSesion();
  if (!ROLES_GESTORES.includes(rol)) return { error: "Solo propietarios y administradores pueden eliminar el perfil de un animal." };

  const { data: animal } = await supabase.from("animales").select("id, nombre, finca_id, foto_url").eq("id", id).maybeSingle();
  if (!animal) return { error: "No se encontró el animal: puede que ya lo hayan eliminado." };
  if (!fincas.some((f) => f.id === animal.finca_id)) return { error: "No tienes acceso a la finca de este animal." };

  // Con RLS un borrado sin permiso no da error: devuelve cero filas. Por eso se piden las borradas.
  const { data: borrados, error } = await supabase.from("animales").delete().eq("id", id).select("id");
  if (error) return { error: mensajeErrorBD(error, "No se pudo eliminar el perfil.") };
  if (!borrados?.length) return { error: "No se pudo eliminar el perfil: no tienes permiso sobre esta finca." };

  if (animal.foto_url) await borrarFoto(supabase, animal.foto_url);

  revalidatePath("/", "layout");
  redirect(`/fincas/${animal.finca_id}`);
}

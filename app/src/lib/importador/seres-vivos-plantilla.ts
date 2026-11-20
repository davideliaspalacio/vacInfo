import ExcelJS from "exceljs";
import {
  COLUMNAS_CALCULADAS,
  COLUMNAS_HISTORIAL,
  COLUMNAS_PLANILLA,
  COLUMNAS_PRODUCTIVAS,
  ESPECIES_ACEPTADAS,
  FILAS_PLANTILLA,
  HOJA_SERES_VIVOS,
  LITROS_MAXIMO,
  PESO_MAXIMO,
  TITULO_BLOQUE_PRODUCTIVAS,
  TITULO_PLANILLA,
} from "./seres-vivos";
import { DIAS_GESTACION, DIAS_MORA_PRENEZ, DIAS_SECADO_TRAS_SERVICIO } from "./reproduccion-proyectada";

/** Ancho de cada columna de la plantilla, en el mismo orden que `COLUMNAS_PLANILLA`. */
const ANCHOS = [5, 12, 16, 14, 16, 20, 18, 12, 10, 20, 14, 20, 14, 18, 12, 12, 14, 18, 20, 12, 20];

const BOSQUE = "FF14402A";
const LIMA = "FFD9ECC4";
const CREMA = "FFF7F3E8";
/** Tono de las cuatro columnas que calcula el sistema: se ve que no hay que llenarlas. */
const GRIS = "FFE6E6E1";

const borde = (color = "FFB7C4B2"): Partial<ExcelJS.Borders> => ({
  top: { style: "thin", color: { argb: color } },
  left: { style: "thin", color: { argb: color } },
  bottom: { style: "thin", color: { argb: color } },
  right: { style: "thin", color: { argb: color } },
});

const relleno = (argb: string): ExcelJS.FillPattern => ({ type: "pattern", pattern: "solid", fgColor: { argb } });

/** Fila donde van los encabezados; arriba quedan el título y la celda de la finca. */
const FILA_ENCABEZADOS = 4;

const INSTRUCCIONES: [string, string][] = [
  [
    "PERTENECEN A FINCA:",
    "Escribe el nombre de la finca a la que pertenecen los animales de la planilla. Al importar se compara con la finca elegida y, si no coincide, se avisa.",
  ],
  ["#", "Número de la fila. Solo es una guía: puedes dejarlo como viene."],
  ["ESPECIE", `Acepta: ${ESPECIES_ACEPTADAS.join(", ")}. Si escribes otra cosa, el animal queda en la categoría «Otro».`],
  ["RAZA", "Texto libre: Holstein, Jersey, Gyr, Pardo Suizo, Criollo…"],
  ["COLOR", "Texto libre: blanco, negro, pintado, cereza…"],
  ["HEMBRA O MACHO", "Escribe hembra o macho (también sirven H / M). Es obligatorio: sin sexo la fila no se importa. También se acepta el título SEXO."],
  ["NOMBRE", "Nombre del animal. Si no tiene nombre, deja la casilla vacía y escribe la chapeta: se usará la chapeta como nombre."],
  [
    "FECHA NACIMIENTO",
    "Formato DD/MM/AAAA (por ejemplo 05/03/2025). Con la fecha y el día de la importación se calcula la categoría: hasta 12 meses ternera o ternero, de 12 a 36 meses novilla y de ahí en adelante vaca (en los machos, novillo hasta los 24 y luego toro). Si la fila trae FECHA ÚLTIMO PARTO, la hembra queda como vaca aunque sea más joven.",
  ],
  ["CHAPETA", "Número o código de la chapeta. Sirve para no repetir animales: si la chapeta ya existe en la finca, la fila no se vuelve a crear."],
  [
    "PESO",
    `Peso en kilos, solo el número (por ejemplo 420). Debe estar entre 1 y ${PESO_MAXIMO.toLocaleString("es-CO")} kg. Además del peso de la ficha se crea un pesaje con la fecha de la importación, para la curva de crecimiento de Levante.`,
  ],
  ["PAPÁ", "Nombre del padre. Se guarda como texto en la ficha. También se acepta el título PADRE."],
  ["CHAPETA PAPÁ", "Chapeta del padre. Se guarda como texto en la ficha. También se acepta CHAPETA PADRE."],
  ["MAMÁ", "Nombre de la madre. También se acepta el título MADRE."],
  [
    "CHAPETA MAMÁ",
    "Si la chapeta coincide con un animal de la finca (o con otra fila de esta misma planilla) la ficha queda enlazada a su madre. Si no coincide, se guardan el nombre y la chapeta tal como los escribiste. También se acepta CHAPETA MADRE.",
  ],
  [
    TITULO_BLOQUE_PRODUCTIVAS,
    `De este bloque el sistema solo guarda dos datos: ${COLUMNAS_PRODUCTIVAS[0]} y ${COLUMNAS_PRODUCTIVAS[3]}. Las otras cuatro (${COLUMNAS_CALCULADAS.join(", ")}) las calcula el sistema con esas dos fechas y no se guardan: puedes dejarlas vacías. Si escribes algo ahí, la planilla se importa igual y la vista previa te avisa y te muestra los valores calculados para que compruebes que cuadran.`,
  ],
  [
    "FECHA ÚLTIMO PARTO",
    "Se guarda. Fecha del último parto en formato DD/MM/AAAA. Con ella se crea el antecedente del parto (sin cría, es historial) y el sistema ya puede calcular los días en ordeño y la mora de preñez. Solo aplica a hembras bovinas: no puede ser futura ni anterior a la fecha de nacimiento. También se acepta el título ÚLTIMO PARTO.",
  ],
  [
    "DÍAS ORDEÑO",
    "No se guarda: lo calcula el sistema como los días entre la FECHA ÚLTIMO PARTO y el día de hoy, mientras la vaca no esté seca.",
  ],
  [
    "MORA PREÑEZ",
    `No se guarda: lo calcula el sistema como los días en ordeño menos ${DIAS_MORA_PRENEZ}. Sale negativa cuando todavía no es hora de servir a la vaca.`,
  ],
  [
    "FECHA SERVIDA",
    "Se guarda. Fecha del último servicio o monta en formato DD/MM/AAAA. Con ella se crea el servicio del animal y el sistema calcula la fecha posible de secado y la posible fecha de nacimiento de la cría. Solo aplica a vacas y novillas: no puede ser futura ni anterior a la fecha de nacimiento.",
  ],
  [
    "FECHA POSIBLE DE SECADO",
    `No se guarda: lo calcula el sistema como la FECHA SERVIDA más ${DIAS_SECADO_TRAS_SERVICIO} días.`,
  ],
  [
    "POSIBLE FECHA NACIMIENTO CRÍA",
    `No se guarda: lo calcula el sistema como la FECHA SERVIDA más ${DIAS_GESTACION} días de gestación.`,
  ],
  [
    "EN ORDEÑO",
    "Opcional pero muy recomendable. Escribe sí o no. «Sí» deja a la vaca en ordeño desde su último parto; «no» la deja seca (se registra el secado con la fecha de la importación y no se le crea ningún ordeño). Si la dejas vacía, la vaca queda como la deje su último parto. No aplica a machos ni a terneras.",
  ],
  [
    "LITROS ÚLTIMO ORDEÑO",
    `Opcional pero muy recomendable. Litros de un solo ordeño, solo el número (por ejemplo 12,5), entre 0 y ${LITROS_MAXIMO}. Se crea un ordeño de la jornada de la mañana con la fecha de la importación, que es el que alimenta los litros del día y el promedio por vaca. Si escribes «sí» en EN ORDEÑO pero dejas los litros vacíos no se crea ningún ordeño: un ordeño de 0 litros ensuciaría los informes.`,
  ],
];

const NOTAS = [
  `Las columnas de historial (${COLUMNAS_HISTORIAL.join(", ")}) son opcionales, pero muy recomendables: sin ellas el hato entra sin ningún antecedente y el sistema no puede calcular mora de preñez, fecha de secado ni días en ordeño.`,
  `Del bloque «${TITULO_BLOQUE_PRODUCTIVAS}» solo se guardan ${COLUMNAS_PRODUCTIVAS[0]} y ${COLUMNAS_PRODUCTIVAS[3]}; las otras cuatro las calcula el sistema y las muestra en la vista previa.`,
  "Las columnas se reconocen por su título, no por su posición: puedes moverlas o agregar columnas propias.",
  "Los títulos viejos siguen valiendo (SEXO, PADRE, CHAPETA PADRE, MADRE, CHAPETA MADRE, ÚLTIMO PARTO): las planillas que ya tengas llenas se importan igual.",
  "Nada se guarda hasta que revises la vista previa y confirmes la importación.",
  "Puedes subir la misma planilla dos veces sin miedo: los animales que ya existen no se duplican.",
  "Si necesitas más de 75 animales, copia la última fila hacia abajo o sube varias planillas.",
  "Tampoco se duplican los partos, los servicios ni los ordeños: si un animal ya tiene registrado ese mismo parto, servicio u ordeño, la fila se cuenta como «ya registrada».",
];

/** Genera el libro .xlsx de la plantilla de implementación de seres vivos. */
export async function generarPlantillaSeresVivos(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "VacInfo";
  wb.created = new Date();

  const ws = wb.addWorksheet(HOJA_SERES_VIVOS, { views: [{ state: "frozen", ySplit: FILA_ENCABEZADOS }] });
  const ultima = String.fromCharCode(64 + COLUMNAS_PLANILLA.length); // "U" con 21 columnas
  ANCHOS.forEach((ancho, i) => (ws.getColumn(i + 1).width = ancho));

  ws.mergeCells(`A1:${ultima}1`);
  const titulo = ws.getCell("A1");
  titulo.value = TITULO_PLANILLA;
  titulo.font = { name: "Calibri", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
  titulo.alignment = { horizontal: "center", vertical: "middle" };
  titulo.fill = relleno(BOSQUE);
  ws.getRow(1).height = 28;

  const etiquetaFinca = ws.getCell("A2");
  etiquetaFinca.value = "PERTENECEN A FINCA:";
  etiquetaFinca.font = { bold: true };
  ws.mergeCells(`B2:${ultima}2`);
  const nombreFinca = ws.getCell("B2");
  nombreFinca.fill = relleno(CREMA);
  nombreFinca.border = { bottom: { style: "medium", color: { argb: BOSQUE } } };
  ws.getRow(2).height = 20;

  const columna = (titulo: (typeof COLUMNAS_PLANILLA)[number]) => COLUMNAS_PLANILLA.indexOf(titulo) + 1;
  const letra = (c: number) => String.fromCharCode(64 + c);

  // Banda del bloque «DATOS DE VACAS PRODUCTIVOS», como en la planilla en papel del cliente.
  // Va en la fila de encima de los títulos y no estorba a la lectura: ninguna de sus celdas es un
  // encabezado de columna, así que el lector sigue encontrando la tabla en FILA_ENCABEZADOS.
  const primeraProductiva = columna(COLUMNAS_PRODUCTIVAS[0]);
  const ultimaProductiva = columna(COLUMNAS_PRODUCTIVAS[COLUMNAS_PRODUCTIVAS.length - 1]);
  ws.mergeCells(`${letra(primeraProductiva)}${FILA_ENCABEZADOS - 1}:${letra(ultimaProductiva)}${FILA_ENCABEZADOS - 1}`);
  const banda = ws.getCell(`${letra(primeraProductiva)}${FILA_ENCABEZADOS - 1}`);
  banda.value = TITULO_BLOQUE_PRODUCTIVAS;
  banda.font = { bold: true, color: { argb: BOSQUE } };
  banda.alignment = { horizontal: "center", vertical: "middle" };
  banda.fill = relleno(CREMA);
  banda.border = borde(BOSQUE);
  ws.getRow(FILA_ENCABEZADOS - 1).height = 20;

  const encabezados = ws.getRow(FILA_ENCABEZADOS);
  const esCalculada = (texto: string) => (COLUMNAS_CALCULADAS as readonly string[]).includes(texto);
  const esHistorial = (texto: string) => (COLUMNAS_HISTORIAL as readonly string[]).includes(texto);
  COLUMNAS_PLANILLA.forEach((texto, i) => {
    const celda = encabezados.getCell(i + 1);
    celda.value = texto;
    celda.font = { bold: true, color: { argb: BOSQUE } };
    celda.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    // Las de historial van en otro tono para que se vea que son opcionales; las calculadas, en gris,
    // porque no hay que llenarlas: las calcula el sistema.
    celda.fill = relleno(esCalculada(texto) ? GRIS : esHistorial(texto) ? CREMA : LIMA);
    celda.border = borde(BOSQUE);
  });
  encabezados.height = 40;

  const colEspecie = columna("ESPECIE");
  const colSexo = columna("HEMBRA O MACHO");
  const colFecha = columna("FECHA NACIMIENTO");
  const colPeso = columna("PESO");
  const colEnOrdeno = columna("EN ORDEÑO");
  const colLitros = columna("LITROS ÚLTIMO ORDEÑO");
  // Todas las columnas de fecha del bloque productivo, calculadas incluidas: si el ganadero escribe
  // ahí, al menos se ve como fecha (aunque no se guarde).
  const colsFecha = [colFecha, columna("FECHA ÚLTIMO PARTO"), columna("FECHA SERVIDA"), columna("FECHA POSIBLE DE SECADO"), columna("POSIBLE FECHA NACIMIENTO CRÍA")];

  for (let n = 1; n <= FILAS_PLANTILLA; n++) {
    const fila = ws.getRow(FILA_ENCABEZADOS + n);
    fila.getCell(1).value = n;
    for (let c = 1; c <= COLUMNAS_PLANILLA.length; c++) {
      const celda = fila.getCell(c);
      celda.border = borde();
      celda.alignment = { vertical: "middle" };
      // Las cuatro calculadas quedan sombreadas: se ve que no hay que llenarlas.
      if (esCalculada(COLUMNAS_PLANILLA[c - 1])) celda.fill = relleno(GRIS);
    }
    fila.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
    for (const c of colsFecha) fila.getCell(c).numFmt = "dd/mm/yyyy";
    fila.getCell(colPeso).numFmt = "#,##0.##";
    fila.getCell(colLitros).numFmt = "#,##0.##";
  }

  // Listas sugeridas: en Excel y en Google Sheets aparecen como desplegable y no bloquean otros valores.
  // Se declaran por rango (y no celda por celda) para que el archivo lleve un solo `sqref` por columna.
  const rango = (c: number) => `${letra(c)}${FILA_ENCABEZADOS + 1}:${letra(c)}${FILA_ENCABEZADOS + FILAS_PLANTILLA}`;
  const listas = (ws as unknown as { dataValidations: { add(rango: string, validacion: ExcelJS.DataValidation): void } }).dataValidations;
  listas.add(rango(colEspecie), { type: "list", allowBlank: true, formulae: [`"${ESPECIES_ACEPTADAS.join(",")}"`], showErrorMessage: false });
  listas.add(rango(colSexo), { type: "list", allowBlank: true, formulae: ['"Hembra,Macho"'], showErrorMessage: false });
  listas.add(rango(colEnOrdeno), { type: "list", allowBlank: true, formulae: ['"Sí,No"'], showErrorMessage: false });

  const guia = wb.addWorksheet("Instrucciones");
  guia.getColumn(1).width = 24;
  guia.getColumn(2).width = 110;

  const subtitulo = guia.getCell("A1");
  guia.mergeCells("A1:B1");
  subtitulo.value = "Cómo llenar la planilla de implementación de seres vivos";
  subtitulo.font = { size: 13, bold: true, color: { argb: "FFFFFFFF" } };
  subtitulo.alignment = { horizontal: "center", vertical: "middle" };
  subtitulo.fill = relleno(BOSQUE);
  guia.getRow(1).height = 26;

  let fila = 3;
  for (const [campo, texto] of INSTRUCCIONES) {
    const r = guia.getRow(fila++);
    r.getCell(1).value = campo;
    r.getCell(1).font = { bold: true, color: { argb: BOSQUE } };
    r.getCell(1).alignment = { vertical: "top" };
    r.getCell(2).value = texto;
    r.getCell(2).alignment = { vertical: "top", wrapText: true };
  }

  fila++;
  const tituloNotas = guia.getRow(fila++).getCell(1);
  tituloNotas.value = "Ten en cuenta";
  tituloNotas.font = { bold: true, color: { argb: BOSQUE } };
  for (const nota of NOTAS) {
    const r = guia.getRow(fila++);
    r.getCell(2).value = `• ${nota}`;
    r.getCell(2).alignment = { vertical: "top", wrapText: true };
  }

  const datos = await wb.xlsx.writeBuffer();
  return Buffer.from(datos as ArrayBuffer);
}

export const NOMBRE_ARCHIVO_PLANTILLA = "Plantilla implementacion seres vivos - VacInfo.xlsx";

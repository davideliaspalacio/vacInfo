import ExcelJS from "exceljs";
import {
  COLUMNAS_HISTORIAL,
  COLUMNAS_PLANILLA,
  ESPECIES_ACEPTADAS,
  FILAS_PLANTILLA,
  HOJA_SERES_VIVOS,
  LITROS_MAXIMO,
  PESO_MAXIMO,
  TITULO_PLANILLA,
} from "./seres-vivos";

/** Ancho de cada columna de la plantilla, en el mismo orden que `COLUMNAS_PLANILLA`. */
const ANCHOS = [5, 12, 16, 14, 10, 20, 18, 12, 10, 20, 14, 20, 14, 16, 12, 20];

const BOSQUE = "FF14402A";
const LIMA = "FFD9ECC4";
const CREMA = "FFF7F3E8";

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
  ["SEXO", "Escribe hembra o macho (también sirven H / M). Es obligatorio: sin sexo la fila no se importa."],
  ["NOMBRE", "Nombre del animal. Si no tiene nombre, deja la casilla vacía y escribe la chapeta: se usará la chapeta como nombre."],
  [
    "FECHA NACIMIENTO",
    "Formato DD/MM/AAAA (por ejemplo 05/03/2025). Con la fecha y el día de la importación se calcula la categoría: hasta 12 meses ternera o ternero, de 12 a 36 meses novilla y de ahí en adelante vaca (en los machos, novillo hasta los 24 y luego toro). Si la fila trae ÚLTIMO PARTO, la hembra queda como vaca aunque sea más joven.",
  ],
  ["CHAPETA", "Número o código de la chapeta. Sirve para no repetir animales: si la chapeta ya existe en la finca, la fila no se vuelve a crear."],
  [
    "PESO",
    `Peso en kilos, solo el número (por ejemplo 420). Debe estar entre 1 y ${PESO_MAXIMO.toLocaleString("es-CO")} kg. Además del peso de la ficha se crea un pesaje con la fecha de la importación, para la curva de crecimiento de Levante.`,
  ],
  ["PADRE", "Nombre del padre. Se guarda como texto en la ficha."],
  ["CHAPETA PADRE", "Chapeta del padre. Se guarda como texto en la ficha."],
  ["MADRE", "Nombre de la madre."],
  [
    "CHAPETA MADRE",
    "Si la chapeta coincide con un animal de la finca (o con otra fila de esta misma planilla) la ficha queda enlazada a su madre. Si no coincide, se guardan el nombre y la chapeta tal como los escribiste.",
  ],
  [
    "ÚLTIMO PARTO",
    "Opcional pero muy recomendable. Fecha del último parto en formato DD/MM/AAAA. Con ella se crea el antecedente del parto (sin cría, es historial) y el sistema ya puede calcular los días en ordeño, la mora de preñez y la fecha de secado. Solo aplica a hembras bovinas: no puede ser futura ni anterior a la fecha de nacimiento.",
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
  `Las tres últimas columnas (${COLUMNAS_HISTORIAL.join(", ")}) son opcionales, pero muy recomendables: sin ellas el hato entra sin ningún antecedente y el sistema no puede calcular mora de preñez, fecha de secado ni días en ordeño.`,
  "Las columnas se reconocen por su título, no por su posición: puedes moverlas o agregar columnas propias.",
  "Nada se guarda hasta que revises la vista previa y confirmes la importación.",
  "Puedes subir la misma planilla dos veces sin miedo: los animales que ya existen no se duplican.",
  "Si necesitas más de 75 animales, copia la última fila hacia abajo o sube varias planillas.",
  "Tampoco se duplican los partos ni los ordeños: si un animal ya tiene registrado ese mismo parto o ese ordeño, la fila se cuenta como «ya registrada».",
];

/** Genera el libro .xlsx de la plantilla de implementación de seres vivos. */
export async function generarPlantillaSeresVivos(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "VacInfo";
  wb.created = new Date();

  const ws = wb.addWorksheet(HOJA_SERES_VIVOS, { views: [{ state: "frozen", ySplit: FILA_ENCABEZADOS }] });
  const ultima = String.fromCharCode(64 + COLUMNAS_PLANILLA.length); // "P" con 16 columnas
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

  const encabezados = ws.getRow(FILA_ENCABEZADOS);
  const esHistorial = (texto: string) => (COLUMNAS_HISTORIAL as readonly string[]).includes(texto);
  COLUMNAS_PLANILLA.forEach((texto, i) => {
    const celda = encabezados.getCell(i + 1);
    celda.value = texto;
    celda.font = { bold: true, color: { argb: BOSQUE } };
    celda.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    // Las tres de historial van en otro tono para que se vea que son opcionales.
    celda.fill = relleno(esHistorial(texto) ? CREMA : LIMA);
    celda.border = borde(BOSQUE);
  });
  encabezados.height = 32;

  const columna = (titulo: (typeof COLUMNAS_PLANILLA)[number]) => COLUMNAS_PLANILLA.indexOf(titulo) + 1;
  const colEspecie = columna("ESPECIE");
  const colSexo = columna("SEXO");
  const colFecha = columna("FECHA NACIMIENTO");
  const colPeso = columna("PESO");
  const colParto = columna("ÚLTIMO PARTO");
  const colEnOrdeno = columna("EN ORDEÑO");
  const colLitros = columna("LITROS ÚLTIMO ORDEÑO");

  for (let n = 1; n <= FILAS_PLANTILLA; n++) {
    const fila = ws.getRow(FILA_ENCABEZADOS + n);
    fila.getCell(1).value = n;
    for (let c = 1; c <= COLUMNAS_PLANILLA.length; c++) {
      const celda = fila.getCell(c);
      celda.border = borde();
      celda.alignment = { vertical: "middle" };
    }
    fila.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
    fila.getCell(colFecha).numFmt = "dd/mm/yyyy";
    fila.getCell(colParto).numFmt = "dd/mm/yyyy";
    fila.getCell(colPeso).numFmt = "#,##0.##";
    fila.getCell(colLitros).numFmt = "#,##0.##";
  }

  // Listas sugeridas: en Excel y en Google Sheets aparecen como desplegable y no bloquean otros valores.
  // Se declaran por rango (y no celda por celda) para que el archivo lleve un solo `sqref` por columna.
  const letra = (c: number) => String.fromCharCode(64 + c);
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

import ExcelJS from 'exceljs';

/**
 * Fixture de planilhas XLSX para testes (ADR 0007 §10).
 *
 * Concentra a criação de XLSX de teste em um único arquivo: trocar a
 * biblioteca de planilha significa alterar apenas este arquivo.
 */

/**
 * Monta um XLSX em memória a partir de linhas (`unknown[][]`) e devolve o
 * buffer. A primeira linha de cada aba é o cabeçalho.
 *
 * @param sheetName Nome da aba.
 * @param rows Linhas a escrever (a primeira é o cabeçalho).
 * @returns Buffer do arquivo XLSX.
 */
export async function buildXlsxBufferFromRows(
  sheetName: string,
  rows: unknown[][],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  for (const row of rows) {
    worksheet.addRow(row);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Grava um XLSX em disco (para os testes de processor, que leem do arquivo).
 *
 * @param filePath Caminho de destino.
 * @param sheetName Nome da aba.
 * @param rows Linhas a escrever (a primeira é o cabeçalho).
 */
export async function writeXlsxFile(
  filePath: string,
  sheetName: string,
  rows: unknown[][],
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  for (const row of rows) {
    worksheet.addRow(row);
  }

  await workbook.xlsx.writeFile(filePath);
}

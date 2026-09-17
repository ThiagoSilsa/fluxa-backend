// NestJS
import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';

// Constants
import { ValidationRule } from '../constants/validation-rule.constant';

// Pipes
import { declaredValidationException } from '../pipes/validation-exception.factory';

/**
 * Nome da aba fixa que contém os dados (linha 1 = cabeçalho) — ADR 0007 §4.
 */
export const DATA_SHEET = 'data';

/** Origem do arquivo: buffer (upload) ou caminho em disco (worker). */
export type SheetSource = { buffer: Buffer } | { filePath: string };

/** Linha da planilha: cabeçalho → texto (células vazias viram `''`). */
export type SheetRow = Record<string, string>;

/**
 * Converte o valor de uma célula no texto que o usuário vê.
 *
 * Fórmulas valem o RESULTADO, rich text vale o texto concatenado, hyperlink
 * vale o rótulo (não a URL), e células de erro (`#DIV/0!`, `#REF!`) lançam
 * 400 — a coluna é citada para o usuário corrigir o arquivo.
 *
 * @param value Valor cru da célula.
 * @param header Cabeçalho da coluna (para mensagens de erro).
 * @returns O texto exibido pela planilha.
 * @throws {BadRequestException} Quando a célula é um erro ou tipo não suportado.
 */
function cellToText(value: ExcelJS.CellValue, header: string): string {
  if (value === null || value === undefined) return '';

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value);
  }

  if (value instanceof Date) return value.toISOString();

  if (typeof value === 'object') {
    // Fórmula: importa o RESULTADO (o que a planilha mostra)
    if ('result' in value) return cellToText(value.result ?? '', header);
    // Texto com formatação parcial
    if ('richText' in value) {
      return value.richText.map((part: { text: string }) => part.text).join('');
    }
    // Célula com hyperlink: vale o rótulo, não a URL
    if ('text' in value) return String(value.text);
    // Célula de erro
    if ('error' in value) {
      throw invalidCellException(header);
    }
  }

  throw invalidCellException(header);
}

/**
 * Exceção de célula que não pôde ser lida (célula de erro ou tipo inesperado).
 *
 * O código é **estável** — a coluna vai em `details`, não dentro do texto:
 * interpolar o cabeçalho faria o código derivado mudar a cada planilha e chegar
 * ao cliente como genérico (ADR 0016 §4).
 *
 * @param header Cabeçalho da coluna da célula.
 * @returns Exceção 400 com a violação declarada.
 */
function invalidCellException(header: string): BadRequestException {
  return declaredValidationException(
    `Valor inválido encontrado na coluna "${header}".`,
    [{ field: header, code: ValidationRule.INVALID_VALUE, params: {} }],
  );
}

/**
 * Lê a planilha e devolve as linhas como `{ cabeçalho: texto }`.
 *
 * Único ponto do back-end que conhece o ExcelJS (ADR 0007 §4): lê a aba fixa
 * `data`, linha 1 = cabeçalho, dados da linha 2 em diante. Linhas totalmente
 * vazias são ignoradas; colunas sem cabeçalho são descartadas; toda coluna do
 * cabeçalho aparece em toda linha (com `''` quando a célula está vazia).
 *
 * @param source Buffer do arquivo (upload) ou caminho em disco (worker).
 * @param sheetName Nome da aba (default `data`).
 * @returns Array de linhas (`[]` quando não há cabeçalho/dados).
 * @throws {BadRequestException} Quando a aba não existe ou há célula inválida.
 */
export async function readSheetAsRows(
  source: SheetSource,
  sheetName: string = DATA_SHEET,
): Promise<SheetRow[]> {
  const workbook = new ExcelJS.Workbook();

  if ('buffer' in source) {
    // O tipo `Buffer` do ExcelJS difere do Buffer do Node — cast via ArrayBuffer.
    await workbook.xlsx.load(source.buffer as unknown as ArrayBuffer);
  } else {
    await workbook.xlsx.readFile(source.filePath);
  }

  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) {
    // A mensagem fica **literal no `throw`** de propósito: é dela que o gerador
    // do catálogo do cliente deriva o código (ADR 0016 §2). Uma constante ou um
    // template com interpolação passa despercebido e o código chega ao cliente
    // sem tradução.
    throw new BadRequestException(
      'Planilha "data" não encontrada no arquivo XLSX.',
    );
  }

  const headerRow = sheet.getRow(1);
  const headers = new Map<number, string>();

  headerRow.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
    const header = cellToText(cell.value, `coluna ${columnNumber}`).trim();
    if (header) headers.set(columnNumber, header);
  });

  if (headers.size === 0) return [];

  const rows: SheetRow[] = [];

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;

    const record: SheetRow = {};
    let hasValue = false;

    for (const [columnNumber, header] of headers) {
      const text = cellToText(row.getCell(columnNumber).value, header);
      record[header] = text;
      if (text !== '') hasValue = true;
    }

    if (hasValue) rows.push(record);
  });

  return rows;
}

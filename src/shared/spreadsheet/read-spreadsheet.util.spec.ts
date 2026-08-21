// Spreadsheet
import {
  DATA_SHEET,
  SHEET_NOT_FOUND_MESSAGE,
  readSheetAsRows,
} from './read-spreadsheet.util';

// Fixtures
import { buildXlsxBufferFromRows } from '../../test/support/xlsx-fixture';

describe('readSheetAsRows', () => {
  it('lê o cabeçalho e as linhas de dados da aba data', async () => {
    const buffer = await buildXlsxBufferFromRows(DATA_SHEET, [
      ['name', 'parkingSpace', 'description'],
      ['Recepção', 10, 'Portaria principal'],
      ['Segurança', 5, ''],
    ]);

    const rows = await readSheetAsRows({ buffer });

    expect(rows).toEqual([
      {
        name: 'Recepção',
        parkingSpace: '10',
        description: 'Portaria principal',
      },
      { name: 'Segurança', parkingSpace: '5', description: '' },
    ]);
  });

  it('ignora linhas totalmente vazias', async () => {
    const buffer = await buildXlsxBufferFromRows(DATA_SHEET, [
      ['name'],
      ['Recepção'],
      [],
      ['Segurança'],
    ]);

    const rows = await readSheetAsRows({ buffer });

    expect(rows).toEqual([{ name: 'Recepção' }, { name: 'Segurança' }]);
  });

  it('descartada colunas sem cabeçalho', async () => {
    const buffer = await buildXlsxBufferFromRows(DATA_SHEET, [
      ['name', '', 'parkingSpace'],
      ['Recepção', 'lixo', 10],
    ]);

    const rows = await readSheetAsRows({ buffer });

    expect(rows).toEqual([{ name: 'Recepção', parkingSpace: '10' }]);
  });

  it('converte número e boolean para texto', async () => {
    const buffer = await buildXlsxBufferFromRows(DATA_SHEET, [
      ['freePass', 'parkingSpace'],
      [true, 0],
    ]);

    const rows = await readSheetAsRows({ buffer });

    expect(rows).toEqual([{ freePass: 'true', parkingSpace: '0' }]);
  });

  it('lança 400 quando a aba data não existe', async () => {
    const buffer = await buildXlsxBufferFromRows('outra-aba', [
      ['name'],
      ['Recepção'],
    ]);

    await expect(readSheetAsRows({ buffer })).rejects.toThrow(
      SHEET_NOT_FOUND_MESSAGE,
    );
  });

  it('devolve [] quando não há cabeçalho', async () => {
    const buffer = await buildXlsxBufferFromRows(DATA_SHEET, [[''], ['x']]);

    const rows = await readSheetAsRows({ buffer });

    expect(rows).toEqual([]);
  });

  it('mantém toda coluna do cabeçalho em toda linha (célula vazia vira "")', async () => {
    const buffer = await buildXlsxBufferFromRows(DATA_SHEET, [
      ['name', 'description'],
      ['Recepção', null],
    ]);

    const rows = await readSheetAsRows({ buffer });

    expect(rows).toEqual([{ name: 'Recepção', description: '' }]);
  });
});

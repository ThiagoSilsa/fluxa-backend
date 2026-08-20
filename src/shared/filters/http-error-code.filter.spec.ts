// NestJS
import {
  ArgumentsHost,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

// Filter
import { HttpErrorCodeFilter } from './http-error-code.filter';

/**
 * Cria um mock de ArgumentsHost apontando para um objeto de resposta fake.
 */
function createMockHost() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const response = { status };

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({}),
    }),
  } as unknown as ArgumentsHost;

  return { host, status, json };
}

describe('HttpErrorCodeFilter', () => {
  let filter: HttpErrorCodeFilter;

  beforeEach(() => {
    filter = new HttpErrorCodeFilter();
  });

  it('deriva code de mensagem de erro por linha (LINHA_{N}_{MSG})', () => {
    const { host, status, json } = createMockHost();
    const exception = new BadRequestException(
      'Linha 3: name deve ter entre 2 e 255 caracteres.',
    );

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: 'Linha 3: name deve ter entre 2 e 255 caracteres.',
        code: 'LINHA_3_NAME_DEVE_TER_ENTRE_2_E_255_CARACTERES',
      }),
    );
  });

  it('normaliza acentos e pontuação no code', () => {
    const { host, json } = createMockHost();

    filter.catch(new BadRequestException('Placa já cadastrada!'), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'PLACA_JA_CADASTRADA' }),
    );
  });

  it('preserva status e message de um NotFoundException', () => {
    const { host, status, json } = createMockHost();

    filter.catch(
      new NotFoundException('Job de importação não encontrado.'),
      host,
    );

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        message: 'Job de importação não encontrado.',
        code: 'JOB_DE_IMPORTACAO_NAO_ENCONTRADO',
      }),
    );
  });

  it('preserva message em array (validation) sem gerar code', () => {
    const { host, json } = createMockHost();
    const exception = new BadRequestException([
      'name é obrigatório',
      'type inválido',
    ]);

    filter.catch(exception, host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: ['name é obrigatório', 'type inválido'],
      }),
    );
    expect(json.mock.calls[0][0].code).toBeUndefined();
  });

  it('usa 500 e gera code para Error genérico', () => {
    const { host, status, json } = createMockHost();

    filter.catch(new Error('Fila indisponível'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: 'Fila indisponível',
        code: 'FILA_INDISPONIVEL',
      }),
    );
  });

  it('não gera code para mensagem sem caracteres alfanuméricos', () => {
    const { host, json } = createMockHost();

    filter.catch(new BadRequestException('!!!'), host);

    expect(json.mock.calls[0][0].code).toBeUndefined();
  });

  it('prefixa ERROR_ quando o code começa com dígito', () => {
    const { host, json } = createMockHost();

    filter.catch(new BadRequestException('400 é um erro'), host);

    expect(json.mock.calls[0][0].code).toBe('ERROR_400_E_UM_ERRO');
  });
});

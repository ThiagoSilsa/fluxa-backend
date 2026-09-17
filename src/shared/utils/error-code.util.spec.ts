// Utils
import { deriveErrorCode, UNKNOWN_ERROR_CODE } from './error-code.util';

describe('deriveErrorCode', () => {
  it('remove acentos e pontuação, deixando o código em maiúsculas', () => {
    expect(deriveErrorCode('Veículo não cadastrado.')).toBe(
      'VEICULO_NAO_CADASTRADO',
    );
  });

  it('mantém o código quando a mensagem já está normalizada', () => {
    expect(deriveErrorCode('ACESSO_NEGADO')).toBe('ACESSO_NEGADO');
  });

  it('reduz pontuação seguida a um único separador', () => {
    expect(deriveErrorCode('Solicitação vencida — reenvie!')).toBe(
      'SOLICITACAO_VENCIDA_REENVIE',
    );
  });

  it('prefixa ERROR_ quando o código começa com dígito', () => {
    expect(deriveErrorCode('Linha 3: name inválido.')).toBe(
      'LINHA_3_NAME_INVALIDO',
    );
    expect(deriveErrorCode('2 veículos')).toBe('ERROR_2_VEICULOS');
  });

  it('devolve undefined sem mensagem ou sem conteúdo normalizável', () => {
    expect(deriveErrorCode(null)).toBeUndefined();
    expect(deriveErrorCode(undefined)).toBeUndefined();
    expect(deriveErrorCode('')).toBeUndefined();
    expect(deriveErrorCode('   ')).toBeUndefined();
    expect(deriveErrorCode(' ... ')).toBeUndefined();
  });

  it('expõe um código de reserva para resultado sem código derivável', () => {
    expect(UNKNOWN_ERROR_CODE).toBe('UNKNOWN_ERROR');
  });
});

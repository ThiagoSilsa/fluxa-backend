import 'reflect-metadata';

// class-transformer
import { plainToInstance, Type } from 'class-transformer';

// class-validator
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
  validate,
} from 'class-validator';
import type { ValidationError } from 'class-validator';

// Constants
import { ValidationRule } from '../constants/validation-rule.constant';

// Utils
import { toValidationDetails } from './validation-detail.util';

/** Enum de prova (valores aceitos pelo código de regra como `values`). */
enum ProbeType {
  A = 'A',
  B = 'B',
}

/** DTO aninhado de prova. */
class ProbeChildDto {
  @IsString()
  @MaxLength(10)
  name!: string;
}

/** DTO de prova (as mesmas constraints que os DTOs reais usam). */
class ProbeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5)
  plate!: string;

  @IsEmail()
  email!: string;

  @IsEnum(ProbeType)
  type!: ProbeType;

  @Min(0)
  parkingSpace!: number;

  @Matches(/^\d+$/)
  code!: string;

  @IsInt()
  quantity!: number;

  @IsString()
  @MaxLength(5)
  label!: string;

  @IsUrl()
  website!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ProbeChildDto)
  child?: ProbeChildDto;
}

/** Payload válido do DTO de prova (os testes trocam só o campo em questão). */
const VALID_PROBE = {
  plate: 'ABC1',
  email: 'a@b.com',
  type: 'A',
  parkingSpace: 1,
  code: '123',
  quantity: 1,
  label: 'ok',
  website: 'https://fluxa.dev',
};

/**
 * Valida um payload como o `ValidationPipe` faz em produção (`transform`).
 *
 * @param overrides Campos inválidos do caso em teste.
 * @returns Erros do `class-validator`.
 */
async function validateProbe(
  overrides: Record<string, unknown> = {},
): Promise<ValidationError[]> {
  const probe = plainToInstance(ProbeDto, { ...VALID_PROBE, ...overrides });

  return validate(probe);
}

describe('toValidationDetails', () => {
  it('traduz cada constraint usada nos DTOs no código de regra', async () => {
    const errors = await validateProbe({
      plate: '',
      email: 'nope',
      type: 'Z',
      parkingSpace: -1,
      code: 'abc',
      quantity: 'x',
    });

    expect(toValidationDetails(errors)).toEqual([
      { field: 'plate', code: ValidationRule.REQUIRED, params: {} },
      { field: 'email', code: ValidationRule.INVALID_EMAIL, params: {} },
      {
        field: 'type',
        code: ValidationRule.INVALID_VALUE,
        params: { values: ['A', 'B'] },
      },
      {
        field: 'parkingSpace',
        code: ValidationRule.MIN_VALUE,
        params: { min: 0 },
      },
      { field: 'code', code: ValidationRule.INVALID_FORMAT, params: {} },
      { field: 'quantity', code: ValidationRule.INVALID_TYPE, params: {} },
    ]);
  });

  it('leva o tamanho máximo como parâmetro do texto', async () => {
    const errors = await validateProbe({ label: 'x'.repeat(30) });

    expect(toValidationDetails(errors)).toEqual([
      {
        field: 'label',
        code: ValidationRule.MAX_LENGTH,
        params: { max: 5 },
      },
    ]);
  });

  it('reporta um campo aninhado com o caminho pontuado', async () => {
    const errors = await validateProbe({ child: { name: 'x'.repeat(30) } });

    expect(toValidationDetails(errors)).toEqual([
      {
        field: 'child.name',
        code: ValidationRule.MAX_LENGTH,
        params: { max: 10 },
      },
    ]);
  });

  it('escolhe a regra que explica o problema quando mais de uma falha no campo', async () => {
    const typeError = await validateProbe({ label: 123 });

    expect(toValidationDetails(typeError)).toEqual([
      { field: 'label', code: ValidationRule.INVALID_TYPE, params: {} },
    ]);

    const missing = await validateProbe({ plate: '' });

    expect(toValidationDetails(missing)).toEqual([
      { field: 'plate', code: ValidationRule.REQUIRED, params: {} },
    ]);
  });

  it('devolve lista vazia quando não há erro', async () => {
    const errors = await validateProbe();

    expect(toValidationDetails(errors)).toEqual([]);
  });

  it('cai no código de reserva para constraint sem regra própria', async () => {
    const errors = await validateProbe({ website: 'nope' });

    expect(toValidationDetails(errors)).toEqual([
      { field: 'website', code: ValidationRule.INVALID_VALUE, params: {} },
    ]);
  });
});
